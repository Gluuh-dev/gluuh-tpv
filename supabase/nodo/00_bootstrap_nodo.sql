-- ═══════════════════════════════════════════════════════════════════════════
--  BOOTSTRAP DEL NODO LOCAL — lo que Supabase REGALA y un Postgres pelado no tiene.
--
--  Descubierto el 13-07-2026 al aplicar las migraciones a un Postgres vacío: las
--  migraciones de `supabase/migrations/` NO son autocontenidas. Dan por hechos
--  objetos de la PLATAFORMA Supabase que no existen en PostgreSQL a secas:
--
--    · Los roles `anon`, `authenticated`, `service_role` (41 GRANTs los usan).
--    · El esquema `auth`: la tabla `auth.users` (7 migraciones la referencian por
--      clave foránea) y la función `auth.uid()`, de la que depende el CORAZÓN de
--      la RLS — `current_tenant_id()` (0002) cae a `auth.uid()` como último recurso.
--    · El esquema `storage` (solo lo usa 0010, y el nodo NO usa Supabase Storage).
--
--  Este script se ejecuta UNA VEZ, sobre el Postgres vacío del nodo, ANTES de las
--  migraciones de la app. Es parte del instalador (guía 16, Fase 2.3).
--
--  ORDEN REAL EN EL NODO:
--    1) este bootstrap  →  2) arrancar GoTrue (crea/completa `auth.users` con SU
--       esquema)  →  3) aplicar supabase/migrations/*.sql en orden.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Roles que espera PostgREST (y que usan los GRANT de las migraciones) ──
-- PostgREST se conecta como `authenticator` y hace SET ROLE al rol del JWT.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    -- La contraseña la fija el instalador del nodo (aquí, una de desarrollo).
    create role authenticator login noinherit password 'authenticator_dev';
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;

-- ── 2. Esquema `auth` ────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- AQUÍ NO SE CREA `auth.users` NI `auth.uid()`. Es deliberado, y costó averiguarlo:
--
--   · `auth.users` la crea GoTrue con su propio automigrate. Si la creamos antes,
--     su `CREATE TABLE IF NOT EXISTS` la ve y NO la crea… pero luego indexa columnas
--     que nuestro esbozo no tiene → «column "instance_id" does not exist» y GoTrue
--     no arranca.
--
--   · Peor: la migración `00_init_auth_schema` de GoTrue hace
--     `create or replace function auth.uid()` usando `request.jwt.claim.sub`
--     (la forma ANTIGUA, singular). PostgREST moderno publica `request.jwt.claims`
--     (plural, JSON). Si GoTrue se ejecuta DESPUÉS de definir nosotros auth.uid(),
--     la pisa con una versión que devuelve NULL → `current_tenant_id()` = NULL →
--     **toda la RLS multi-tenant deja de ver nada**, en silencio.
--
-- Por eso el orden de instalación es:
--     1) este fichero            (roles, esquema auth vacío, pgcrypto, publicación…)
--     2) arrancar GoTrue         (crea auth.users y pisa auth.uid)
--     3) 01_despues_de_gotrue.sql (vuelve a poner auth.uid/role/jwt BIEN)
--     4) las migraciones 0001…   (sus FK a auth.users ya resuelven)

-- `supabase_auth_admin`: el rol con el que el servicio de Auth ejecuta el hook del
-- token (0011 le hace GRANT EXECUTE). GoTrue se conecta con él.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login noinherit password 'auth_admin_dev';
  end if;
end $$;
grant usage on schema auth to supabase_auth_admin;
grant all on all tables in schema auth to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth, public;

-- OJO: con GRANT no basta. GoTrue arranca con GOTRUE_DB_AUTOMIGRATE y sus migraciones
-- hacen `comment on table auth.users`, `alter table`… — eso exige ser **DUEÑO**, no
-- tener permisos. Como este bootstrap crea `auth.users` (y auth.uid/role/jwt) siendo
-- `postgres`, hay que traspasarle la propiedad de todo el esquema o GoTrue muere al
-- arrancar con: «must be owner of table users (SQLSTATE 42501)».
alter schema auth owner to supabase_auth_admin;

do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'auth' and c.relkind in ('r', 'v', 'S')
  loop
    execute format(
      'alter %s auth.%I owner to supabase_auth_admin',
      case r.relkind when 'r' then 'table' when 'v' then 'view' else 'sequence' end,
      r.relname);
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'auth'
  loop
    execute format('alter function auth.%I(%s) owner to supabase_auth_admin', r.proname, r.args);
  end loop;
end $$;

-- ── 3. `pgcrypto`: bcrypt de los PIN/claves de operario (validar_pin, 0007) ───
create extension if not exists pgcrypto with schema public;

-- ── 4. Publicación `supabase_realtime` ───────────────────────────────────────
-- 3 migraciones (0006, 0081, 0097) hacen `alter publication supabase_realtime add
-- table ...`. En Supabase la publicación viene creada de fábrica; en Postgres pelado
-- no existe y esas migraciones petan.
--
-- El nodo NO usa el Realtime de Supabase (usa LISTEN/NOTIFY + WebSocket propio),
-- pero la publicación se crea IGUAL: así las migraciones se aplican SIN TOCARLAS y
-- el esquema del nodo converge con el de la nube. Una publicación vacía no cuesta
-- nada (y de hecho deja la puerta abierta a usar replicación lógica más adelante).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ── 5. Esquema `storage` (STUB) ──────────────────────────────────────────────
-- Solo lo usa 0010 (crea el bucket `media` y sus políticas RLS). El nodo NO usa
-- Supabase Storage —sirve las fotos de una carpeta en disco (plan 10 §3.1)— pero se
-- crea el stub para que 0010 aplique SIN MODIFICARLA y el esquema converja.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to authenticated, service_role;

-- `storage.foldername('tenant/productos/x.webp')` → {tenant,productos}
-- (0010 la usa para acotar cada empresa a SU carpeta).
-- (misma implementación que la de Supabase, para que se comporte idéntico)
create or replace function storage.foldername(name text) returns text[]
  language plpgsql immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
