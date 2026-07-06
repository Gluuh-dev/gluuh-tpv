-- 0061 — Catálogo estilo Glop, Fase 1: producto en varias categorías + visibilidad.
-- El TPV pasa a leer la relación muchos-a-muchos; `product.category_id` se mantiene
-- como "categoría principal" por compatibilidad (nada existente se rompe).
-- Familias/categorías solo salen en la pantalla de venta si `mostrar_venta` = true.

-- ── Producto ↔ categoría (muchos-a-muchos) ──
create table if not exists public.product_category (
  product_id  uuid not null references public.product(id)  on delete cascade,
  category_id uuid not null references public.category(id) on delete cascade,
  tenant_id   uuid not null references public.tenant(id)   on delete cascade,
  orden       int  default 0,
  primary key (product_id, category_id)
);
create index if not exists idx_product_category_cat on public.product_category (tenant_id, category_id);

-- Relleno inicial desde la categoría actual de cada producto.
insert into public.product_category (product_id, category_id, tenant_id)
select id, category_id, tenant_id from public.product where category_id is not null
on conflict do nothing;

-- ── Visibilidad en el TPV (familia y categoría) ──
alter table public.family   add column if not exists mostrar_venta boolean not null default true;
alter table public.family   add column if not exists mostrar_menus boolean not null default true;
alter table public.category add column if not exists mostrar_venta boolean not null default true;
alter table public.category add column if not exists mostrar_menus boolean not null default true;

-- ── RLS por tenant (mismo patrón que el resto de tablas) ──
alter table public.product_category enable row level security;
drop policy if exists product_category_rw on public.product_category;
create policy product_category_rw on public.product_category for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
grant all on public.product_category to authenticated;
