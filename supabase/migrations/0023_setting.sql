-- =============================================================================
--  0023_setting.sql — Configuración universal clave/valor por ámbito.
--
--  Mecanismo único de configuración del sistema (F0 del plan de implementación):
--  casi todo ajuste es una fila aquí, NO una columna nueva por casilla. Tres
--  ámbitos con precedencia DEVICE > LOCAL > GLOBAL:
--    · GLOBAL : por empresa (tenant). location_id y device_id NULL.
--    · LOCAL  : por local/centro. location_id NOT NULL.
--    · DEVICE : por terminal.       device_id  NOT NULL.
--
--  Resolución con `setting_get(clave, location_id?, device_id?)`: devuelve el
--  valor más específico disponible (terminal → local → global). Ver
--  docs/auditoria/mejoras/01-diseno-y-experiencia.md y
--  docs/auditoria/implementacion/modelo-de-datos.md.
-- =============================================================================

CREATE TABLE IF NOT EXISTS setting (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  scope       text NOT NULL CHECK (scope IN ('GLOBAL','LOCAL','DEVICE')),
  location_id uuid REFERENCES location(id) ON DELETE CASCADE,
  device_id   uuid REFERENCES device(id)   ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Coherencia ámbito ↔ objetivo
  CONSTRAINT setting_scope_target_chk CHECK (
    (scope = 'GLOBAL' AND location_id IS NULL AND device_id IS NULL) OR
    (scope = 'LOCAL'  AND location_id IS NOT NULL AND device_id IS NULL) OR
    (scope = 'DEVICE' AND device_id  IS NOT NULL)
  )
);

-- Unicidad de la clave por objetivo (índices parciales por ámbito)
CREATE UNIQUE INDEX IF NOT EXISTS setting_global_uq
  ON setting (tenant_id, key) WHERE scope = 'GLOBAL';
CREATE UNIQUE INDEX IF NOT EXISTS setting_local_uq
  ON setting (tenant_id, location_id, key) WHERE scope = 'LOCAL';
CREATE UNIQUE INDEX IF NOT EXISTS setting_device_uq
  ON setting (tenant_id, device_id, key) WHERE scope = 'DEVICE';

-- Búsqueda por clave dentro del tenant
CREATE INDEX IF NOT EXISTS setting_tenant_key_idx ON setting (tenant_id, key);

-- Triggers estándar: rellena tenant_id en INSERT y mantiene updated_at
DROP TRIGGER IF EXISTS trg_set_tenant ON setting;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON setting
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_updated_at ON setting;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON setting
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: aislamiento por tenant (mismo patrón que el resto del esquema)
ALTER TABLE setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE setting FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON setting;
CREATE POLICY tenant_isolation ON setting
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- =============================================================================
--  Resolución con precedencia DEVICE > LOCAL > GLOBAL.
--  SECURITY INVOKER (por defecto) → respeta la RLS del que llama.
-- =============================================================================
CREATE OR REPLACE FUNCTION setting_get(
  p_key         text,
  p_location_id uuid DEFAULT NULL,
  p_device_id   uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE sql STABLE AS $$
  SELECT value
  FROM setting
  WHERE key = p_key
    AND tenant_id = current_tenant_id()
    AND (
      (scope = 'DEVICE' AND device_id  = p_device_id)  OR
      (scope = 'LOCAL'  AND location_id = p_location_id) OR
      (scope = 'GLOBAL')
    )
  ORDER BY CASE scope WHEN 'DEVICE' THEN 1 WHEN 'LOCAL' THEN 2 ELSE 3 END
  LIMIT 1
$$;

-- =============================================================================
--  Upsert cómodo de un ajuste. Devuelve la fila resultante.
-- =============================================================================
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
    INSERT INTO setting (scope, key, value, location_id)
      VALUES ('LOCAL', p_key, p_value, p_location_id)
    ON CONFLICT (tenant_id, location_id, key) WHERE scope = 'LOCAL'
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING * INTO r;
  ELSIF p_scope = 'DEVICE' THEN
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
