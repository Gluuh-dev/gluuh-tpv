-- 0085 — Facturación de la empresa a Gluuh (consola de plataforma).
-- Cómo y cuánto paga cada empresa, cuándo toca el próximo pago, y el historial
-- de pagos recibidos. Stripe (domiciliación real) se cablea en una fase aparte;
-- aquí queda el modelo y la gestión manual. (Aplicada por MCP el 08-07-2026.)

alter table public.tenant add column if not exists ciclo_pago text
  check (ciclo_pago in ('MENSUAL','TRIMESTRAL','ANUAL'));
alter table public.tenant add column if not exists forma_pago text
  check (forma_pago in ('TRANSFERENCIA','EFECTIVO','DOMICILIADO','STRIPE'));
alter table public.tenant add column if not exists precio_periodo numeric(10,2);
alter table public.tenant add column if not exists proximo_pago date;
alter table public.tenant add column if not exists stripe_customer_id text;

-- Historial de pagos empresa → Gluuh. Datos de PLATAFORMA (no del tenant): solo
-- el admin de plataforma los ve (RLS por es_admin_plataforma, no por tenant).
create table if not exists public.pago_gluuh (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  fecha         date not null default current_date,
  importe       numeric(10,2) not null,
  concepto      text,
  metodo        text,
  periodo_desde date,
  periodo_hasta date,
  created_at    timestamptz not null default now()
);
alter table public.pago_gluuh enable row level security;
drop policy if exists pago_gluuh_admin on public.pago_gluuh;
create policy pago_gluuh_admin on public.pago_gluuh for all
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());
create index if not exists pago_gluuh_tenant_idx on public.pago_gluuh(tenant_id, fecha desc);

-- Resumen de empresas con los datos de facturación.
drop function if exists public.admin_resumen_empresas();
create function public.admin_resumen_empresas()
returns table(
  id uuid, nombre text, cif text, email_admin text, plan text,
  codigo_instalacion text, es_plantilla boolean, activo boolean, licencia_limites jsonb,
  licencia_hasta date, licencia_modulos text[], created_at timestamptz,
  ciclo_pago text, forma_pago text, precio_periodo numeric, proximo_pago date,
  n_productos bigint, n_usuarios bigint, n_dispositivos bigint, n_dispositivos_online bigint
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id, t.nombre, t.cif, t.email_admin, t.plan,
         t.codigo_instalacion, t.es_plantilla, t.activo, t.licencia_limites,
         t.licencia_hasta, t.licencia_modulos, t.created_at,
         t.ciclo_pago, t.forma_pago, t.precio_periodo, t.proximo_pago,
         (select count(*) from public.product  p where p.tenant_id = t.id),
         (select count(*) from public.app_user u where u.tenant_id = t.id),
         (select count(*) from public.device   d where d.tenant_id = t.id),
         (select count(*) from public.device   d where d.tenant_id = t.id and d.ultima_conexion > now() - interval '3 minutes')
  from public.tenant t
  where public.es_admin_plataforma()
  order by t.created_at desc;
$$;
revoke all on function public.admin_resumen_empresas() from public, anon;
grant execute on function public.admin_resumen_empresas() to authenticated, service_role;
