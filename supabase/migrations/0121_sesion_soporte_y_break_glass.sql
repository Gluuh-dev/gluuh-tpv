-- 0121 — Sesiones de soporte y break-glass (F5 entrega 5.3; plan 14 §9).
--
-- Reglas del plan que este modelo hace IMPOSIBLES de saltar:
--  · el soporte normal requiere CONSENTIMIENTO del cliente (PENDIENTE→APROBADA);
--  · break-glass exige MFA (aal2) y motivo, y AVISA (evento de seguridad);
--  · máximo 2 horas — el CHECK lo impone, no una promesa;
--  · nunca autorrenovable: `hasta` no tiene UPDATE; caducada = abrir otra
--    (que vuelve a pedir consentimiento/MFA y deja su propio rastro);
--  · toda apertura/aprobación/revocación queda en evento_seguridad.
-- El ENFORCEMENT de lectura (qué ve una sesión de soporte) llega con la
-- Gestión remota; este es el modelo y su auditoría — sin él no hay nada que
-- enforcar.

create table if not exists public.sesion_soporte (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  cuenta_soporte uuid not null references public.cuenta(id) on delete cascade, -- personal Gluuh
  tipo          text not null default 'SOPORTE'
                constraint soporte_tipo_valido check (tipo in ('SOPORTE','BREAK_GLASS')),
  motivo        text not null,
  estado        text not null default 'PENDIENTE'
                constraint soporte_estado_valido check (estado in ('PENDIENTE','APROBADA','REVOCADA','CADUCADA')),
  aprobada_por  uuid references public.cuenta(id) on delete set null,  -- el titular que consintió
  desde         timestamptz not null default now(),
  hasta         timestamptz not null,
  revocada_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint soporte_maximo_dos_horas check (hasta <= desde + interval '2 hours')
);
create index if not exists idx_sesion_soporte_tenant on public.sesion_soporte (tenant_id, estado);

alter table public.sesion_soporte enable row level security;
alter table public.sesion_soporte force row level security;
drop policy if exists sesion_soporte_ver on public.sesion_soporte;
-- El cliente VE las sesiones de soporte de su empresa (transparencia); el
-- personal Gluuh ve las suyas.
create policy sesion_soporte_ver on public.sesion_soporte
  for select using (
    tenant_id = public.current_tenant_id()
    or cuenta_soporte = (select c.id from public.cuenta c where c.auth_user_id = auth.uid())
  );
revoke all on public.sesion_soporte from public, anon;
grant select on public.sesion_soporte to authenticated;
grant all on public.sesion_soporte to service_role;

