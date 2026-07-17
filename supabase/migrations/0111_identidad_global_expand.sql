-- 0111 — Identidad global: EXPANSIÓN (F1 entrega 1.1; diseño aprobado en
-- docs/implementacion/20-diseno-sql-identidad-global.md).
--
-- Solo añade: ninguna columna, función ni política existente cambia. Los callers
-- actuales siguen funcionando igual hasta 0113 (switch). Idempotente.

-- ── cuenta global (1:1 con auth.users; pertenece a la PERSONA, no al tenant) ──
create table if not exists public.cuenta (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  nombre        text,
  estado        text not null default 'ACTIVA'
                constraint cuenta_estado_valido check (estado in ('ACTIVA','SUSPENDIDA')),
  -- F2: control server-side del cambio obligatorio (la metadata de GoTrue la
  -- puede editar el propio cliente; esta columna NO).
  debe_cambiar_password boolean not null default false,
  password_caduca_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── enlace de la membresía (app_user) a su cuenta; nullable en transición ─────
alter table public.app_user add column if not exists cuenta_id uuid references public.cuenta(id);
create index if not exists idx_app_user_cuenta on public.app_user (cuenta_id) where cuenta_id is not null;

-- ── contexto por sesión: tenant/local activos de CADA sesión del JWT ──────────
create table if not exists public.sesion_contexto (
  session_id   uuid primary key,
  cuenta_id    uuid not null references public.cuenta(id) on delete cascade,
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  app_user_id  uuid not null references public.app_user(id) on delete cascade,
  location_id  uuid references public.location(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index if not exists idx_sesion_contexto_cuenta on public.sesion_contexto (cuenta_id);

-- ── asignación por local (perfil + estado + vigencia) ─────────────────────────
create table if not exists public.app_user_local (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  app_user_id  uuid not null references public.app_user(id) on delete cascade,
  location_id  uuid not null references public.location(id) on delete cascade,
  perfil_id    uuid references public.perfil(id) on delete set null,
  estado       text not null default 'ACTIVA'
               constraint asignacion_estado_valido check (estado in ('ACTIVA','SUSPENDIDA','BAJA')),
  desde        date,
  hasta        date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (app_user_id, location_id)
);
create index if not exists idx_app_user_local_tenant on public.app_user_local (tenant_id, location_id);

-- ── override individual (solo PERMITIR/DENEGAR; sin fila = HEREDAR del perfil) ─
create table if not exists public.app_user_permiso (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  app_user_id  uuid not null references public.app_user(id) on delete cascade,
  location_id  uuid references public.location(id) on delete cascade, -- null = toda la empresa
  permiso      text not null,
  efecto       text not null constraint efecto_valido check (efecto in ('PERMITIR','DENEGAR')),
  unique (app_user_id, location_id, permiso)
);
create index if not exists idx_app_user_permiso_tenant on public.app_user_permiso (tenant_id, app_user_id);

-- ── registro de sesiones (inventario/revocación) y eventos de seguridad ───────
create table if not exists public.sesion_registro (
  session_id   uuid primary key,
  cuenta_id    uuid not null references public.cuenta(id) on delete cascade,
  creada_at    timestamptz not null default now(),
  ultima_vista timestamptz not null default now(),
  revocada_at  timestamptz,
  user_agent   text
);
create index if not exists idx_sesion_registro_cuenta on public.sesion_registro (cuenta_id);

create table if not exists public.evento_seguridad (
  id          bigint generated always as identity primary key,
  cuenta_id   uuid references public.cuenta(id) on delete set null,
  tenant_id   uuid references public.tenant(id) on delete set null,
  tipo        text not null,                       -- LOGIN_OK, CONTEXTO_CAMBIADO, SESION_REVOCADA…
  detalle     jsonb not null default '{}'::jsonb,  -- nunca contraseñas/PIN/tokens
  creado_at   timestamptz not null default now()
);
create index if not exists idx_evento_seguridad_cuenta on public.evento_seguridad (cuenta_id, creado_at);

-- ── RLS: fail-closed desde el nacimiento de cada tabla ────────────────────────
alter table public.cuenta enable row level security;
alter table public.cuenta force row level security;
drop policy if exists cuenta_propia on public.cuenta;
create policy cuenta_propia on public.cuenta
  for select using (auth_user_id = auth.uid());
-- escrituras: NADIE por RLS (solo funciones definer / service_role)

alter table public.sesion_contexto enable row level security;
alter table public.sesion_contexto force row level security;
drop policy if exists sesion_contexto_propia on public.sesion_contexto;
create policy sesion_contexto_propia on public.sesion_contexto
  for select using (cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid()));

alter table public.app_user_local enable row level security;
alter table public.app_user_local force row level security;
drop policy if exists app_user_local_select on public.app_user_local;
create policy app_user_local_select on public.app_user_local
  for select using (tenant_id = public.current_tenant_id());
drop policy if exists app_user_local_escribir on public.app_user_local;
create policy app_user_local_escribir on public.app_user_local
  for all using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'))
  with check (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'));

alter table public.app_user_permiso enable row level security;
alter table public.app_user_permiso force row level security;
drop policy if exists app_user_permiso_select on public.app_user_permiso;
create policy app_user_permiso_select on public.app_user_permiso
  for select using (tenant_id = public.current_tenant_id());
drop policy if exists app_user_permiso_escribir on public.app_user_permiso;
create policy app_user_permiso_escribir on public.app_user_permiso
  for all using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'))
  with check (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'));

alter table public.sesion_registro enable row level security;
alter table public.sesion_registro force row level security;
drop policy if exists sesion_registro_propia on public.sesion_registro;
create policy sesion_registro_propia on public.sesion_registro
  for select using (cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid()));

alter table public.evento_seguridad enable row level security;
alter table public.evento_seguridad force row level security;
drop policy if exists evento_seguridad_ver on public.evento_seguridad;
create policy evento_seguridad_ver on public.evento_seguridad
  for select using (
    cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid())
    or (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'))
  );

-- ── grants: anon fuera; authenticated solo lo que la RLS deja ver ─────────────
revoke all on public.cuenta, public.sesion_contexto, public.app_user_local,
              public.app_user_permiso, public.sesion_registro, public.evento_seguridad
  from public, anon;
grant select on public.cuenta, public.sesion_contexto, public.sesion_registro,
                public.evento_seguridad to authenticated;
grant select, insert, update, delete on public.app_user_local, public.app_user_permiso to authenticated;
grant all on public.cuenta, public.sesion_contexto, public.app_user_local,
             public.app_user_permiso, public.sesion_registro, public.evento_seguridad to service_role;
