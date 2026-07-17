-- 0117 — Emparejado v2 y operario activo (F4 entregas 4.1/4.3 núcleo + 4.4 parcial).
--
-- Mata cuatro males confirmados:
--  · el JWT de dispositivo de 365 días con secreto compartido no se podía revocar
--    → credencial ROTATORIA con hash server-side, expiración y revocación;
--  · no había registro de qué terminal tiene qué credencial → tabla + auditoría;
--  · 5 PIN mal en UN terminal bloqueaban a TODA la empresa (0054)
--    → intentos y bloqueo por TERMINAL;
--  · semillas con credenciales conocidas (tpv1/121212, admin/1111…)
--    → se retira la función rota y crear-empresa deja de sembrar operarios.
-- El JWT legacy sigue emitiéndose (más corto) hasta migrar los clientes (4.2/4.4).

-- ── A. Credencial de dispositivo v2 ──────────────────────────────────────────
create table if not exists public.credencial_dispositivo (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  device_id    uuid not null references public.device(id) on delete cascade,
  refresh_hash text not null unique,     -- sha256 hex; el secreto solo viaja al emitir/rotar
  emitida_at   timestamptz not null default now(),
  expira_at    timestamptz not null,
  revocada_at  timestamptz,
  version      int not null default 1
);
create index if not exists idx_credencial_dispositivo_activa
  on public.credencial_dispositivo (device_id) where revocada_at is null;

alter table public.credencial_dispositivo enable row level security;
alter table public.credencial_dispositivo force row level security;
drop policy if exists credencial_dispositivo_ver on public.credencial_dispositivo;
create policy credencial_dispositivo_ver on public.credencial_dispositivo
  for select using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'));
revoke all on public.credencial_dispositivo from public, anon;
grant select on public.credencial_dispositivo to authenticated;
grant all on public.credencial_dispositivo to service_role;

