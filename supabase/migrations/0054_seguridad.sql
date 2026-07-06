-- =============================================================================
--  0054_seguridad.sql — Endurecimiento de riesgos MEDIOS (server-side).
--
--  Aditiva e idempotente. NO cambia ninguna firma de RPC usada por el cliente
--  (validar_pin, setting_set conservan parámetros y tipo de retorno).
--
--    M2 · validar_pin: backoff anti fuerza-bruta del login por PIN.
--    B2 · setting_set: valida que location_id/device_id pertenecen al tenant.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  M2 — Límite de intentos en validar_pin (0007).
--
--  El login por PIN sólo recibe el PIN, no el usuario: un PIN erróneo no
--  identifica a nadie, así que el fallo NO se puede atribuir a un app_user
--  concreto. Por eso el backoff es a nivel de TENANT (la sesión del terminal
--  entra como la empresa) y se materializa en las columnas de app_user:
--  al fallar se incrementa el contador de todas las filas del tenant y, a
--  partir de 5 fallos, se bloquea el login por PIN durante un tiempo creciente.
--  ponytail: cerrojo por tenant sobre una tabla pequeña (empleados de un bar);
--  el UPDATE de todas las filas es despreciable. Si algún día conviene aislar
--  por usuario haría falta un login que identifique al empleado antes del PIN.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.app_user
  ADD COLUMN IF NOT EXISTS pin_intentos        int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_bloqueado_hasta  timestamptz;

CREATE OR REPLACE FUNCTION public.validar_pin(p_pin text)
RETURNS TABLE(id uuid, nombre text, rol text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_id     uuid;
  v_nombre text;
  v_rol    text;
BEGIN
  -- ¿Login por PIN bloqueado para este tenant? Si hay backoff vigente se
  -- devuelve "no válido" SIN comprobar el PIN (mismo resultado que un PIN
  -- incorrecto: no se filtra si está bloqueado o si el PIN es erróneo).
  IF EXISTS (
    SELECT 1 FROM public.app_user
    WHERE tenant_id = v_tenant AND pin_bloqueado_hasta > now()
  ) THEN
    RETURN;
  END IF;

  -- Comprobación del PIN dentro del tenant de la sesión.
  SELECT u.id, u.nombre, u.rol
    INTO v_id, v_nombre, v_rol
  FROM public.app_user u
  WHERE u.tenant_id = v_tenant
    AND u.activo
    AND u.pin_hash IS NOT NULL
    AND u.pin_hash = crypt(p_pin, u.pin_hash)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Acierto: resetea el contador del tenant (sólo filas que lo necesiten).
    UPDATE public.app_user
      SET pin_intentos = 0, pin_bloqueado_hasta = NULL
    WHERE tenant_id = v_tenant
      AND (pin_intentos <> 0 OR pin_bloqueado_hasta IS NOT NULL);

    id := v_id; nombre := v_nombre; rol := v_rol;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Fallo: incrementa el contador del tenant y, a partir de 5 fallos, aplica
  -- un bloqueo creciente: 1 min tras el 5º, 2 min tras el 6º, 3 min tras el 7º…
  UPDATE public.app_user
    SET pin_intentos = pin_intentos + 1,
        pin_bloqueado_hasta = CASE
          WHEN pin_intentos + 1 >= 5
            THEN now() + interval '1 minute' * (pin_intentos + 1 - 4)
          ELSE pin_bloqueado_hasta
        END
  WHERE tenant_id = v_tenant;

  RETURN; -- sin filas: PIN no válido
END;
$$;

-- Mismos permisos que 0007 (no cambia el acceso).
REVOKE ALL ON FUNCTION public.validar_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validar_pin(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
--  B2 — setting_set valida pertenencia de location_id / device_id (0023).
--
--  Sin esto, un tenant podía escribir un setting LOCAL/DEVICE apuntando a un
--  location_id/device_id ajeno. La RLS de `setting` protege la lectura, pero la
--  clave objetivo no se validaba. Ahora se comprueba que pertenece al tenant de
--  la sesión (RLS de location/device también acota, pero lo hacemos explícito).
--  Firma sin cambios.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION setting_set(
  p_scope       text,
  p_key         text,
  p_value       jsonb,
  p_location_id uuid DEFAULT NULL,
  p_device_id   uuid DEFAULT NULL
) RETURNS setting
  LANGUAGE plpgsql AS $$
DECLARE r setting;
BEGIN
  IF p_scope = 'GLOBAL' THEN
    INSERT INTO setting (scope, key, value) VALUES ('GLOBAL', p_key, p_value)
    ON CONFLICT (tenant_id, key) WHERE scope = 'GLOBAL'
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING * INTO r;
  ELSIF p_scope = 'LOCAL' THEN
    IF p_location_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM location
      WHERE id = p_location_id AND tenant_id = current_tenant_id()
    ) THEN
      RAISE EXCEPTION 'location % no pertenece al tenant', p_location_id;
    END IF;
    INSERT INTO setting (scope, key, value, location_id)
      VALUES ('LOCAL', p_key, p_value, p_location_id)
    ON CONFLICT (tenant_id, location_id, key) WHERE scope = 'LOCAL'
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING * INTO r;
  ELSIF p_scope = 'DEVICE' THEN
    IF p_device_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM device
      WHERE id = p_device_id AND tenant_id = current_tenant_id()
    ) THEN
      RAISE EXCEPTION 'device % no pertenece al tenant', p_device_id;
    END IF;
    INSERT INTO setting (scope, key, value, device_id)
      VALUES ('DEVICE', p_key, p_value, p_device_id)
    ON CONFLICT (tenant_id, device_id, key) WHERE scope = 'DEVICE'
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING * INTO r;
  ELSE
    RAISE EXCEPTION 'Ámbito inválido: % (GLOBAL|LOCAL|DEVICE)', p_scope;
  END IF;
  RETURN r;
END;
$$;
