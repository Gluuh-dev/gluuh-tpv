-- 0115 — Invitaciones y alta del Titular (F2 entregas 2.1–2.2, núcleo SQL).
--
-- El alta deja de entregar contraseñas por canales inseguros: se emite una
-- INVITACIÓN de un solo uso (token de alta entropía; aquí solo vive su hash
-- SHA-256, calculado por el servidor web — la BD nunca ve el token). Aceptar =
-- verificar email + crear contraseña propia + crear/enlazar cuenta global.
-- Una cuenta existente acepta una nueva membresía SIN otra contraseña.

-- ── estado del alta de la empresa (máquina de estados del plan 14 §6) ─────────
alter table public.tenant add column if not exists estado_alta text not null default 'ACTIVA';
alter table public.tenant drop constraint if exists tenant_estado_alta_valido;
alter table public.tenant add constraint tenant_estado_alta_valido check (estado_alta in (
  'EMPRESA_PENDIENTE','INVITACION_EMITIDA','EMAIL_VERIFICADO','PASSWORD_CAMBIADA',
  'PIN_TITULAR_CREADO','ACTIVA','CADUCADA','REVOCADA'
));

-- ── invitaciones ──────────────────────────────────────────────────────────────
create table if not exists public.invitacion (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  email        text not null,
  nombre       text,
  rol          text not null default 'ENCARGADO'
               constraint invitacion_rol_valido check (rol in ('PROPIETARIO','ENCARGADO','CAMARERO','COCINA')),
  perfil_id    uuid references public.perfil(id) on delete set null,
  es_titular   boolean not null default false,   -- alta inicial de la empresa
  token_hash   text not null unique,             -- sha256 hex; el token en claro nunca se persiste
  estado       text not null default 'EMITIDA'
               constraint invitacion_estado_valido check (estado in ('EMITIDA','ACEPTADA','REVOCADA')),
  emitida_por  uuid references public.cuenta(id) on delete set null,
  expira_at    timestamptz not null default now() + interval '7 days',
  aceptada_at  timestamptz,
  cuenta_id    uuid references public.cuenta(id) on delete set null, -- quién la aceptó
  created_at   timestamptz not null default now()
);
create index if not exists idx_invitacion_tenant on public.invitacion (tenant_id, estado);

-- Una sola invitación EMITIDA por email y empresa (reemitir = revocar + emitir).
create unique index if not exists idx_invitacion_pendiente_unica
  on public.invitacion (tenant_id, lower(email)) where (estado = 'EMITIDA');

-- ── RLS: los admin del tenant la VEN (sin token_hash útil: es un hash);
--         escribir solo puede el servidor (service_role) ──────────────────────
alter table public.invitacion enable row level security;
alter table public.invitacion force row level security;
drop policy if exists invitacion_ver on public.invitacion;
create policy invitacion_ver on public.invitacion
  for select using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'));

revoke all on public.invitacion from public, anon;
grant select on public.invitacion to authenticated;
grant all on public.invitacion to service_role;

-- ── transición de estados atómica para el canje (la usa el route con service) ─
-- Devuelve la invitación si y solo si estaba EMITIDA y sin caducar; la marca
-- ACEPTADA en el mismo paso (un solo uso real, sin carrera).
create or replace function public.canjear_invitacion(p_token_hash text, p_cuenta uuid)
returns setof public.invitacion
language sql
security definer
set search_path = ''
as $$
  update public.invitacion i
     set estado = 'ACEPTADA', aceptada_at = now(), cuenta_id = p_cuenta
   where i.token_hash = p_token_hash
     and i.estado = 'EMITIDA'
     and i.expira_at > now()
  returning i.*;
$$;
revoke all on function public.canjear_invitacion(text, uuid) from public, anon, authenticated;
grant execute on function public.canjear_invitacion(text, uuid) to service_role;