-- Emitir (tras el canje del código de 6 dígitos): revoca la anterior y crea la
-- nueva en una transacción. Solo el servidor.
create or replace function public.emitir_credencial_dispositivo(
  p_device uuid, p_refresh_hash text, p_dias int default 90
)
returns table (credencial_id uuid, expira_at timestamptz, version int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_version int;
begin
  select tenant_id into v_tenant from public.device where id = p_device;
  if v_tenant is null then
    raise exception 'dispositivo desconocido' using errcode = '42501';
  end if;
  update public.credencial_dispositivo
     set revocada_at = now()
   where device_id = p_device and revocada_at is null;
  select coalesce(max(cd.version), 0) + 1 into v_version
    from public.credencial_dispositivo cd where cd.device_id = p_device;
  return query
  insert into public.credencial_dispositivo (tenant_id, device_id, refresh_hash, expira_at, version)
  values (v_tenant, p_device, p_refresh_hash, now() + make_interval(days => greatest(p_dias, 1)), v_version)
  returning id, credencial_dispositivo.expira_at, credencial_dispositivo.version;
end $$;
revoke all on function public.emitir_credencial_dispositivo(uuid, text, int) from public, anon, authenticated;
grant execute on function public.emitir_credencial_dispositivo(uuid, text, int) to service_role;

-- Renovar (rotación): el secreto viejo se consume y nace uno nuevo, ATÓMICO.
-- Un refresh robado y ya rotado no vale; revocación efectiva ≤ vida del access.
create or replace function public.renovar_credencial_dispositivo(
  p_refresh_hash text, p_nuevo_hash text, p_dias int default 90
)
returns table (device_id uuid, tenant_id uuid, modulo text, nombre text, estacion text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cred public.credencial_dispositivo%rowtype;
begin
  update public.credencial_dispositivo cd
     set revocada_at = now()
   where cd.refresh_hash = p_refresh_hash
     and cd.revocada_at is null
     and cd.expira_at > now()
  returning cd.* into v_cred;
  if v_cred.id is null then
    return; -- inválido/rotado/revocado/caducado: sin filas
  end if;
  insert into public.credencial_dispositivo (tenant_id, device_id, refresh_hash, expira_at, version)
  values (v_cred.tenant_id, v_cred.device_id, p_nuevo_hash,
          now() + make_interval(days => greatest(p_dias, 1)), v_cred.version + 1);
  return query
    select d.id, d.tenant_id, d.modulo, d.nombre, d.estacion
    from public.device d where d.id = v_cred.device_id;
end $$;
revoke all on function public.renovar_credencial_dispositivo(text, text, int) from public, anon, authenticated;
grant execute on function public.renovar_credencial_dispositivo(text, text, int) to service_role;

-- ── B. Sesión de operario por terminal (una activa por aparato) ──────────────
create table if not exists public.sesion_operario (
  device_id        uuid primary key references public.device(id) on delete cascade,
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  app_user_id      uuid not null references public.app_user(id) on delete cascade,
  desde            timestamptz not null default now(),
  ultima_actividad timestamptz not null default now()
);
alter table public.sesion_operario enable row level security;
alter table public.sesion_operario force row level security;
drop policy if exists sesion_operario_tenant on public.sesion_operario;
create policy sesion_operario_tenant on public.sesion_operario
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id()
              and exists (select 1 from public.device d where d.id = device_id and d.tenant_id = public.current_tenant_id())
              and exists (select 1 from public.app_user u where u.id = app_user_id and u.tenant_id = public.current_tenant_id()));
revoke all on public.sesion_operario from public, anon;
grant select, insert, update, delete on public.sesion_operario to authenticated;
grant all on public.sesion_operario to service_role;

-- ── C. PIN: intentos y bloqueo por TERMINAL, no por empresa ──────────────────
create table if not exists public.pin_intento (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  device_id       uuid references public.device(id) on delete cascade, -- null = canal sin terminal (web/legacy)
  intentos        int not null default 0,
  bloqueado_hasta timestamptz,
  updated_at      timestamptz not null default now()
);
create unique index if not exists idx_pin_intento_terminal
  on public.pin_intento (tenant_id, device_id) where device_id is not null;
create unique index if not exists idx_pin_intento_sin_terminal
  on public.pin_intento (tenant_id) where device_id is null;
alter table public.pin_intento enable row level security;
alter table public.pin_intento force row level security;
-- Nadie lee/escribe por PostgREST: solo las funciones definer.
revoke all on public.pin_intento from public, anon, authenticated;
grant all on public.pin_intento to service_role;

-- validar_pin_terminal: como validar_pin pero el backoff es del TERMINAL que
-- falla. Un atacante en la comandera no deja sin PIN al resto del bar.
create or replace function public.validar_pin_terminal(p_pin text, p_device uuid default null)
returns table (id uuid, nombre text, rol text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_fila   public.pin_intento%rowtype;
  v_id     uuid;
  v_nombre text;
  v_rol    text;
begin
  if v_tenant is null then return; end if;
  -- El terminal declarado tiene que ser del tenant (un id inventado no crea canal).
  if p_device is not null and not exists (
      select 1 from public.device d where d.id = p_device and d.tenant_id = v_tenant) then
    return;
  end if;

  -- Canal de intentos (por terminal, o el canal "sin terminal") con candado.
  insert into public.pin_intento (tenant_id, device_id)
  values (v_tenant, p_device)
  on conflict do nothing;
  select * into v_fila from public.pin_intento
   where tenant_id = v_tenant and device_id is not distinct from p_device
   for update;

  -- Backoff vigente: mismo resultado que un PIN erróneo (no se filtra cuál es).
  if v_fila.bloqueado_hasta > now() then return; end if;

  select u.id, u.nombre, u.rol into v_id, v_nombre, v_rol
  from public.app_user u
  where u.tenant_id = v_tenant
    and u.activo
    and u.pin_hash is not null
    and u.pin_hash = crypt(p_pin, u.pin_hash)
  limit 1;

  if v_id is not null then
    update public.pin_intento set intentos = 0, bloqueado_hasta = null, updated_at = now()
     where pin_intento.id = v_fila.id;
    id := v_id; nombre := v_nombre; rol := v_rol;
    return next;
    return;
  end if;

  -- Fallo: backoff creciente desde el 5º (1, 2, 3… minutos), tope 15.
  update public.pin_intento
     set intentos = v_fila.intentos + 1,
         bloqueado_hasta = case when v_fila.intentos + 1 >= 5
           then now() + make_interval(mins => least(v_fila.intentos + 1 - 4, 15)) end,
         updated_at = now()
   where pin_intento.id = v_fila.id;
  return;
end $$;
revoke all on function public.validar_pin_terminal(text, uuid) from public, anon;
grant execute on function public.validar_pin_terminal(text, uuid) to authenticated, service_role;

-- validar_pin (firma histórica): pasa por el mecanismo nuevo con el canal "sin
-- terminal". El bloqueo deja de tocar las filas de app_user y de ser de empresa
-- completa en cuanto los TPV pasen su device_id.
create or replace function public.validar_pin(p_pin text)
returns table (id uuid, nombre text, rol text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.validar_pin_terminal(p_pin, null);
$$;
revoke all on function public.validar_pin(text) from public, anon;
grant execute on function public.validar_pin(text) to authenticated;

-- ── D. 4.4 parcial: fuera la función rota y las credenciales sembradas ───────
-- `admin_sembrar_terminal_defecto` (0107) referencia columnas de 0105 que no
-- existen: fallaba SIEMPRE. Sin callers desde el 17-07. Retirada idempotente.
drop function if exists public.admin_sembrar_terminal_defecto(uuid);
-- `admin_sembrar_operarios_defecto` (tecnico/1212, admin/1111…) deja de llamarse
-- desde crear-empresa (mismo día). La función se retirará cuando no quede ningún
-- despliegue que la invoque (F4.4 final), para no romper la ventana de compat.
