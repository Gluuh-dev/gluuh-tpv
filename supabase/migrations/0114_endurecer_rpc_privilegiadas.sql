-- 0114 — Endurecer las RPC privilegiadas (F1 entrega 1.4; plan plans/017).
--
-- jornada_abierta / cerrar_jornada / device_heartbeat son SECURITY DEFINER y hoy
-- aceptan cualquier UUID sin comprobar tenant, con EXECUTE implícito de PUBLIC
-- (y heartbeat concedido a anon). Se recrean con la MISMA firma + guardia de
-- tenant + revokes. El nodo (proceso local, sin JWT) sigue funcionando: sus
-- conexiones directas no llevan claims y se consideran confiables.

-- Guardia común: ¿la petición viene de PostgREST con un JWT? Entonces el tenant
-- del recurso DEBE coincidir con current_tenant_id(). Las conexiones directas
-- del nodo (reloj, jornada automática) no llevan claims → confiables.
create or replace function public._exigir_tenant(v_tenant uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true), '') <> '' then
    if v_tenant is null or v_tenant is distinct from public.current_tenant_id() then
      raise exception 'no autorizado' using errcode = '42501';
    end if;
  end if;
end $$;
revoke all on function public._exigir_tenant(uuid) from public, anon, authenticated;

-- ── jornada_abierta: solo el tenant del local (o proceso local del nodo) ──────
create or replace function public.jornada_abierta(p_location uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid;
  v_tenant uuid;
begin
  select tenant_id from public.location where id = p_location into v_tenant;
  if v_tenant is null then
    raise exception 'Ese local no existe' using errcode = 'GLU03';
  end if;
  perform public._exigir_tenant(v_tenant);

  select id from public.jornada
   where location_id = p_location and cerrada_en is null
   into v_id;
  if found then return v_id; end if;

  -- Candado anti jornada doble (ver 0103).
  perform pg_advisory_xact_lock(hashtext('jornada:' || p_location::text));

  select id from public.jornada
   where location_id = p_location and cerrada_en is null
   into v_id;
  if found then return v_id; end if;

  insert into public.jornada (tenant_id, location_id, numero)
  select v_tenant, p_location,
         coalesce(max(numero), 0) + 1 from public.jornada where location_id = p_location
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.jornada_abierta(uuid) from public, anon;
grant execute on function public.jornada_abierta(uuid) to authenticated, service_role;

-- ── cerrar_jornada: misma firma, con guardia de tenant y autor coherente ──────
create or replace function public.cerrar_jornada(
  p_jornada uuid,
  p_por     uuid default null,
  p_tipo    text default 'MANUAL',
  p_contado numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_z        jsonb;
  v_abiertas int;
  v_cerrada  timestamptz;
  v_tenant   uuid;
  v_efectivo numeric;
begin
  select cerrada_en, tenant_id from public.jornada
   where id = p_jornada for update into v_cerrada, v_tenant;
  if not found then
    raise exception 'Esa jornada no existe' using errcode = 'GLU03';
  end if;
  perform public._exigir_tenant(v_tenant);
  -- El autor declarado tiene que ser del mismo tenant (o null: cierre del reloj).
  if p_por is not null and not exists (
      select 1 from public.app_user au where au.id = p_por and au.tenant_id = v_tenant) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  if v_cerrada is not null then
    raise exception 'Esa jornada ya está cerrada'
      using errcode = 'GLU04', hint = 'Ya se cerró. Mira el Z de esa jornada en los informes.';
  end if;

  v_z := public.z_de_jornada(p_jornada);
  v_abiertas := coalesce((v_z->>'abiertas')::int, 0);

  select coalesce(sum((m->>'importe')::numeric), 0)
    from jsonb_array_elements(v_z->'por_metodo') m
   where m->>'metodo' = 'EFECTIVO'
    into v_efectivo;

  update public.jornada set
    cerrada_en       = now(),
    cerrada_por      = p_por,
    tipo_cierre      = p_tipo,
    arqueo_pendiente = (p_tipo = 'AUTOMATICO' or p_contado is null),
    mesas_abiertas   = v_abiertas,
    efectivo_contado = p_contado,
    descuadre        = case when p_contado is null then null else p_contado - v_efectivo end,
    z                = v_z || jsonb_build_object(
                         'efectivo_esperado', v_efectivo,
                         'efectivo_contado',  p_contado,
                         'descuadre',         case when p_contado is null then null
                                                   else p_contado - v_efectivo end)
  where id = p_jornada;

  return v_z;
end;
$$;
revoke all on function public.cerrar_jornada(uuid, uuid, text, numeric) from public, anon;
grant execute on function public.cerrar_jornada(uuid, uuid, text, numeric) to authenticated, service_role;

-- ── z_de_jornada: sin cambios de cuerpo, pero sin EXECUTE implícito ───────────
revoke all on function public.z_de_jornada(uuid) from public, anon;
grant execute on function public.z_de_jornada(uuid) to authenticated, service_role;

-- ── device_heartbeat: se acabó el latido anónimo y el UUID ajeno ──────────────
-- El TPV late con la sesión del operario (authenticated): el device debe ser de
-- SU tenant. Un token de dispositivo del nodo (claim device_id) solo puede latir
-- por sí mismo. El nodo local (sin claims) sigue pudiendo latir por cualquiera.
create or replace function public.device_heartbeat(p_device uuid, p_version text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claims    text := coalesce(current_setting('request.jwt.claims', true), '');
  v_device_jwt uuid;
begin
  if v_claims <> '' then
    v_device_jwt := nullif(v_claims::jsonb ->> 'device_id', '')::uuid;
    if v_device_jwt is not null then
      -- token de dispositivo: solo su propia fila
      if v_device_jwt is distinct from p_device then
        raise exception 'no autorizado' using errcode = '42501';
      end if;
    else
      -- sesión de usuario: el device tiene que ser de su tenant
      if not exists (
        select 1 from public.device d
         where d.id = p_device and d.tenant_id = public.current_tenant_id()) then
        raise exception 'no autorizado' using errcode = '42501';
      end if;
    end if;
  end if;
  update public.device
     set ultima_conexion = now(),
         version = coalesce(nullif(p_version, ''), version)
   where id = p_device;
end;
$$;
revoke all on function public.device_heartbeat(uuid, text) from public, anon;
grant execute on function public.device_heartbeat(uuid, text) to authenticated, service_role;
