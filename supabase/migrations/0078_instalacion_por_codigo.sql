-- 0078 — Instalación por código de empresa + saneado de identidad.
-- Modelo: la empresa SOLO la crea Gluuh desde /admin. El alta genera un
-- código de instalación único (0000-0000-00000-0000-0000) que fija cada
-- instalación a su empresa; el login de operario se acota a ese tenant.
-- (Aplicada por MCP el 07-07-2026.)

-- 1) Código de instalación único por empresa -------------------------------
alter table public.tenant add column if not exists codigo_instalacion text;
create unique index if not exists tenant_codigo_instalacion_unico
  on public.tenant (codigo_instalacion) where codigo_instalacion is not null;

-- Backfill de las empresas existentes (dígitos aleatorios 4-4-5-4-4; la
-- unicidad la garantiza el índice — con colisión la migración fallaría y se relanza).
update public.tenant set codigo_instalacion =
  lpad(floor(random()*10000)::int::text, 4, '0') || '-' ||
  lpad(floor(random()*10000)::int::text, 4, '0') || '-' ||
  lpad(floor(random()*100000)::int::text, 5, '0') || '-' ||
  lpad(floor(random()*10000)::int::text, 4, '0') || '-' ||
  lpad(floor(random()*10000)::int::text, 4, '0')
where codigo_instalacion is null;

-- 2) El trigger de auth YA NO auto-crea empresas ----------------------------
-- Solo el alta real (crear-empresa manda empresa_nombre en metadata) provisiona
-- tenant. Cuentas sintéticas de operario (@codigo.gluuh.local), invitaciones o
-- cualquier otro signup NO crean empresa. (Raíz del bug del tenant fantasma.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tenant uuid; v_nombre text;
begin
  v_nombre := nullif(new.raw_user_meta_data->>'empresa_nombre', '');
  if v_nombre is null then
    return new;
  end if;

  insert into public.tenant (nombre, plan, email_admin)
  values (v_nombre, 'FREE', new.email) returning id into v_tenant;

  insert into public.app_user (tenant_id, nombre, email, rol, auth_user_id, activo)
  values (v_tenant, coalesce(nullif(new.raw_user_meta_data->>'nombre',''), new.email),
          new.email, 'PROPIETARIO', new.id, true);

  insert into public.location (tenant_id, nombre, cif, razon_social, territorio_fiscal, regimen_facturacion, serie_factura)
  values (v_tenant, v_nombre, 'PENDIENTE', v_nombre, 'PENINSULA_BALEARES', 'VERIFACTU', 'F');

  return new;
end;
$$;

-- 3) 1 cuenta auth = 1 usuario (no más duplicados) --------------------------
-- Tolerante: si aún existe el duplicado histórico, la migración avisa y sigue;
-- el índice se crea al limpiar (ver limpieza del tenant fantasma).
do $$
begin
  create unique index if not exists app_user_auth_user_id_unico
    on public.app_user (auth_user_id) where auth_user_id is not null;
exception when others then
  raise notice 'app_user_auth_user_id_unico pendiente (duplicados por limpiar): %', sqlerrm;
end $$;

-- 4) Login de operario ACOTADO a la empresa de la instalación ---------------
-- p_tenant null = comportamiento anterior (compat); con tenant, el operario
-- solo puede entrar en SU empresa aunque usuario+clave coincidan en otra.
drop function if exists public.verificar_clave_operario(text, text);
create or replace function public.verificar_clave_operario(p_usuario text, p_clave text, p_tenant uuid default null)
returns table(id uuid, tenant_id uuid, nombre text, codigo text, auth_user_id uuid)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select u.id, u.tenant_id, u.nombre, u.codigo, u.auth_user_id
  from app_user u
  where u.usr_app = normalizar_usr(p_usuario)
    and (p_tenant is null or u.tenant_id = p_tenant)
    and u.activo
    and u.email is null
    and u.clave_hash is not null
    and u.clave_hash = crypt(p_clave, u.clave_hash)
  limit 1;
