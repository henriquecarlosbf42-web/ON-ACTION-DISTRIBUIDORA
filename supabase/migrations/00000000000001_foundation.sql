-- Fundação — ON ACTION DISTRIBUIDORA
-- Modelo single-tenant: uma única organização (a própria distribuidora).
-- A tabela organizations existe desde já para não travar uma futura
-- migração pra multiempresa, mas hoje não é isolada por RLS de tenant.

create extension if not exists "pgcrypto";

-- ============================================================
-- Organização (hoje: registro único da ON ACTION)
-- ============================================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Usuários e papéis
-- Estende auth.users (Supabase Auth) com papel dentro do sistema.
-- ============================================================
create type user_role as enum ('admin', 'vendas', 'estoque', 'financeiro');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references organizations (id),
  full_name text not null,
  role user_role not null default 'vendas',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Clientes (B2B e B2C)
-- ============================================================
create type customer_type as enum ('b2b', 'b2c');

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  type customer_type not null,
  name text not null,
  document text, -- CPF ou CNPJ
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Catálogo: categorias, unidades, produtos e SKUs (variantes)
-- ============================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  parent_id uuid references categories (id)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- ex: UN, CX, KG
  description text not null
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  category_id uuid references categories (id),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  sku text not null unique,
  unit_id uuid not null references units (id),
  price_b2c numeric(12, 2),
  price_b2b numeric(12, 2),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Canais de venda (referência — integração real vem depois)
-- ============================================================
create type sales_channel_code as enum ('site', 'mercado_livre', 'shopee', 'manual');

create table sales_channels (
  id uuid primary key default gen_random_uuid(),
  code sales_channel_code not null unique,
  name text not null
);

insert into sales_channels (code, name) values
  ('site', 'Site próprio'),
  ('mercado_livre', 'Mercado Livre'),
  ('shopee', 'Shopee'),
  ('manual', 'Venda manual / balcão');

-- ============================================================
-- Pedidos
-- ============================================================
create type order_status as enum ('pendente', 'confirmado', 'faturado', 'enviado', 'entregue', 'cancelado');

create table orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  customer_id uuid not null references customers (id),
  channel_id uuid not null references sales_channels (id),
  status order_status not null default 'pendente',
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_variant_id uuid not null references product_variants (id),
  quantity numeric(12, 3) not null,
  unit_price numeric(12, 2) not null
);

-- ============================================================
-- Estoque: localizações, saldo, reservas e movimentações
-- ============================================================
create table stock_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null -- ex: Galpão principal, Depósito 2
);

create table inventory_levels (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants (id),
  location_id uuid not null references stock_locations (id),
  quantity_on_hand numeric(12, 3) not null default 0,
  unique (product_variant_id, location_id)
);

create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_variant_id uuid not null references product_variants (id),
  location_id uuid not null references stock_locations (id),
  quantity numeric(12, 3) not null,
  created_at timestamptz not null default now()
);

create type stock_movement_type as enum ('entrada', 'saida', 'ajuste');

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants (id),
  location_id uuid not null references stock_locations (id),
  type stock_movement_type not null,
  quantity numeric(12, 3) not null,
  reference text, -- ex: número do pedido, nota fiscal
  created_at timestamptz not null default now()
);

-- ============================================================
-- Integrações externas (Mercado Livre, Shopee)
-- Credenciais nunca são lidas pelo frontend: só service_role acessa.
-- ============================================================
create table external_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  channel_id uuid not null references sales_channels (id),
  is_active boolean not null default false,
  credentials jsonb, -- tokens/segredos, só acessível via service_role
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- Single-tenant hoje: a regra é "usuário autenticado com profile"
-- em vez de isolamento por organization_id. Preparado pra evoluir
-- pra checagem de organization_id quando virar multiempresa.
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table sales_channels enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table stock_locations enable row level security;
alter table inventory_levels enable row level security;
alter table stock_reservations enable row level security;
alter table stock_movements enable row level security;
alter table external_integrations enable row level security;

create or replace function is_authenticated_member()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid()
  );
$$;

-- sales_channels é referência pública de leitura pra qualquer autenticado
create policy "sales_channels: leitura autenticada" on sales_channels
  for select using (auth.role() = 'authenticated');

-- Demais tabelas: qualquer usuário autenticado com profile pode ler/escrever.
-- Papéis mais granulares (ex: estoque só mexe em stock_*) entram numa
-- próxima etapa, junto com os módulos correspondentes.
create policy "profiles: leitura do próprio e de membros" on profiles
  for select using (is_authenticated_member());
create policy "profiles: usuário atualiza o próprio" on profiles
  for update using (id = auth.uid());

create policy "organizations: leitura de membros" on organizations
  for select using (is_authenticated_member());

create policy "customers: acesso de membros" on customers
  for all using (is_authenticated_member());

create policy "categories: acesso de membros" on categories
  for all using (is_authenticated_member());

create policy "products: acesso de membros" on products
  for all using (is_authenticated_member());

create policy "product_variants: acesso de membros" on product_variants
  for all using (is_authenticated_member());

create policy "orders: acesso de membros" on orders
  for all using (is_authenticated_member());

create policy "order_items: acesso de membros" on order_items
  for all using (is_authenticated_member());

create policy "stock_locations: acesso de membros" on stock_locations
  for all using (is_authenticated_member());

create policy "inventory_levels: acesso de membros" on inventory_levels
  for all using (is_authenticated_member());

create policy "stock_reservations: acesso de membros" on stock_reservations
  for all using (is_authenticated_member());

create policy "stock_movements: acesso de membros" on stock_movements
  for all using (is_authenticated_member());

-- external_integrations: NENHUMA policy de select/insert/update pra
-- usuários autenticados. Só service_role (backend) acessa — RLS
-- habilitada e sem policies = acesso negado por padrão pro anon/authenticated.
