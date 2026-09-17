-- Etapa 2 — Multi-tenant
-- Banco ainda sem dados de produção (fundação da Etapa 1 nunca chegou a
-- ser usada), então essa migration reestrutura em vez de só "adicionar".
-- A partir daqui, migrations são sempre aditivas: nunca reescrever uma
-- já aplicada, mesmo que pareça mais simples.

-- ============================================================
-- Membership: organization_members substitui profiles.organization_id
-- ============================================================
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role user_role not null default 'vendas',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- profiles vira o perfil global do usuário: papel e organização saem
-- daqui e vão pra organization_members.
alter table profiles drop column organization_id;
alter table profiles drop column role;

-- ============================================================
-- organization_id nas tabelas filhas que ainda não tinham
-- (customers, categories, products, orders, stock_locations e
-- external_integrations já vieram com organization_id not null
-- desde a Etapa 1 — nada a fazer nelas)
-- ============================================================
alter table product_variants add column organization_id uuid not null references organizations (id);
alter table order_items add column organization_id uuid not null references organizations (id);
alter table inventory_levels add column organization_id uuid not null references organizations (id);
alter table stock_reservations add column organization_id uuid not null references organizations (id);
alter table stock_movements add column organization_id uuid not null references organizations (id);

-- ============================================================
-- Auditoria — estrutura pronta, instrumentação (triggers/inserts por
-- ação) fica pra quando os módulos de negócio existirem de verdade.
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  actor_id uuid references profiles (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- RLS — isolamento por organização
-- ============================================================
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

alter table organization_members enable row level security;
alter table audit_log enable row level security;

create policy "organization_members: vê membros da própria organização"
  on organization_members for select
  using (is_org_member(organization_id));

create policy "organization_members: admin gerencia membros"
  on organization_members for all
  using (
    exists (
      select 1 from organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

create policy "audit_log: leitura por admin da organização"
  on audit_log for select
  using (
    exists (
      select 1 from organization_members m
      where m.organization_id = audit_log.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );
-- Sem policy de insert/update/delete pra authenticated: audit_log só
-- é escrito via service_role (backend), nunca pelo cliente.

-- organizations: antes "todo autenticado lê"; agora só quem é membro.
drop policy if exists "organizations: leitura de membros" on organizations;
create policy "organizations: leitura de membros" on organizations
  for select using (is_org_member(id));

-- profiles: continua um dado pessoal do próprio usuário (não tem mais
-- organization_id pra filtrar por).
drop policy if exists "profiles: leitura do próprio e de membros" on profiles;
create policy "profiles: leitura do próprio" on profiles
  for select using (id = auth.uid());

-- Tabelas de negócio: troca a policy antiga (autenticado) pela nova
-- (isolada por organização).
drop policy if exists "customers: acesso de membros" on customers;
create policy "customers: acesso da organização" on customers
  for all using (is_org_member(organization_id));

drop policy if exists "categories: acesso de membros" on categories;
create policy "categories: acesso da organização" on categories
  for all using (is_org_member(organization_id));

drop policy if exists "products: acesso de membros" on products;
create policy "products: acesso da organização" on products
  for all using (is_org_member(organization_id));

drop policy if exists "product_variants: acesso de membros" on product_variants;
create policy "product_variants: acesso da organização" on product_variants
  for all using (is_org_member(organization_id));

drop policy if exists "orders: acesso de membros" on orders;
create policy "orders: acesso da organização" on orders
  for all using (is_org_member(organization_id));

drop policy if exists "order_items: acesso de membros" on order_items;
create policy "order_items: acesso da organização" on order_items
  for all using (is_org_member(organization_id));

drop policy if exists "stock_locations: acesso de membros" on stock_locations;
create policy "stock_locations: acesso da organização" on stock_locations
  for all using (is_org_member(organization_id));

drop policy if exists "inventory_levels: acesso de membros" on inventory_levels;
create policy "inventory_levels: acesso da organização" on inventory_levels
  for all using (is_org_member(organization_id));

drop policy if exists "stock_reservations: acesso de membros" on stock_reservations;
create policy "stock_reservations: acesso da organização" on stock_reservations
  for all using (is_org_member(organization_id));

drop policy if exists "stock_movements: acesso de membros" on stock_movements;
create policy "stock_movements: acesso da organização" on stock_movements
  for all using (is_org_member(organization_id));

-- is_authenticated_member() da Etapa 1 não faz mais sentido isolado
-- por organização — só podia ser derrubada depois das policies acima,
-- que dependiam dela.
drop function if exists is_authenticated_member();

-- external_integrations: nenhuma policy pra authenticated continua de
-- propósito (só service_role) — nada muda aqui além da coluna já ser
-- not null.

-- sales_channels e units continuam globais: sales_channels já tinha
-- policy de leitura pra qualquer autenticado (mantém); units nunca
-- teve RLS habilitada porque não tem dado sensível — habilita agora
-- por consistência, com leitura liberada pra autenticado.
alter table units enable row level security;
create policy "units: leitura autenticada" on units
  for select using (auth.role() = 'authenticated');
