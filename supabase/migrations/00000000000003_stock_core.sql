-- Etapa 3 — Núcleo de estoque + fundação de integrações
-- A partir daqui, inventory_levels/stock_reservations/stock_movements
-- só são escritas por função (RPC), nunca direto pelo cliente. RLS
-- dessas 3 tabelas vira somente-leitura pra "authenticated".

-- ============================================================
-- stock_reservations: status + idempotência
-- ============================================================
create type stock_reservation_status as enum ('active', 'released', 'fulfilled');

alter table stock_reservations
  add column status stock_reservation_status not null default 'active',
  add column idempotency_key text,
  add unique (organization_id, idempotency_key);

-- ============================================================
-- stock_movements: idempotência + rastreio da reserva de origem
-- ============================================================
alter table stock_movements
  add column idempotency_key text,
  add column reservation_id uuid references stock_reservations (id),
  add unique (organization_id, idempotency_key);

-- ============================================================
-- View de disponibilidade — física - reservada, sempre calculada,
-- nunca guardada (evita duas fontes de verdade divergindo).
-- security_invoker garante que a RLS de quem consulta a view (não a
-- de quem criou) é a aplicada.
-- ============================================================
create view stock_availability
with (security_invoker = true)
as
select
  il.organization_id,
  il.product_variant_id,
  il.location_id,
  il.quantity_on_hand,
  coalesce(r.quantity_reserved, 0) as quantity_reserved,
  il.quantity_on_hand - coalesce(r.quantity_reserved, 0) as quantity_available
from inventory_levels il
left join (
  select product_variant_id, location_id, sum(quantity) as quantity_reserved
  from stock_reservations
  where status = 'active'
  group by product_variant_id, location_id
) r on r.product_variant_id = il.product_variant_id
    and r.location_id = il.location_id;

-- ============================================================
-- RLS: fecha escrita direta nas 3 tabelas do núcleo.
-- Leitura continua liberada pra membro da organização.
-- ============================================================
drop policy if exists "inventory_levels: acesso da organização" on inventory_levels;
create policy "inventory_levels: leitura da organização" on inventory_levels
  for select using (is_org_member(organization_id));

drop policy if exists "stock_reservations: acesso da organização" on stock_reservations;
create policy "stock_reservations: leitura da organização" on stock_reservations
  for select using (is_org_member(organization_id));

drop policy if exists "stock_movements: acesso da organização" on stock_movements;
create policy "stock_movements: leitura da organização" on stock_movements
  for select using (is_org_member(organization_id));

-- ============================================================
-- reserve_stock — reserva com trava de concorrência + idempotência
-- ============================================================
create or replace function reserve_stock(
  p_organization_id uuid,
  p_order_id uuid,
  p_product_variant_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_idempotency_key text
)
returns stock_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing stock_reservations;
  v_on_hand numeric;
  v_reserved numeric;
  v_result stock_reservations;
begin
  if not is_org_member(p_organization_id) then
    raise exception 'não é membro dessa organização';
  end if;

  if p_quantity <= 0 then
    raise exception 'quantidade precisa ser positiva';
  end if;

  select * into v_existing from stock_reservations
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  -- trava a linha de saldo: uma segunda chamada concorrente pro mesmo
  -- produto/local espera essa transação terminar antes de ler o saldo.
  select quantity_on_hand into v_on_hand
    from inventory_levels
    where product_variant_id = p_product_variant_id
      and location_id = p_location_id
      and organization_id = p_organization_id
    for update;

  if not found then
    raise exception 'sem saldo cadastrado pra esse produto/local';
  end if;

  select coalesce(sum(quantity), 0) into v_reserved
    from stock_reservations
    where product_variant_id = p_product_variant_id
      and location_id = p_location_id
      and status = 'active';

  if (v_on_hand - v_reserved) < p_quantity then
    raise exception 'estoque insuficiente: disponível %, solicitado %',
      (v_on_hand - v_reserved), p_quantity;
  end if;

  insert into stock_reservations (
    organization_id, order_id, product_variant_id, location_id,
    quantity, status, idempotency_key
  ) values (
    p_organization_id, p_order_id, p_product_variant_id, p_location_id,
    p_quantity, 'active', p_idempotency_key
  ) returning * into v_result;

  insert into audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    p_organization_id, auth.uid(), 'stock.reserve', 'stock_reservations', v_result.id,
    jsonb_build_object('order_id', p_order_id, 'quantity', p_quantity)
  );

  return v_result;
end;
$$;

