-- 0076 · Login por usuario: comparación sin acentos (unaccent). (Superada por 0077,
-- que pasa a usr_app; se conserva por historial.)
create extension if not exists unaccent;
drop function if exists verificar_clave_operario(text, text);
create function verificar_clave_operario(p_usuario text, p_clave text)
returns table(id uuid, tenant_id uuid, nombre text, codigo text, auth_user_id uuid)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select u.id, u.tenant_id, u.nombre, u.codigo, u.auth_user_id
  from app_user u
  where unaccent(lower(trim(u.nombre))) = unaccent(lower(trim(p_usuario)))
    and u.activo
    and u.email is null
    and u.clave_hash is not null
    and u.clave_hash = crypt(p_clave, u.clave_hash)
  limit 1;
$$;
revoke all on function verificar_clave_operario(text, text) from public, authenticated;
grant execute on function verificar_clave_operario(text, text) to service_role;
