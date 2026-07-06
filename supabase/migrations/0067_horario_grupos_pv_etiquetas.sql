-- 0067 — Fase 3b Ágora: horario por categoría, grupos de puntos de venta y
-- etiquetas de producto (m2m sobre el catálogo etiqueta_producto ya existente).
-- Aditiva e idempotente. Aplicada en Supabase el 06-07-2026 (apply_migration).

-- ── Horario de disponibilidad por categoría (sin filas = siempre visible) ──
create table if not exists public.category_horario (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  category_id uuid not null references public.category(id) on delete cascade,
  hora_inicio time not null,
  hora_fin    time not null,
  dias        int[] not null default '{1,2,3,4,5,6,7}',  -- 1=lunes … 7=domingo
  created_at  timestamptz not null default now()
);
create index if not exists idx_cathorario_tenant on public.category_horario (tenant_id, category_id);
create index if not exists idx_cathorario_cat on public.category_horario (category_id);
alter table public.category_horario enable row level security;
drop policy if exists category_horario_rw on public.category_horario;
create policy category_horario_rw on public.category_horario for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
grant all on public.category_horario to authenticated;
drop trigger if exists trg_set_tenant on public.category_horario;
create trigger trg_set_tenant before insert on public.category_horario
  for each row execute function public.set_tenant_id();

-- ── Grupos de puntos de venta: agrupan dispositivos TPV ──
create table if not exists public.grupo_punto_venta (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_gpv_tenant on public.grupo_punto_venta (tenant_id);
alter table public.grupo_punto_venta enable row level security;
drop policy if exists grupo_punto_venta_rw on public.grupo_punto_venta;
create policy grupo_punto_venta_rw on public.grupo_punto_venta for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
grant all on public.grupo_punto_venta to authenticated;
drop trigger if exists trg_set_tenant on public.grupo_punto_venta;
create trigger trg_set_tenant before insert on public.grupo_punto_venta
  for each row execute function public.set_tenant_id();

alter table public.device add column if not exists grupo_punto_venta_id uuid references public.grupo_punto_venta(id) on delete set null;
create index if not exists idx_device_gpv on public.device (grupo_punto_venta_id);

-- Visibilidad por grupo (sin filas = se muestra en todos los grupos)
create table if not exists public.family_grupo_pv (
  family_id uuid not null references public.family(id) on delete cascade,
  grupo_id  uuid not null references public.grupo_punto_venta(id) on delete cascade,
  tenant_id uuid not null references public.tenant(id) on delete cascade,
  primary key (family_id, grupo_id)
);
create index if not exists idx_fgpv_tenant on public.family_grupo_pv (tenant_id, grupo_id);
create index if not exists idx_fgpv_grupo on public.family_grupo_pv (grupo_id);
alter table public.family_grupo_pv enable row level security;
drop policy if exists family_grupo_pv_rw on public.family_grupo_pv;
create policy family_grupo_pv_rw on public.family_grupo_pv for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
grant all on public.family_grupo_pv to authenticated;
drop trigger if exists trg_set_tenant on public.family_grupo_pv;
create trigger trg_set_tenant before insert on public.family_grupo_pv
  for each row execute function public.set_tenant_id();

create table if not exists public.category_grupo_pv (
  category_id uuid not null references public.category(id) on delete cascade,
  grupo_id    uuid not null references public.grupo_punto_venta(id) on delete cascade,
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  primary key (category_id, grupo_id)
);
create index if not exists idx_cgpv_tenant on public.category_grupo_pv (tenant_id, grupo_id);
create index if not exists idx_cgpv_grupo on public.category_grupo_pv (grupo_id);
alter table public.category_grupo_pv enable row level security;
drop policy if exists category_grupo_pv_rw on public.category_grupo_pv;
create policy category_grupo_pv_rw on public.category_grupo_pv for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
grant all on public.category_grupo_pv to authenticated;
drop trigger if exists trg_set_tenant on public.category_grupo_pv;
create trigger trg_set_tenant before insert on public.category_grupo_pv
  for each row execute function public.set_tenant_id();

-- ── Etiquetas de producto: m2m sobre el catálogo etiqueta_producto (0018) ──
create table if not exists public.product_etiqueta (
  product_id  uuid not null references public.product(id) on delete cascade,
  etiqueta_id uuid not null references public.etiqueta_producto(id) on delete cascade,
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  primary key (product_id, etiqueta_id)
);
create index if not exists idx_petiq_tenant on public.product_etiqueta (tenant_id, etiqueta_id);
create index if not exists idx_petiq_etiqueta on public.product_etiqueta (etiqueta_id);
alter table public.product_etiqueta enable row level security;
drop policy if exists product_etiqueta_rw on public.product_etiqueta;
create policy product_etiqueta_rw on public.product_etiqueta for all
  using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
grant all on public.product_etiqueta to authenticated;
drop trigger if exists trg_set_tenant on public.product_etiqueta;
create trigger trg_set_tenant before insert on public.product_etiqueta
  for each row execute function public.set_tenant_id();
