-- 0113 — Identidad: SWITCH a fail-closed (F1 entregas 1.2–1.4).
--
-- Requiere 0111 (tablas) y 0112 (backfill VERDE: perfiles materializados y todos
-- los operativos con perfil). Las firmas públicas NO cambian: los ~669 usos de
-- current_tenant_id()/operario_permite() siguen compilando y funcionando.

-- ── establecer_contexto_sesion: el servidor registra tenant/local de ESTA sesión ─
create or replace function public.establecer_contexto_sesion(p_tenant uuid, p_location uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session   uuid := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id', '')::uuid;
  v_cuenta    uuid;
  v_membresia uuid;
begin
  if v_session is null or auth.uid() is null then
    raise exception 'sin sesión' using errcode = '28000';
  end if;
  select id into v_cuenta from public.cuenta
    where auth_user_id = auth.uid() and estado = 'ACTIVA';
  select au.id into v_membresia from public.app_user au
    where au.cuenta_id = v_cuenta and au.tenant_id = p_tenant and au.activo;
  if v_cuenta is null or v_membresia is null then
    raise exception 'membresía inválida' using errcode = '42501';
  end if;
  if p_location is not null and not exists (
      select 1 from public.location l where l.id = p_location and l.tenant_id = p_tenant) then
    raise exception 'local inválido' using errcode = '42501';
  end if;
  insert into public.sesion_contexto (session_id, cuenta_id, tenant_id, app_user_id, location_id)
  values (v_session, v_cuenta, p_tenant, v_membresia, p_location)
  on conflict (session_id) do update
    set tenant_id = excluded.tenant_id, app_user_id = excluded.app_user_id,
        location_id = excluded.location_id, updated_at = now();
  insert into public.sesion_registro (session_id, cuenta_id)
  values (v_session, v_cuenta)
  on conflict (session_id) do update set ultima_vista = now();
  insert into public.evento_seguridad (cuenta_id, tenant_id, tipo)
  values (v_cuenta, p_tenant, 'CONTEXTO_CAMBIADO');
end $$;

-- ── mis_membresias: lista para el selector de empresa (cruza tenants a propósito,
--    por eso es definer: la RLS por tenant no puede enseñar "mis otras empresas") ─
create or replace function public.mis_membresias()
returns table (tenant_id uuid, tenant_nombre text, app_user_id uuid, rol text)
language sql
stable
security definer
set search_path = ''
as $$
  select au.tenant_id, t.nombre, au.id, au.rol
  from public.app_user au
  join public.tenant t on t.id = au.tenant_id
  join public.cuenta c on c.id = au.cuenta_id
  where c.auth_user_id = auth.uid()
    and c.estado = 'ACTIVA'
    and au.activo
  union
  -- transición: membresías aún no enlazadas a cuenta (backfill parcial en nodos)
  select au.tenant_id, t.nombre, au.id, au.rol
  from public.app_user au
  join public.tenant t on t.id = au.tenant_id
  where au.auth_user_id = auth.uid() and au.cuenta_id is null and au.activo
$$;

-- ── revocar_sesion: cerrar otra sesión de MI cuenta ───────────────────────────
create or replace function public.revocar_sesion(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta uuid;
begin
  select id into v_cuenta from public.cuenta where auth_user_id = auth.uid();
  if v_cuenta is null then
    raise exception 'sin cuenta' using errcode = '42501';
  end if;
  update public.sesion_registro
     set revocada_at = now()
   where session_id = p_session and cuenta_id = v_cuenta and revocada_at is null;
  delete from public.sesion_contexto
   where session_id = p_session and cuenta_id = v_cuenta;
  insert into public.evento_seguridad (cuenta_id, tipo, detalle)
  values (v_cuenta, 'SESION_REVOCADA', jsonb_build_object('session', p_session));
end $$;

-- ── current_tenant_id v2 — determinista y fail-closed ─────────────────────────
-- Prioridad:
--   1. GUC `app.tenant_id`  → procesos del nodo/servicio local (se conserva).
--   2. contexto de sesión   → elegido server-side vía establecer_contexto_sesion.
--   3. claim `tenant_id`    → SOLO transición: lo firma el auth del nodo (emisor
--      de confianza); en la nube el hook está desactivado y no viene. Se retira
--      en la fase contract (1.5) cuando el nodo emita session_id.
--   4. membresía ÚNICA      → si la cuenta pertenece a exactamente una empresa.
--   5. ambigüedad/ausencia  → NULL: la RLS deniega sola. Se acabó el LIMIT 1.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.tenant_id', true), '')::uuid,
    (select sc.tenant_id
       from public.sesion_contexto sc
       join public.cuenta c on c.id = sc.cuenta_id
      where sc.session_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id', '')::uuid
        and c.auth_user_id = auth.uid()),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
    (select (array_agg(distinct au.tenant_id))[1]
       from public.app_user au
      where au.activo
        and (au.auth_user_id = auth.uid()
             or au.cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid()))
      having count(distinct au.tenant_id) = 1)
  )
