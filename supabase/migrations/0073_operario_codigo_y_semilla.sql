-- 0073 · Código de operario legible + operarios por defecto (SA2, parcial).
-- `codigo`: identificador corto (número) del operario, estilo Ágora (nombre + número),
-- único por tenant; base del futuro login local por código+clave. Se autogenera por
-- trigger. Además, semilla de operarios por defecto (técnico 1212 / admin 1111).

-- 1) Columna + unicidad por tenant.
alter table app_user add column if not exists codigo text;
create unique index if not exists idx_app_user_codigo on app_user(tenant_id, codigo) where codigo is not null;

-- 2) Autogeneración del código (5 dígitos únicos por tenant) en cada alta.
create or replace function set_codigo_operario()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_cod text;
begin
  if new.codigo is null and new.tenant_id is not null then
    loop
      v_cod := lpad((floor(random()*90000)+10000)::int::text, 5, '0');
      exit when not exists (select 1 from app_user where tenant_id = new.tenant_id and codigo = v_cod);
    end loop;
    new.codigo := v_cod;
  end if;
  return new;
end;
$$;
drop trigger if exists zz_set_codigo_operario on app_user;
create trigger zz_set_codigo_operario before insert on app_user
  for each row execute function set_codigo_operario();

-- 3) Backfill de operarios existentes sin código.
do $$
declare r record; v_cod text;
begin
  for r in select id, tenant_id from app_user where codigo is null and tenant_id is not null loop
    loop
      v_cod := lpad((floor(random()*90000)+10000)::int::text, 5, '0');
      exit when not exists (select 1 from app_user where tenant_id = r.tenant_id and codigo = v_cod);
    end loop;
    update app_user set codigo = v_cod where id = r.id;
  end loop;
end $$;

-- 4) listar_operarios ahora incluye el código (lista del TPV). DROP por cambio de tipo.
drop function if exists listar_operarios();
create function listar_operarios()
returns table(id uuid, nombre text, rol text, codigo text)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select id, nombre, rol, codigo
  from public.app_user
  where tenant_id = public.current_tenant_id()
    and activo
    and pin_hash is not null
  order by nombre;
$$;
grant execute on function listar_operarios() to authenticated;

-- 5) Semilla de operarios por defecto (solo service_role). Técnico (TPV, acceso
--    total) con PIN 1212 y, al dueño sin PIN, PIN 1111. Ambos cambiables.
create or replace function admin_sembrar_operarios_defecto(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  perform set_config('app.tenant_id', p_tenant::text, true);
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and nombre = 'Técnico') then
    insert into public.app_user (tenant_id, nombre, rol, pin_hash, activo)
    values (p_tenant, 'Técnico', 'PROPIETARIO', crypt('1212', gen_salt('bf')), true);
  end if;
  update public.app_user
    set pin_hash = crypt('1111', gen_salt('bf'))
    where tenant_id = p_tenant and rol = 'PROPIETARIO' and auth_user_id is not null and pin_hash is null;
end;
$$;
revoke all on function admin_sembrar_operarios_defecto(uuid) from public, authenticated;
grant execute on function admin_sembrar_operarios_defecto(uuid) to service_role;
