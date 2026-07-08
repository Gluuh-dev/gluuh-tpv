-- 0083 — Resumen de empresas para la consola de plataforma. SECURITY DEFINER
-- (cruza tenants, salta RLS) pero SOLO devuelve filas si el llamante es admin de
-- plataforma (es_admin_plataforma). Da el estado que necesita la consola:
-- suscripción/caducidad, módulos, y nº de productos/usuarios/dispositivos.
-- (Aplicada por MCP el 08-07-2026.)

create or replace function public.admin_resumen_empresas()
returns table(
  id uuid, nombre text, cif text, email_admin text, plan text,
  codigo_instalacion text, es_plantilla boolean,
  licencia_hasta date, licencia_modulos text[], created_at timestamptz,
  n_productos bigint, n_usuarios bigint, n_dispositivos bigint, n_dispositivos_online bigint
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id, t.nombre, t.cif, t.email_admin, t.plan,
         t.codigo_instalacion, t.es_plantilla,
         t.licencia_hasta, t.licencia_modulos, t.created_at,
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

-- Detalle de dispositivos de una empresa (para la ficha). Igualmente acotado.
create or replace function public.admin_dispositivos_empresa(p_tenant uuid)
returns table(id uuid, nombre text, tipo text, modulo text, vinculado_at timestamptz, ultima_conexion timestamptz, version text)
language sql
security definer
set search_path to 'public'
as $$
  select d.id, d.nombre, d.tipo, d.modulo, d.vinculado_at, d.ultima_conexion, d.version
  from public.device d
  where public.es_admin_plataforma() and d.tenant_id = p_tenant
  order by d.nombre;
$$;
revoke all on function public.admin_dispositivos_empresa(uuid) from public, anon;
grant execute on function public.admin_dispositivos_empresa(uuid) to authenticated, service_role;
