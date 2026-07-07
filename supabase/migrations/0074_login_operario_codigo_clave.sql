-- 0074 · Login local por código+clave (backoffice sin email). Cada operario puede
-- tener una CLAVE de acceso (bcrypt) además del PIN del TPV. El login por código
-- (route /api/entrar-codigo) la verifica y crea/actualiza una cuenta auth SINTÉTICA
-- (email interno op.<codigo>.<tenant8>@codigo.gluuh.local) para reusar Supabase Auth:
-- la sesión lleva tenant/rol por el hook y funcionan RLS + permisos. El login por
-- email sigue igual (dueño/técnico/remoto). Solo aplica a operarios SIN email real.

alter table app_user add column if not exists clave_hash text;

-- Fijar/actualizar la clave de acceso de un operario (solo PROP/ENC del tenant).
create or replace function cambiar_clave_operario(p_user_id uuid, p_clave text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_caller_rol text;
begin
  select rol into v_caller_rol from app_user where auth_user_id = auth.uid() limit 1;
  if v_caller_rol not in ('PROPIETARIO','ENCARGADO') then
    raise exception 'Sin permiso';
  end if;
  if p_clave is null or length(p_clave) < 4 then
    raise exception 'La clave debe tener al menos 4 caracteres';
  end if;
  update app_user set clave_hash = crypt(p_clave, gen_salt('bf'))
    where id = p_user_id and tenant_id = current_tenant_id();
end;
$$;
grant execute on function cambiar_clave_operario(uuid, text) to authenticated;

-- Verificar código+clave (login local). Solo operarios SIN email real. Solo service_role.
create or replace function verificar_clave_operario(p_codigo text, p_clave text)
returns table(id uuid, tenant_id uuid, nombre text, auth_user_id uuid)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select u.id, u.tenant_id, u.nombre, u.auth_user_id
  from app_user u
  where u.codigo = p_codigo
    and u.activo
    and u.email is null
    and u.clave_hash is not null
    and u.clave_hash = crypt(p_clave, u.clave_hash)
  limit 1;
$$;
revoke all on function verificar_clave_operario(text, text) from public, authenticated;
grant execute on function verificar_clave_operario(text, text) to service_role;

-- La siembra por defecto ahora también da al Técnico su clave de acceso (1212).
create or replace function admin_sembrar_operarios_defecto(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  perform set_config('app.tenant_id', p_tenant::text, true);
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and nombre = 'Técnico') then
    insert into public.app_user (tenant_id, nombre, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Técnico', 'PROPIETARIO', crypt('1212', gen_salt('bf')), crypt('1212', gen_salt('bf')), true);
  end if;
  update public.app_user
    set pin_hash = crypt('1111', gen_salt('bf'))
    where tenant_id = p_tenant and rol = 'PROPIETARIO' and auth_user_id is not null and pin_hash is null;
end;
$$;

-- Backfill: al Técnico ya sembrado (sin clave), darle clave de acceso 1212.
update app_user set clave_hash = crypt('1212', gen_salt('bf'))
  where nombre = 'Técnico' and email is null and clave_hash is null;
