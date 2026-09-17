-- Etapa 4 — Hierarquia de estoque: organização → filial → depósito →
-- localização (endereço + capacidade). Núcleo de reserva/efetivação
-- da Etapa 3 não muda (continua operando sobre stock_locations.id).

-- ============================================================
-- Correção: SKU era único globalmente, deveria ser único por
-- organização (dois clientes do SaaS não podem colidir de SKU).
-- ============================================================
alter table product_variants drop constraint product_variants_sku_key;
alter table product_variants add constraint product_variants_org_sku_key unique (organization_id, sku);

-- ============================================================
-- Produtos: código de barras + dimensões/peso (necessário pra
-- capacidade cúbica das localizações fazer sentido).
-- ============================================================
alter table product_variants
  add column barcode text,
  add column width_cm numeric(10, 2),
  add column depth_cm numeric(10, 2),
  add column height_cm numeric(10, 2),
  add column weight_kg numeric(10, 3),
  add constraint product_variants_org_barcode_key unique (organization_id, barcode);

-- ============================================================
-- Filiais
-- ============================================================
create table branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- ============================================================
-- Depósitos — organization_id é derivado por trigger, não confiável
-- vindo do cliente (evita um depósito "vazar" pra organização errada).
-- ============================================================
create table warehouses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id),
  organization_id uuid not null references organizations (id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (branch_id, code)
);

create or replace function set_warehouse_organization()
returns trigger
language plpgsql
as $$
begin
  select organization_id into new.organization_id
    from branches where id = new.branch_id;
  if new.organization_id is null then
    raise exception 'branch_id inválido';
  end if;
  return new;
end;
$$;

create trigger warehouses_set_organization
  before insert or update of branch_id on warehouses
  for each row execute function set_warehouse_organization();

-- ============================================================
-- Tipos de localização — configurável por organização (picking,
-- pulmão, doca, devolução...), não é lista fixa da plataforma.
-- ============================================================
create table location_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  code text not null,
  name text not null,
  unique (organization_id, code)
);

alter table location_types enable row level security;
create policy "location_types: acesso da organização" on location_types
  for all using (is_org_member(organization_id));

-- ============================================================
-- Localizações (stock_locations já existia desde a Etapa 1 — mantém
-- o nome, pra não quebrar reserve_stock/release_reservation/
-- fulfill_reservation, que já referenciam location_id).
-- organization_id derivado do warehouse por trigger, mesmo motivo dos
-- depósitos.
-- ============================================================
alter table stock_locations
  add column warehouse_id uuid references warehouses (id),
  add column location_type_id uuid references location_types (id),
  add column rua text,
  add column coluna text,
  add column nivel text,
  add column full_code text generated always as (
    coalesce(rua, '') || '-' || coalesce(coluna, '') || '-' || coalesce(nivel, '')
  ) stored,
  add column width_cm numeric(10, 2),
  add column depth_cm numeric(10, 2),
  add column height_cm numeric(10, 2),
  add column volume_total_m3 numeric(12, 4) generated always as (
    case
      when width_cm is not null and depth_cm is not null and height_cm is not null
        then round((width_cm * depth_cm * height_cm) / 1000000.0, 4)
      else null
    end
  ) stored,
  -- Capacidade útil é configurada à parte, nunca inferida da
  -- geometria: uma prateleira de 1m³ raramente guarda 1m³ de
  -- produto de verdade (formato irregular, folga operacional etc).
  add column volume_util_m3 numeric(12, 4),
  add column max_weight_kg numeric(10, 2),
  add column is_active boolean not null default true;

-- warehouse_id fica NOT NULL só depois de populado (tabela está vazia
-- nessa etapa, então dá pra endurecer direto).
alter table stock_locations alter column warehouse_id set not null;

alter table stock_locations
  add constraint stock_locations_warehouse_address_key
  unique (warehouse_id, rua, coluna, nivel);

create or replace function set_stock_location_organization()
returns trigger
language plpgsql
as $$
begin
  select organization_id into new.organization_id
    from warehouses where id = new.warehouse_id;
  if new.organization_id is null then
    raise exception 'warehouse_id inválido';
  end if;
  return new;
end;
$$;

create trigger stock_locations_set_organization
  before insert or update of warehouse_id on stock_locations
  for each row execute function set_stock_location_organization();

-- ============================================================
-- RLS: branches e warehouses seguem o mesmo padrão de leitura/escrita
-- de membro (ainda não há papel específico pra "gestor de filial").
-- ============================================================
alter table branches enable row level security;
alter table warehouses enable row level security;

create policy "branches: acesso da organização" on branches
  for all using (is_org_member(organization_id));

create policy "warehouses: acesso da organização" on warehouses
  for all using (is_org_member(organization_id));
