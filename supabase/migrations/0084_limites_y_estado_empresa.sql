-- 0084 — Límites por empresa y estado (consola de plataforma).
-- licencia_limites: { "dispositivos": N, "usuarios": N }  (null = sin límite).
-- tenant.activo (ya existe) se expone en el resumen para suspender/reactivar;
-- el login de operario se acota también al estado (empresa suspendida = no entra).
-- (Aplicada por MCP el 08-07-2026.)

alter table public.tenant add column if not exists licencia_limites jsonb;

drop function if exists public.admin_resumen_empresas();
create function public.admin_resumen_empresas()
returns table(
  id uuid, nombre text, cif text, email_admin text, plan text,
  codigo_instalacion text, es_plantilla boolean, activo boolean, licencia_limites jsonb,
  licencia_hasta date, licencia_modulos text[], created_at timestamptz,
  n_productos bigint, n_usuarios bigint, n_dispositivos bigint, n_dispositivos_online bigint
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id, t.nombre, t.cif, t.email_admin, t.plan,
         t.codigo_instalacion, t.es_plantilla, t.activo, t.licencia_limites,
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

-- Login de operario acotado también al ESTADO: empresa suspendida = no entra.
drop function if exists public.verificar_clave_operario(text, text, uuid);
create function public.verificar_clave_operario(p_usuario text, p_clave text, p_tenant uuid default null)
returns table(id uuid, tenant_id uuid, nombre text, codigo text, auth_user_id uuid)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select u.id, u.tenant_id, u.nombre, u.codigo, u.auth_user_id
  from app_user u
  join tenant t on t.id = u.tenant_id
  where u.usr_app = normalizar_usr(p_usuario)
    and (p_tenant is null or u.tenant_id = p_tenant)
    and t.activo and u.activo and u.email is null
    and u.clave_hash is not null
    and u.clave_hash = crypt(p_clave, u.clave_hash)
  limit 1;
$$;
revoke all on function public.verificar_clave_operario(text, text, uuid) from public, anon, authenticated;
grant execute on function public.verificar_clave_operario(text, text, uuid) to service_role;
