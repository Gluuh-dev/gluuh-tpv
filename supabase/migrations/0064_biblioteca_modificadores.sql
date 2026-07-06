-- 0064 — Catálogo estilo Glop, Fase 2: BIBLIOTECA de modificadores por tenant
-- + asignación con herencia familia → categoría → producto (suma y quitar por nivel).
-- Hoy `modifier_group` cuelga de un producto; pasa a poder vivir en la biblioteca
-- (`product_id` NULL). Los grupos por producto existentes siguen funcionando igual
-- (el TPV los suma a los heredados): nada existente se rompe.
-- Aditiva e idempotente. PENDIENTE DE APLICAR en Supabase (MCP no disponible en
-- la sesión que la escribió); aplicar con apply_migration y quitar esta nota.

-- ── El grupo puede ser de biblioteca (product_id opcional) y lleva tipo ──
alter table public.modifier_group alter column product_id drop not null;
alter table public.modifier_group add column if not exists tipo text not null default 'EXTRA'
  check (tipo in ('EXTRA','COMENTARIO'));

-- Clasificación inicial: los grupos existentes cuyas opciones no suman precio son
-- comentarios a cocina ("Punto de la carne"…); el resto, extras con precio.
-- (Re-ejecutar reclasificaría grupos EXTRA sin precios: clasificación correcta igualmente.)
update public.modifier_group g set tipo = 'COMENTARIO'
where g.tipo = 'EXTRA'
  and not exists (select 1 from public.modifier m
                  where m.modifier_group_id = g.id and m.precio_extra > 0);

-- ── Asignaciones: a qué familia/categoría/producto se ofrece cada grupo ──
-- Destino: exactamente UNO de family_id / category_id / product_id.
-- modo INCLUIR suma el grupo; EXCLUIR lo quita de lo heredado de niveles
-- superiores (familia < categoría < producto; dentro del nivel, INCLUIR gana).
create table if not exists public.modifier_group_asignacion (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant(id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_group(id) on delete cascade,
  family_id         uuid references public.family(id)   on delete cascade,
  category_id       uuid references public.category(id) on delete cascade,
  product_id        uuid references public.product(id)  on delete cascade,
  modo              text not null default 'INCLUIR' check (modo in ('INCLUIR','EXCLUIR')),
  created_at        timestamptz not null default now(),
  check (num_nonnulls(family_id, category_id, product_id) = 1)
);

-- Un grupo solo tiene una asignación por destino (únicos parciales por nivel).
create unique index if not exists uq_mga_familia   on public.modifier_group_asignacion (modifier_group_id, family_id)   where family_id   is not null;
create unique index if not exists uq_mga_categoria on public.modifier_group_asignacion (modifier_group_id, category_id) where category_id is not null;
create unique index if not exists uq_mga_producto  on public.modifier_group_asignacion (modifier_group_id, product_id)  where product_id  is not null;
-- Índices de consulta y de FK (regla 0062: toda FK con índice; tenant_id primero en los de consulta).
create index if not exists idx_mga_tenant    on public.modifier_group_asignacion (tenant_id);
create index if not exists idx_mga_grupo     on public.modifier_group_asignacion (modifier_group_id);
create index if not exists idx_mga_familia   on public.modifier_group_asignacion (family_id);
create index if not exists idx_mga_categoria on public.modifier_group_asignacion (category_id);
create index if not exists idx_mga_producto  on public.modifier_group_asignacion (product_id);

-- ── RLS + tenant autorrellenado (la escribe el navegador) ──
alter table public.modifier_group_asignacion enable row level security;
drop policy if exists modifier_group_asignacion_rw on public.modifier_group_asignacion;
create policy modifier_group_asignacion_rw on public.modifier_group_asignacion for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
grant all on public.modifier_group_asignacion to authenticated;
drop trigger if exists trg_set_tenant on public.modifier_group_asignacion;
create trigger trg_set_tenant before insert on public.modifier_group_asignacion
  for each row execute function public.set_tenant_id();
