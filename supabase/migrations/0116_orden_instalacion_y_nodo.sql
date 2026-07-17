-- 0116 — Orden de instalación y nodo (F3 entregas 3.1–3.2, núcleo SQL; plan 14 §7).
--
-- Sustituye la AUTORIDAD de `tenant.codigo_instalacion` (código eterno, reutilizable,
-- en claro) por una ORDEN por local: hash del código (nunca en claro), caducidad de
-- 30 días, reserva de 24 h ligada a un intento, un solo uso, revocación y auditoría.
-- El canje registra la instancia del nodo (clave pública si el instalador la manda).
-- COMPAT: el flujo legacy sigue vivo en /api/instalacion/activar hasta F3.4; esta
-- migración solo añade.

create table if not exists public.orden_instalacion (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  location_id  uuid not null references public.location(id) on delete cascade,
  codigo_hash  text not null unique,   -- sha256 hex del código largo; el claro solo viaja una vez
  estado       text not null default 'EMITIDA'
               constraint orden_estado_valido check (estado in ('EMITIDA','RESERVADA','CANJEADA','CADUCADA','REVOCADA')),
  emitida_por  uuid references public.cuenta(id) on delete set null,
  expira_at    timestamptz not null default now() + interval '30 days',
  reserva_hash text,                    -- intento en curso (hash del token del instalador)
  reservada_at timestamptz,
  canjeada_at  timestamptz,
  nodo_id      uuid,                    -- FK al final (la tabla nodo aún no existe)
  revocada_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_orden_instalacion_tenant on public.orden_instalacion (tenant_id, estado);

create table if not exists public.nodo_instancia (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  location_id    uuid not null references public.location(id) on delete cascade,
  orden_id       uuid references public.orden_instalacion(id) on delete set null,
  clave_publica  text,                  -- la genera el instalador; puede faltar en nodos legacy
  fingerprint    text unique,
  version        text,
  plataforma     text,
  estado         text not null default 'ACTIVO'
                 constraint nodo_estado_valido check (estado in ('ACTIVO','REVOCADO')),
  reemplaza_a    uuid references public.nodo_instancia(id) on delete set null,
  ultimo_contacto timestamptz,
  revocado_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_nodo_instancia_tenant on public.nodo_instancia (tenant_id, location_id);

alter table public.orden_instalacion
  drop constraint if exists orden_instalacion_nodo_fk;
alter table public.orden_instalacion
  add constraint orden_instalacion_nodo_fk
  foreign key (nodo_id) references public.nodo_instancia(id) on delete set null;

-- ── RLS: el admin del tenant VE sus órdenes y nodos; escribe solo el servidor ─
alter table public.orden_instalacion enable row level security;
alter table public.orden_instalacion force row level security;
drop policy if exists orden_instalacion_ver on public.orden_instalacion;
create policy orden_instalacion_ver on public.orden_instalacion
  for select using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'));

alter table public.nodo_instancia enable row level security;
alter table public.nodo_instancia force row level security;
drop policy if exists nodo_instancia_ver on public.nodo_instancia;
create policy nodo_instancia_ver on public.nodo_instancia
  for select using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.usuarios'));

revoke all on public.orden_instalacion, public.nodo_instancia from public, anon;
grant select on public.orden_instalacion, public.nodo_instancia to authenticated;
grant all on public.orden_instalacion, public.nodo_instancia to service_role;

-- ── Canje ATÓMICO de la orden (la llama /api/instalacion/activar con service) ─
-- Máquina de estados completa en una transacción, con reanudación:
--   EMITIDA vigente                         → RESERVADA+CANJEADA, crea nodo → OK
--   RESERVADA por el MISMO intento (<24 h)  → CANJEADA (reanudación)        → OK
--   RESERVADA por OTRO intento    (>24 h)   → la reserva caducó: se la queda → OK
--   RESERVADA por OTRO intento    (<24 h)   → RESERVADA_OTRO (no se pisa)
--   EMITIDA caducada                        → se marca CADUCADA → CADUCADA
--   CANJEADA / REVOCADA / inexistente       → INVALIDA
create or replace function public.canjear_orden_instalacion(
  p_codigo_hash  text,
  p_reserva_hash text,
  p_clave_publica text default null,
  p_fingerprint  text default null,
  p_version      text default null,
  p_plataforma   text default null
)
returns table (resultado text, tenant_id uuid, location_id uuid, nodo_id uuid, empresa text, local text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orden_instalacion%rowtype;
  v_nodo uuid;
begin
  select * into o from public.orden_instalacion
   where codigo_hash = p_codigo_hash
   for update;

  if not found or o.estado in ('CANJEADA','REVOCADA','CADUCADA') then
    return query select 'INVALIDA'::text, null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  if o.estado = 'EMITIDA' and o.expira_at < now() then
    update public.orden_instalacion set estado = 'CADUCADA' where id = o.id;
    return query select 'CADUCADA'::text, null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  if o.estado = 'RESERVADA'
     and o.reserva_hash is distinct from p_reserva_hash
     and o.reservada_at > now() - interval '24 hours' then
    return query select 'RESERVADA_OTRO'::text, null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  insert into public.nodo_instancia (tenant_id, location_id, orden_id, clave_publica, fingerprint, version, plataforma, ultimo_contacto)
  values (o.tenant_id, o.location_id, o.id, p_clave_publica, p_fingerprint, p_version, p_plataforma, now())
  returning id into v_nodo;

  update public.orden_instalacion
     set estado = 'CANJEADA',
         reserva_hash = p_reserva_hash,
         reservada_at = coalesce(reservada_at, now()),
         canjeada_at = now(),
         nodo_id = v_nodo
   where id = o.id;

  return query
    select 'OK'::text, o.tenant_id, o.location_id, v_nodo,
           (select t.nombre from public.tenant t where t.id = o.tenant_id),
           (select l.nombre from public.location l where l.id = o.location_id);
end $$;
revoke all on function public.canjear_orden_instalacion(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.canjear_orden_instalacion(text, text, text, text, text, text) to service_role;
