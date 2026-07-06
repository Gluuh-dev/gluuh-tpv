-- 0065 — Ficha Glop/Ágora (Fase 3a): jerarquía padre, familia directa del
-- producto, PLU, principal/añadido, estilo de botón, carta digital y centros
-- de venta por categoría. Réplica del configurador Ágora que usa el cliente.
-- Aditiva e idempotente. Aplicada en Supabase el 06-07-2026 (apply_migration).

-- ── Familia: padre, orden de impresión en factura y estilo ──
alter table public.family add column if not exists familia_padre_id uuid references public.family(id) on delete set null;
alter table public.family add column if not exists orden_impresion int not null default 0;   -- orden en factura/ticket
alter table public.family add column if not exists texto_boton text;                          -- texto del botón (null = nombre)
alter table public.family add column if not exists foto_url text;                             -- imagen del botón
create index if not exists idx_family_padre on public.family (familia_padre_id);

-- ── Categoría: padre, estilo y carta digital ──
alter table public.category add column if not exists categoria_padre_id uuid references public.category(id) on delete set null;
alter table public.category add column if not exists texto_boton text;
alter table public.category add column if not exists carta_nombre text;        -- carta digital: null = nombre
alter table public.category add column if not exists carta_descripcion text;   -- carta digital: null = nombres de productos
create index if not exists idx_category_padre on public.category (categoria_padre_id);

-- ── Producto: familia DIRECTA (modelo Glop: 1 familia por producto), PLU,
--    principal/añadido, tiempos y estilo ──
alter table public.product add column if not exists family_id uuid references public.family(id) on delete set null;
alter table public.product add column if not exists plu text;                                  -- código PLU (teclado rápido)
alter table public.product add column if not exists es_principal boolean not null default true; -- se vende como producto principal
alter table public.product add column if not exists es_anadido boolean not null default false;  -- se vende como añadido de otro
alter table public.product add column if not exists tiempo_preparacion_min int;
alter table public.product add column if not exists texto_boton text;
alter table public.product add column if not exists carta_nombre text;
create index if not exists idx_product_family on public.product (family_id);
create unique index if not exists uq_product_plu on public.product (tenant_id, plu) where plu is not null;

-- Relleno inicial: la familia del producto = la de su categoría principal.
update public.product p set family_id = c.family_id
from public.category c
where p.category_id = c.id and p.family_id is null and c.family_id is not null;

-- ── Centros de venta por categoría: SIN filas = "asociar a todos" (defecto) ──
create table if not exists public.category_sales_center (
  category_id     uuid not null references public.category(id) on delete cascade,
  sales_center_id uuid not null references public.sales_center(id) on delete cascade,
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  primary key (category_id, sales_center_id)
);
create index if not exists idx_csc_tenant on public.category_sales_center (tenant_id, sales_center_id);
create index if not exists idx_csc_centro on public.category_sales_center (sales_center_id);
alter table public.category_sales_center enable row level security;
drop policy if exists category_sales_center_rw on public.category_sales_center;
create policy category_sales_center_rw on public.category_sales_center for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
grant all on public.category_sales_center to authenticated;
