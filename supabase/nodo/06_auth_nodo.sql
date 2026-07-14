-- 06 — LA AUTENTICACIÓN DEL NODO, SIN GOTRUE.
--
-- Se ejecuta al final de la instalación. Sólo existe en el nodo.
--
-- ─────────────────────────────────────────────────────────────────────────────
--  POR QUÉ SE VA GOTRUE
--
--  En el nodo, GoTrue no autenticaba a nadie: NOSOTROS ya validábamos el PIN del
--  camarero contra `app_user.clave_hash` (bcrypt, en `verificar_clave_operario`), y
--  luego montábamos una pantomima —crear un usuario falso con una contraseña aleatoria
--  y hacer login con él— sólo para que GoTrue nos FIRMARA un JWT.
--
--  Y ese notario costaba: un fork de Go parcheado por nosotros (SO_REUSEPORT no existe
--  en Windows) que hay que recompilar con cada aviso de seguridad, 50 MB en el
--  instalador, un proceso más que vigilar, y las DOS trampas del orden de instalación
--  (no crear auth.users antes; y que GoTrue pisaba auth.uid() dejando la RLS muda).
--
--  Ahora el gateway firma el token él mismo (apps/nodo/auth.mjs). Mismo secreto, mismo
--  formato, mismos claims: PostgREST no nota la diferencia y la RLS no se toca.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Las sesiones del nodo ────────────────────────────────────────────────────
--
-- Dos cosas viven aquí, y las dos se guardan HASHEADAS (nunca en claro): quien tenga
-- acceso a un volcado de la base no puede robar una sesión con él.
--
--   · `ticket`  — un vale de UN SOLO USO, que caduca en un minuto. Es lo que el TPV
--                 canjea por una sesión después de validar el PIN del camarero. Sustituye
--                 a la "contraseña aleatoria" que antes le pedíamos a GoTrue.
--   · `refresco`— el refresh token. ROTA en cada uso: si alguien roba uno usado, no vale.
create table if not exists public.nodo_sesion (
  id          uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_user(id) on delete cascade,

  ticket      text unique,          -- sha256 del vale de un solo uso
  refresco    text unique,          -- sha256 del refresh token vigente

  creada_at   timestamptz not null default now(),
  usada_at    timestamptz,
  expira_at   timestamptz not null default now() + interval '30 days'
);

comment on table public.nodo_sesion is
  'Sesiones del nodo (sustituye a GoTrue). Ticket de un solo uso y refresh token, ambos hasheados.';

create index if not exists idx_nodo_sesion_ticket   on public.nodo_sesion (ticket)   where ticket   is not null;
create index if not exists idx_nodo_sesion_refresco on public.nodo_sesion (refresco) where refresco is not null;

-- Sólo el servicio (service_role) las toca. Un camarero no puede leer sesiones ajenas.
alter table public.nodo_sesion enable row level security;
revoke all on public.nodo_sesion from anon, authenticated;

-- ── Validar la contraseña del DUEÑO, en local ────────────────────────────────
--
-- El backoffice entra con email + contraseña. Esa contraseña vivía SÓLO en el GoTrue de
-- la nube — por eso el dueño no podía abrir el panel del bar sin internet: ni para
-- cambiar un precio ni para ver la caja.
--
-- Ahora vive también aquí, en `app_user.password_hash` (una columna que existía y no
-- usaba nadie). La siembra el instalador, que ya le pide la contraseña al titular.
--
-- Espejo exacto de `verificar_clave_operario`, pero para los que SÍ tienen email.
create or replace function public.verificar_password_local(p_email text, p_password text)
returns table(id uuid, tenant_id uuid, nombre text, email text, rol text)
language sql
security definer
set search_path to 'public', 'extensions'
as $$
  select u.id, u.tenant_id, u.nombre, u.email, u.rol
    from app_user u
   where lower(u.email) = lower(trim(p_email))
     and u.activo
     and u.password_hash is not null
     and u.password_hash = crypt(p_password, u.password_hash)
   limit 1;
$$;

revoke all on function public.verificar_password_local(text, text) from public, anon, authenticated;
grant execute on function public.verificar_password_local(text, text) to service_role;

-- Poner/cambiar la contraseña local de un usuario con email. La usa el instalador (con
-- la contraseña que el titular acaba de teclear) y el panel del propio bar.
create or replace function public.fijar_password_local(p_email text, p_password text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare n int;
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña es demasiado corta';
  end if;

  update app_user
     set password_hash = crypt(p_password, gen_salt('bf'))   -- bcrypt, como el resto
   where lower(email) = lower(trim(p_email));

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.fijar_password_local(text, text) from public, anon, authenticated;
grant execute on function public.fijar_password_local(text, text) to service_role;
