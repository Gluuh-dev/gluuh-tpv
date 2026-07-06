-- 0035 — Módulos activables por empresa (docs/implementacion/04, paso 1).
-- El catálogo de módulos vive en código (apps/web/app/lib/modulos.ts); en BD
-- solo se guarda la activación y su configuración. Sin fila = valor por defecto
-- del módulo (los básicos, activos).

CREATE TABLE IF NOT EXISTS tenant_module (
  tenant_id  uuid    NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  modulo     text    NOT NULL,
  activo     boolean NOT NULL DEFAULT true,
  config     jsonb   NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, modulo)
);

ALTER TABLE tenant_module ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_module_rw ON tenant_module;
CREATE POLICY tenant_module_rw ON tenant_module FOR ALL
  USING     (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT ALL ON tenant_module TO authenticated;

DROP TRIGGER IF EXISTS trg_set_tenant ON tenant_module;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON tenant_module
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
