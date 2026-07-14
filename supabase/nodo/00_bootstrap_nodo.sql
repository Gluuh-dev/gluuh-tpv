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

-- En Supabase, `service_role` puede con todo: ellos le dan permisos sobre cada tabla.
-- En un Postgres pelado NO: cada tabla que cree una migración nace SIN permisos para él,
-- y el sincronizador (que se conecta con esa clave) se come un
-- «permission denied for table X» en cuanto añadimos una tabla.
--
-- Con ALTER DEFAULT PRIVILEGES, todo lo que cree `postgres` a partir de ahora —o sea,
-- las 100 migraciones y las que vengan con cada actualización— ya nace con los permisos
-- puestos. Sin esto habría que acordarse de un GRANT por cada tabla nueva, para siempre.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- ── 2. Esquema `auth` ────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- ── `auth.users`, `auth.uid()` y compañía ────────────────────────────────────
--
-- Ya se pueden crear AQUÍ, y esto es una historia con final feliz.
--
-- Mientras hubo GoTrue en el nodo, no se podía: las creaba él con su automigrate y
-- montaba dos trampas que costaron horas encontrar.
--   · Si las creábamos antes, su `CREATE TABLE IF NOT EXISTS` veía la tabla, no la
--     creaba… y luego indexaba columnas que nuestro esbozo no tenía → GoTrue no arrancaba.
--   · Peor: su migración pisaba `auth.uid()` con la forma ANTIGUA
--     (`request.jwt.claim.sub`), que PostgREST ya no publica → `current_tenant_id()` a
--     NULL → **toda la RLS devolvía CERO filas a todo el mundo, en silencio**.
--
-- GoTrue se fue (ahora firma `apps/nodo/auth.mjs`). Nadie pisa nada. El orden de
-- instalación vuelve a ser el evidente: esto, y luego las migraciones.
--
-- `auth.users` se conserva porque las migraciones tienen claves foráneas hacia ella
-- (`app_user.auth_user_id`). En el nodo queda vacía: los empleados viven en `app_user`,
-- que es donde estaban de verdad desde el principio.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb,          -- la lee el trigger handle_new_user (0002)
  created_at         timestamptz default now()
);

-- `auth.uid()`: el usuario del JWT. De ella cuelga `current_tenant_id()` (0002) y con
-- ella, TODA la RLS multi-tenant. `request.jwt.claims` (plural) es lo que publica
-- PostgREST; la forma singular es la vieja y devuelve NULL.
create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
  language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')::text
$$;

create or replace function auth.jwt() returns jsonb
  language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt()
  to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- `supabase_auth_admin`: el rol existe SÓLO porque la migración 0011 le hace un
-- GRANT EXECUTE sobre el hook del token (y esa migración es compartida con la nube, donde
-- sí hay GoTrue). En el nodo ya no se conecta nadie con él: no tiene login.
--
-- Y ya no hace falta traspasarle la propiedad del esquema `auth`. Eso existía porque las
-- migraciones de GoTrue hacían `comment on table auth.users` y eso exige ser DUEÑO, no
-- tener permisos: sin el traspaso, GoTrue moría al arrancar con «must be owner of table
-- users». Se fue GoTrue, se fue el traspaso, se fue el problema.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end $$;
grant usage on schema auth to supabase_auth_admin;

-- ── 2-bis. La cuenta de qué migraciones se han aplicado ya ───────────────────
--
-- Hace falta porque **las migraciones NO son idempotentes**: `0001_init.sql` hace
-- `create table tenant` a secas, sin `if not exists`. Sobre una base vacía va bien —por
-- eso el instalador puede lanzarlas todas—, pero una ACTUALIZACIÓN que las reaplicara
-- todas se estrellaría con «relation "tenant" already exists» y volvería atrás sin
-- instalar nada. Nunca se actualizaría un bar.
--
-- Así que se anota cuál se ha aplicado, y el actualizador sólo pasa las nuevas.
create table if not exists public.nodo_migracion (
  fichero    text primary key,
  aplicada_at timestamptz not null default now()
);

comment on table public.nodo_migracion is
  'Migraciones ya aplicadas en este nodo. El actualizador sólo pasa las que faltan.';

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