$$;
revoke all on function public.verificar_clave_operario(text, text, uuid) from public, anon, authenticated;
grant execute on function public.verificar_clave_operario(text, text, uuid) to service_role;

-- 5) Siembra de ejemplo al crear la empresa ---------------------------------
-- Usuarios locales (admin/camarero/camarera con claves 1111/2222/3333,
-- cambiables) y un catálogo mínimo para que la instalación no arranque vacía.
-- El usuario "tecnico" (1212) lo siembra admin_sembrar_operarios_defecto (0073).
create or replace function public.admin_sembrar_ejemplo(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_beb uuid; v_coc uuid; v_pos uuid;
  c_beb uuid; c_coc uuid; c_pos uuid;
begin
  perform set_config('app.tenant_id', p_tenant::text, true);

  if not exists (select 1 from public.app_user where tenant_id = p_tenant and usr_app = 'admin') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Admin', 'admin', 'PROPIETARIO', crypt('1111', gen_salt('bf')), crypt('1111', gen_salt('bf')), true);
  end if;
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and usr_app = 'camarero') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Camarero', 'camarero', 'CAMARERO', crypt('2222', gen_salt('bf')), crypt('2222', gen_salt('bf')), true);
  end if;
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and usr_app = 'camarera') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Camarera', 'camarera', 'CAMARERO', crypt('3333', gen_salt('bf')), crypt('3333', gen_salt('bf')), true);
  end if;

  -- Catálogo de ejemplo solo si el tenant está vacío.
  if exists (select 1 from public.product where tenant_id = p_tenant) then return; end if;

  insert into public.family (tenant_id, nombre, orden, color) values (p_tenant, 'Bebidas', 1, '#3b82f6') returning id into v_beb;
  insert into public.family (tenant_id, nombre, orden, color) values (p_tenant, 'Cocina',  2, '#ef4444') returning id into v_coc;
  insert into public.family (tenant_id, nombre, orden, color) values (p_tenant, 'Postres', 3, '#f59e0b') returning id into v_pos;

  insert into public.category (tenant_id, nombre, orden, family_id, color) values (p_tenant, 'Bebidas', 1, v_beb, '#3b82f6') returning id into c_beb;
  insert into public.category (tenant_id, nombre, orden, family_id, color) values (p_tenant, 'Cocina',  2, v_coc, '#ef4444') returning id into c_coc;
  insert into public.category (tenant_id, nombre, orden, family_id, color) values (p_tenant, 'Postres', 3, v_pos, '#f59e0b') returning id into c_pos;

  insert into public.product (tenant_id, family_id, category_id, nombre, precio, tipo_impositivo, es_alcohol) values
    (p_tenant, v_beb, c_beb, 'Caña',              2.00, 10, true),
    (p_tenant, v_beb, c_beb, 'Refresco',          2.20, 10, false),
    (p_tenant, v_beb, c_beb, 'Agua',              1.50, 10, false),
    (p_tenant, v_beb, c_beb, 'Café',              1.30, 10, false),
    (p_tenant, v_coc, c_coc, 'Hamburguesa',       8.50, 10, false),
    (p_tenant, v_coc, c_coc, 'Bocadillo',         5.00, 10, false),
    (p_tenant, v_coc, c_coc, 'Ensalada',          7.00, 10, false),
    (p_tenant, v_coc, c_coc, 'Ración de patatas', 4.50, 10, false),
    (p_tenant, v_pos, c_pos, 'Tarta',             4.00, 10, false),
    (p_tenant, v_pos, c_pos, 'Helado',            3.50, 10, false);
end;
$$;
revoke all on function public.admin_sembrar_ejemplo(uuid) from public, anon, authenticated;
grant execute on function public.admin_sembrar_ejemplo(uuid) to service_role;
