-- 0112 — Identidad global: BACKFILL (F1 entrega 1.1, paso 2 del rollout).
--
-- Idempotente y sin borrar nada. Preflight OBLIGATORIO antes de aplicar
-- (docs/implementacion/20 §4): 0 duplicados de auth_user_id y de email.
-- Verificado el 17-07-2026: 0 y 0.

-- ── 1. Cuenta global para cada auth_user_id con membresía ─────────────────────
insert into public.cuenta (auth_user_id, nombre)
select au.auth_user_id, min(au.nombre)
from public.app_user au
where au.auth_user_id is not null
group by au.auth_user_id
on conflict (auth_user_id) do nothing;

update public.app_user au
set cuenta_id = c.id
from public.cuenta c
where c.auth_user_id = au.auth_user_id
  and au.cuenta_id is null;

-- ── 2. MATERIALIZAR los permisos implícitos de los perfiles ──────────────────
--
-- Semántica histórica (0041): clave AUSENTE = permitido. Para poder pasar a
-- fail-closed (ausente = denegado, 0113) sin cambiar el comportamiento de ningún
-- perfil existente, se escribe el `true` implícito de TODAS las claves del
-- catálogo actual. Los `false` explícitos ganan (|| derecha pisa izquierda).
-- Snapshot del catálogo a 17-07-2026 (apps/web/app/lib/permisos.ts).
update public.perfil
set permisos = (
  select jsonb_object_agg(k, true) from unnest(array[
    'modificar','descuento','borrar','invitar','cobrar','aparcar','agotado',
    'crear_producto','abrir_cajon',
    'panel.operativa','panel.admin','panel.compras','panel.herramientas','panel.informes',
    'admin.usuarios','admin.catalogo','admin.fiscal',
    'compras.stock',
    'tecnica','herramientas.precios','cartas'
  ]) as k
) || coalesce(permisos, '{}'::jsonb),
    updated_at = now();

-- ── 3. Perfil para quien no tiene (hoy: los 4 usuarios reales) ───────────────
--
-- Mapping aprobado con el diseño (plan 018 paso 1): PROPIETARIO/ADMIN_PLATAFORMA
-- no necesitan perfil (rol explícito en operario_permite); ENCARGADO → perfil
-- "Encargado"; cualquier otro rol → "Camarero". Se crean los perfiles si faltan,
-- con los MISMOS permisos que siembra crear-empresa (ya materializados).
insert into public.perfil (tenant_id, nombre, descripcion, permisos)
select t.id, v.nombre, v.descripcion,
       (select jsonb_object_agg(k, true) from unnest(array[
          'modificar','descuento','borrar','invitar','cobrar','aparcar','agotado',
          'crear_producto','abrir_cajon',
          'panel.operativa','panel.admin','panel.compras','panel.herramientas','panel.informes',
          'admin.usuarios','admin.catalogo','admin.fiscal','compras.stock',
          'tecnica','herramientas.precios','cartas']) as k) || v.deniega
from public.tenant t
cross join (values
  ('Encargado', 'Todo menos la zona técnica del instalador.', '{"tecnica": false}'::jsonb),
  ('Camarero',  'Solo operativa (TPV); sin backoffice.',
   '{"panel.admin": false, "panel.compras": false, "panel.herramientas": false, "panel.informes": false}'::jsonb)
) as v(nombre, descripcion, deniega)
where not exists (
  select 1 from public.perfil p where p.tenant_id = t.id and p.nombre = v.nombre
);

update public.app_user au
set perfil_id = p.id
from public.perfil p
where au.perfil_id is null
  and au.rol not in ('PROPIETARIO','ADMIN_PLATAFORMA')
  and p.tenant_id = au.tenant_id
  and p.nombre = case when au.rol = 'ENCARGADO' then 'Encargado' else 'Camarero' end;

-- ── 4. Asignación por local: cada membresía activa, en todos los locales ──────
insert into public.app_user_local (tenant_id, app_user_id, location_id, perfil_id)
select au.tenant_id, au.id, l.id, au.perfil_id
from public.app_user au
join public.location l on l.tenant_id = au.tenant_id
where au.activo
on conflict (app_user_id, location_id) do nothing;

-- ── 5. Ledger verificable (queda en el log de la migración) ───────────────────
do $$
declare
  v_sin_cuenta int; v_sin_perfil int; v_sin_asignacion int;
begin
  select count(*) into v_sin_cuenta from public.app_user
    where auth_user_id is not null and cuenta_id is null;
  select count(*) into v_sin_perfil from public.app_user
    where perfil_id is null and activo and rol not in ('PROPIETARIO','ADMIN_PLATAFORMA');
  select count(*) into v_sin_asignacion from public.app_user au
    where au.activo and not exists (select 1 from public.app_user_local al where al.app_user_id = au.id)
      and exists (select 1 from public.location l where l.tenant_id = au.tenant_id);
  raise notice 'backfill 0112: sin_cuenta=% sin_perfil=% sin_asignacion=%',
    v_sin_cuenta, v_sin_perfil, v_sin_asignacion;
  if v_sin_cuenta > 0 or v_sin_perfil > 0 or v_sin_asignacion > 0 then
    raise exception 'backfill 0112 incompleto (sin_cuenta=%, sin_perfil=%, sin_asignacion=%): revisar antes de 0113',
      v_sin_cuenta, v_sin_perfil, v_sin_asignacion;
  end if;
end $$;
