-- 0039 — Formatos de venta por artículo (verticales fase 1).
-- Un mismo producto se vende en varios formatos con precio distinto:
-- caña/copa/botella, ración/media/porción, combinado/chupito… Base de bar,
-- pizzería y restaurante. docs/auditoria_02_07_26/07 §8 (modelo de verticales).

CREATE TABLE IF NOT EXISTS product_format (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  nombre      text NOT NULL,              -- "Caña", "Copa", "1/2 ración"
  precio      numeric(12,2) NOT NULL,
  orden       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_format ON product_format (tenant_id, product_id, orden);

ALTER TABLE product_format ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_format_rw ON product_format;
CREATE POLICY product_format_rw ON product_format FOR ALL
  USING     (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT ALL ON product_format TO authenticated;

DROP TRIGGER IF EXISTS trg_set_tenant ON product_format;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON product_format
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();
