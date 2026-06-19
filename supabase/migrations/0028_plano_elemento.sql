-- =============================================================================
--  0028_plano_elemento.sql — Elementos decorativos/estructurales del plano de sala
--  (barra, pared, puerta, planta, decoración…) posicionados como las mesas.
--  Multi-tenant con RLS por tenant_id, igual que el resto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS plano_elemento (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  room_id    uuid NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('BARRA','PARED','PUERTA','PLANTA','DECOR')),
  etiqueta   text,
  icono      text,                       -- emoji para PLANTA/DECOR
  pos_x      int NOT NULL DEFAULT 0,
  pos_y      int NOT NULL DEFAULT 0,
  ancho      int NOT NULL DEFAULT 80,
  alto       int NOT NULL DEFAULT 80,
  rotacion   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_elemento_room ON plano_elemento (tenant_id, room_id);

ALTER TABLE plano_elemento ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_elemento FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON plano_elemento;
CREATE POLICY tenant_isolation ON plano_elemento
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP TRIGGER IF EXISTS trg_set_tenant_plano_elemento ON plano_elemento;
CREATE TRIGGER trg_set_tenant_plano_elemento
  BEFORE INSERT ON plano_elemento
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