-- ── Abrir (personal Gluuh) ────────────────────────────────────────────────────
create or replace function public.abrir_sesion_soporte(
  p_tenant uuid, p_motivo text, p_tipo text default 'SOPORTE', p_minutos int default 120
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta uuid;
  v_id     uuid;
  v_aal    text := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'aal';
begin
  if not public.es_admin_plataforma() then
    raise exception 'solo personal de la plataforma' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'el motivo es obligatorio' using errcode = '22023';
  end if;
  -- Break-glass: MFA en la sesión (aal2), sin excepciones.
  if p_tipo = 'BREAK_GLASS' and v_aal is distinct from 'aal2' then
    raise exception 'break-glass exige MFA (aal2)' using errcode = '42501';
  end if;
  select id into v_cuenta from public.cuenta where auth_user_id = auth.uid();
  if v_cuenta is null then
    raise exception 'la cuenta Gluuh no está enlazada' using errcode = '42501';
  end if;

  insert into public.sesion_soporte (tenant_id, cuenta_soporte, tipo, motivo, estado, hasta)
  values (p_tenant, v_cuenta, p_tipo, p_motivo,
          -- break-glass entra APROBADA (la emergencia no espera), pero AVISA;
          -- el soporte normal espera el consentimiento del titular.
          case when p_tipo = 'BREAK_GLASS' then 'APROBADA' else 'PENDIENTE' end,
          now() + make_interval(mins => least(greatest(p_minutos, 5), 120)))
  returning id into v_id;

  insert into public.evento_seguridad (cuenta_id, tenant_id, tipo, detalle)
  values (v_cuenta, p_tenant,
          case when p_tipo = 'BREAK_GLASS' then 'BREAK_GLASS_ABIERTO' else 'SOPORTE_SOLICITADO' end,
          jsonb_build_object('sesion', v_id, 'motivo', left(p_motivo, 200)));
  return v_id;
end $$;
revoke all on function public.abrir_sesion_soporte(uuid, text, text, int) from public, anon;
grant execute on function public.abrir_sesion_soporte(uuid, text, text, int) to authenticated;

-- ── Aprobar (el TITULAR del tenant) ──────────────────────────────────────────
create or replace function public.aprobar_sesion_soporte(p_sesion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta uuid;
  v_ses    public.sesion_soporte%rowtype;
begin
  select id into v_cuenta from public.cuenta where auth_user_id = auth.uid();
  select * into v_ses from public.sesion_soporte where id = p_sesion for update;
  if v_ses.id is null or v_ses.estado <> 'PENDIENTE' or v_ses.hasta < now() then
    raise exception 'sesión no aprobable' using errcode = '42501';
  end if;
  -- Solo un PROPIETARIO de esa empresa consiente.
  if not exists (
      select 1 from public.app_user u
       where u.cuenta_id = v_cuenta and u.tenant_id = v_ses.tenant_id
         and u.rol = 'PROPIETARIO' and u.activo) then
    raise exception 'solo el titular puede aprobar' using errcode = '42501';
  end if;
  update public.sesion_soporte set estado = 'APROBADA', aprobada_por = v_cuenta where id = p_sesion;
  insert into public.evento_seguridad (cuenta_id, tenant_id, tipo, detalle)
  values (v_cuenta, v_ses.tenant_id, 'SOPORTE_APROBADO', jsonb_build_object('sesion', p_sesion));
end $$;
revoke all on function public.aprobar_sesion_soporte(uuid) from public, anon;
grant execute on function public.aprobar_sesion_soporte(uuid) to authenticated;

-- ── Revocar (el titular O el propio soporte; en cualquier momento) ───────────
create or replace function public.revocar_sesion_soporte(p_sesion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta uuid;
  v_ses    public.sesion_soporte%rowtype;
  v_puede  boolean;
begin
  select id into v_cuenta from public.cuenta where auth_user_id = auth.uid();
  select * into v_ses from public.sesion_soporte where id = p_sesion for update;
  if v_ses.id is null or v_ses.estado in ('REVOCADA','CADUCADA') then return; end if;
  v_puede := v_ses.cuenta_soporte = v_cuenta
    or exists (select 1 from public.app_user u
                where u.cuenta_id = v_cuenta and u.tenant_id = v_ses.tenant_id
                  and u.rol = 'PROPIETARIO' and u.activo);
  if not v_puede then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  update public.sesion_soporte set estado = 'REVOCADA', revocada_at = now() where id = p_sesion;
  insert into public.evento_seguridad (cuenta_id, tenant_id, tipo, detalle)
  values (v_cuenta, v_ses.tenant_id, 'SOPORTE_REVOCADO', jsonb_build_object('sesion', p_sesion));
end $$;
revoke all on function public.revocar_sesion_soporte(uuid) from public, anon;
grant execute on function public.revocar_sesion_soporte(uuid) to authenticated;

-- ── ¿Hay soporte VIGENTE sobre este tenant? (para el enforcement futuro) ─────
create or replace function public.soporte_vigente(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sesion_soporte s
     where s.tenant_id = p_tenant
       and s.estado = 'APROBADA'
       and s.revocada_at is null
       and now() between s.desde and s.hasta
  );
$$;
revoke all on function public.soporte_vigente(uuid) from public, anon;
grant execute on function public.soporte_vigente(uuid) to authenticated, service_role;