revoke all on function reserve_stock(uuid, uuid, uuid, uuid, numeric, text) from public;
grant execute on function reserve_stock(uuid, uuid, uuid, uuid, numeric, text) to authenticated;

-- ============================================================
-- release_reservation — cancela uma reserva ativa (idempotente: uma
-- reserva já liberada só retorna o estado atual, não dá erro).
-- ============================================================
create or replace function release_reservation(p_reservation_id uuid)
returns stock_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation stock_reservations;
begin
  select * into v_reservation from stock_reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'reserva não encontrada';
  end if;

  if not is_org_member(v_reservation.organization_id) then
    raise exception 'não é membro dessa organização';
  end if;

  if v_reservation.status = 'released' then
    return v_reservation;
  end if;

  if v_reservation.status = 'fulfilled' then
    raise exception 'reserva já foi efetivada em movimentação, não pode ser liberada';
  end if;

  update stock_reservations set status = 'released'
    where id = p_reservation_id
    returning * into v_reservation;

  insert into audit_log (organization_id, actor_id, action, entity, entity_id)
  values (v_reservation.organization_id, auth.uid(), 'stock.release', 'stock_reservations', v_reservation.id);

  return v_reservation;
end;
$$;

revoke all on function release_reservation(uuid) from public;
grant execute on function release_reservation(uuid) to authenticated;

-- ============================================================
-- fulfill_reservation — efetiva a reserva: baixa o físico e gera a
-- movimentação. Idempotente via idempotency_key na movimentação.
-- ============================================================
create or replace function fulfill_reservation(
  p_reservation_id uuid,
  p_idempotency_key text
)
returns stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation stock_reservations;
  v_existing stock_movements;
  v_movement stock_movements;
begin
  select * into v_reservation from stock_reservations
    where id = p_reservation_id;

  if not found then
    raise exception 'reserva não encontrada';
  end if;

  if not is_org_member(v_reservation.organization_id) then
    raise exception 'não é membro dessa organização';
  end if;

  select * into v_existing from stock_movements
    where organization_id = v_reservation.organization_id
      and idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  if v_reservation.status <> 'active' then
    raise exception 'só é possível efetivar uma reserva ativa (status atual: %)', v_reservation.status;
  end if;

  -- trava o saldo físico antes de baixar
  perform 1 from inventory_levels
    where product_variant_id = v_reservation.product_variant_id
      and location_id = v_reservation.location_id
    for update;

  update inventory_levels
    set quantity_on_hand = quantity_on_hand - v_reservation.quantity
    where product_variant_id = v_reservation.product_variant_id
      and location_id = v_reservation.location_id;

  update stock_reservations set status = 'fulfilled'
    where id = p_reservation_id;

  insert into stock_movements (
    organization_id, product_variant_id, location_id, type, quantity,
    reference, reservation_id, idempotency_key
  ) values (
    v_reservation.organization_id, v_reservation.product_variant_id, v_reservation.location_id,
    'saida', v_reservation.quantity, v_reservation.order_id::text, v_reservation.id, p_idempotency_key
  ) returning * into v_movement;

  insert into audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_reservation.organization_id, auth.uid(), 'stock.fulfill', 'stock_movements', v_movement.id,
    jsonb_build_object('reservation_id', v_reservation.id, 'quantity', v_reservation.quantity)
  );

  return v_movement;
end;
$$;

revoke all on function fulfill_reservation(uuid, text) from public;
grant execute on function fulfill_reservation(uuid, text) to authenticated;

-- ============================================================
-- Fundação de integrações — sem chamada real a Mercado Livre/Shopee
-- nessa etapa, só a estrutura de mapeamento e log.
-- ============================================================
create table external_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  channel_id uuid not null references sales_channels (id),
  entity_type text not null, -- 'product_variant' | 'order'
  entity_id uuid not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, channel_id, entity_type, entity_id),
  unique (organization_id, channel_id, entity_type, external_id)
);

create table integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  channel_id uuid not null references sales_channels (id),
  direction text not null, -- 'inbound' | 'outbound'
  entity_type text not null,
  entity_id uuid,
  external_id text,
  status text not null, -- 'success' | 'error' | 'retrying'
  attempt integer not null default 1,
  idempotency_key text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table external_references enable row level security;
alter table integration_sync_logs enable row level security;

create policy "external_references: leitura da organização" on external_references
  for select using (is_org_member(organization_id));

create policy "integration_sync_logs: leitura da organização" on integration_sync_logs
  for select using (is_org_member(organization_id));
-- Sem policy de insert/update/delete pra authenticated: as duas só são
-- escritas por service_role (a integração de verdade roda server-side).
