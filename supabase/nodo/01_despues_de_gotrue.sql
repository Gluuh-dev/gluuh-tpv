-- 01 — LO QUE HAY QUE PONER **DESPUÉS** DE ARRANCAR GOTRUE POR PRIMERA VEZ.
--
-- Se ejecuta entre el paso 2 y el 4 de la instalación del nodo:
--
--     1) 00_bootstrap_nodo.sql   (roles, esquema auth vacío, pgcrypto, publicación…)
--     2) arrancar gotrue.exe     (automigrate: crea auth.users, auth.refresh_tokens…)
--  →  3) ESTE FICHERO
--     4) migraciones 0001…00NN   (sus FK a auth.users ya resuelven)
--
-- ¿Por qué hace falta? Porque la migración `00_init_auth_schema` de GoTrue hace:
--
--     create or replace function auth.uid() returns uuid as $$
--       select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
--     $$ language sql stable;
--
-- Eso es la forma **ANTIGUA** (`request.jwt.claim.sub`, singular). PostgREST moderno
-- NO publica esa variable: publica `request.jwt.claims` (plural, el JWT entero en JSON).
-- Resultado si nos quedamos con la de GoTrue: `auth.uid()` devuelve siempre NULL →
-- `current_tenant_id()` (0002_auth.sql) devuelve NULL → **la RLS multi-tenant no
-- devuelve NADA a nadie**. Y lo hace en silencio: sin error, solo tablas vacías.
--
-- Así que la volvemos a definir bien, encima de la suya.

-- `auth.uid()`: el usuario del JWT. De ella cuelga TODA la RLS multi-tenant.
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

-- PostgREST necesita LEER auth.users (el esquema es de supabase_auth_admin).
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- Comprobación: si esto no devuelve la forma «plural», la RLS estará muerta.
do $$
declare fuente text;
begin
  select pg_get_functiondef('auth.uid()'::regprocedure) into fuente;
  if fuente not like '%request.jwt.claims%' then
    raise exception 'auth.uid() sigue con la versión de GoTrue: la RLS no devolverá nada';
  end if;
  raise notice 'auth.uid() correcta (request.jwt.claims) — la RLS puede resolver el tenant';
end $$;
