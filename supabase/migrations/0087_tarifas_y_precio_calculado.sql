-- 0087 — Tarifas de PLATAFORMA (base + por tipo de dispositivo + por módulo) y
-- cálculo del precio mensual de cada empresa. (Nombre tarifa_plataforma: 'tarifa'
-- ya existe como stub de tarifas de cliente, otro concepto.)
-- (Aplicada por MCP el 08-07-2026.)

create table if not exists public.tarifa_plataforma (
  clave    text primary key,          -- BASE · DISPOSITIVO_<tipo> · MODULO_<clave>
  etiqueta text not null,
  precio   numeric(10,2) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.tarifa_plataforma enable row level security;
drop policy if exists tarifa_plat_lee on public.tarifa_plataforma;
drop policy if exists tarifa_plat_admin on public.tarifa_plataforma;
create policy tarifa_plat_lee on public.tarifa_plataforma for select using (true);
create policy tarifa_plat_admin on public.tarifa_plataforma for all
  using (public.es_admin_plataforma()) with check (public.es_admin_plataforma());

insert into public.tarifa_plataforma (clave, etiqueta, precio) values
  ('BASE',                 'Cuota base',            20),
  ('DISPOSITIVO_TPV',      'TPV',                   30),
  ('DISPOSITIVO_COMANDERA','Comandera',             15),
  ('DISPOSITIVO_KDS',      'Monitor de cocina',     15),
  ('DISPOSITIVO_PANTALLA', 'Pantalla de recogida',  10),
  ('DISPOSITIVO_KIOSKO',   'Kiosko',                25),
  ('DISPOSITIVO_CARTELERIA','Cartelería',           10),
  ('DISPOSITIVO_VISOR',    'Visor de cliente',       5),
  ('DISPOSITIVO_WEB',      'Terminal web',           0),
  ('MODULO_KIOSKO',        'Módulo Kiosko',         20),
  ('MODULO_PAGOS',         'Módulo Pagos',          15),
  ('MODULO_QR_MESA',       'Módulo QR en mesa',     10),
  ('MODULO_DELIVERY',      'Módulo Delivery',       15),
  ('MODULO_API',           'Módulo API',            15),
  ('MODULO_STOCK',         'Módulo Compras y stock',15)
on conflict (clave) do nothing;

-- Resumen con el precio mensual CALCULADO (base + dispositivos vinculados por
-- tipo + módulos contratados). precio_periodo (0085) queda como override manual.
drop function if exists public.admin_resumen_empresas();
create function public.admin_resumen_empresas()
returns table(
  id uuid, nombre text, cif text, email_admin text, plan text,
  codigo_instalacion text, es_plantilla boolean, activo boolean, licencia_limites jsonb,
  licencia_hasta date, licencia_modulos text[], created_at timestamptz,
  ciclo_pago text, forma_pago text, precio_periodo numeric, proximo_pago date,
  precio_calculado numeric,
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
         coalesce((select precio from tarifa_plataforma where clave = 'BASE'), 0)
           + coalesce((select sum(coalesce(tar.precio, 0)) from device d
                       left join tarifa_plataforma tar on tar.clave = 'DISPOSITIVO_' || d.tipo
                       where d.tenant_id = t.id and d.vinculado_at is not null), 0)
           + coalesce((select sum(coalesce(tar.precio, 0)) from unnest(t.licencia_modulos) mm
                       left join tarifa_plataforma tar on tar.clave = 'MODULO_' || mm), 0) as precio_calculado,
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
