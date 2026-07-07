-- 0077 · Usuario de acceso (usr_app): campo de login normalizado (minúsculas, sin
-- acentos ni espacios), independiente del nombre para mostrar. Único por tenant.
-- El login por usuario casa contra usr_app.

alter table app_user add column if not exists usr_app text;

-- Normaliza un usuario: minúsculas, sin acentos, sin espacios, recortado; '' → null.
create or replace function normalizar_usr(p text)
returns text
language sql
stable
set search_path to 'public', 'extensions'
as $$ select nullif(regexp_replace(unaccent(lower(trim(coalesce(p, '')))), '\s+', '', 'g'), '') $$;

-- Normaliza usr_app en cada escritura (venga como venga del cliente).
create or replace function set_usr_app()
returns trigger
language plpgsql
set search_path to 'public', 'extensions'
as $$
begin
  new.usr_app := normalizar_usr(new.usr_app);
  return new;
end;
$$;
drop trigger if exists zz_set_usr_app on app_user;
create trigger zz_set_usr_app before insert or update of usr_app on app_user
  for each row execute function set_usr_app();

-- Backfill: derivar usr_app del nombre; si choca, añadir el código.
do $$
declare r record; v_base text; v_try text;
begin
  for r in select id, tenant_id, nombre, codigo from app_user where usr_app is null loop
    v_base := normalizar_usr(r.nombre);
    if v_base is null then v_base := 'op' || coalesce(r.codigo, ''); end if;
    v_try := v_base;
    if exists (select 1 from app_user where tenant_id = r.tenant_id and usr_app = v_try) then
      v_try := v_base || coalesce(r.codigo, '');
    end if;
    update app_user set usr_app = v_try where id = r.id;
  end loop;
end $$;

create unique index if not exists idx_app_user_usr_app on app_user(tenant_id, usr_app) where usr_app is not null;

-- verificar_clave_operario casa por usr_app (normalizado), no por nombre.
drop function if exists verificar_clave_operario(text, text);
create function verificar_clave_operario(p_usuario text, p_clave text)
returns table(id uuid, tenant_id uuid, nombre text, codigo text, auth_user_id uuid)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select u.id, u.tenant_id, u.nombre, u.codigo, u.auth_user_id
  from app_user u
  where u.usr_app = normalizar_usr(p_usuario)
    and u.activo
    and u.email is null
    and u.clave_hash is not null
    and u.clave_hash = crypt(p_clave, u.clave_hash)
  limit 1;
$$;
revoke all on function verificar_clave_operario(text, text) from public, authenticated;
grant execute on function verificar_clave_operario(text, text) to service_role;

-- Siembra por defecto: el Técnico tiene usr_app 'tecnico'.
create or replace function admin_sembrar_operarios_defecto(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  perform set_config('app.tenant_id', p_tenant::text, true);
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and nombre = 'Técnico') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Técnico', 'tecnico', 'PROPIETARIO', crypt('1212', gen_salt('bf')), crypt('1212', gen_salt('bf')), true);
  end if;
  update public.app_user
    set pin_hash = crypt('1111', gen_salt('bf'))
    where tenant_id = p_tenant and rol = 'PROPIETARIO' and auth_user_id is not null and pin_hash is null;
end;
$$;