$$;

-- ── operario_permite v2 — fail-closed ─────────────────────────────────────────
-- PROPIETARIO/ADMIN_PLATAFORMA explícitos → sí. Resto: override DENEGAR gana;
-- override PERMITIR concede; si no, la clave del perfil (del local si hay
-- asignación; si no, el de la membresía). CLAVE AUSENTE = NO (0112 materializó
-- los true implícitos, así que ningún perfil existente cambia de comportamiento).
-- Sin membresía, sin perfil o sin contexto → NO.
create or replace function public.operario_permite(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with yo as (
    select au.id, au.rol, au.perfil_id,
           (select sc.location_id from public.sesion_contexto sc
             where sc.session_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id', '')::uuid) as loc
    from public.app_user au
    where au.tenant_id = public.current_tenant_id()
      and au.activo
      and (au.auth_user_id = auth.uid()
           or au.cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid()))
  )
  select coalesce(
    (select true from yo where rol in ('PROPIETARIO','ADMIN_PLATAFORMA') limit 1),
    (select case
       when ov.efecto = 'DENEGAR' then false
       when ov.efecto = 'PERMITIR' then true
       else coalesce((pf.permisos ->> p_permiso)::boolean, false)
     end
     from yo
     left join public.app_user_local al
       on al.app_user_id = yo.id
      and al.estado = 'ACTIVA'
      and (al.desde is null or al.desde <= current_date)
      and (al.hasta is null or al.hasta >= current_date)
      and (yo.loc is null or al.location_id = yo.loc)
     left join public.perfil pf on pf.id = coalesce(al.perfil_id, yo.perfil_id)
     left join public.app_user_permiso ov
       on ov.app_user_id = yo.id and ov.permiso = p_permiso
      and (ov.location_id is null or ov.location_id = yo.loc)
     order by ov.location_id nulls last, al.location_id nulls last
     limit 1),
    false)
$$;

-- ── grants: patrón de las 0083+ (revocar el EXECUTE implícito de PUBLIC) ──────
revoke all on function public.establecer_contexto_sesion(uuid, uuid) from public, anon;
grant execute on function public.establecer_contexto_sesion(uuid, uuid) to authenticated;

revoke all on function public.mis_membresias() from public, anon;
grant execute on function public.mis_membresias() to authenticated;

revoke all on function public.revocar_sesion(uuid) from public, anon;
grant execute on function public.revocar_sesion(uuid) to authenticated;

revoke all on function public.current_tenant_id() from public, anon;
grant execute on function public.current_tenant_id() to authenticated, service_role, anon;
-- Nota: current_tenant_id se usa en políticas RLS también para anon (p. ej.
-- tarifas públicas); para anon devuelve NULL y deniega — mantener el grant es
-- necesario para que esas políticas evalúen sin error.

revoke all on function public.operario_permite(text) from public, anon;
grant execute on function public.operario_permite(text) to authenticated, service_role;
