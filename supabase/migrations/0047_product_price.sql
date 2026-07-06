-- =============================================================================
--  0047_product_price.sql — Precio de producto por tarifa (tarifas reales).
--  Fila = "este producto cuesta X en esta tarifa"; sin fila = precio base
--  de product.precio. El importe lleva el impuesto INCLUIDO, como toda la carta.
--  Multi-tenant con RLS por tenant_id, igual que el resto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_price (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  tarifa_id  uuid NOT NULL REFERENCES tarifa(id) ON DELETE CASCADE,
  precio     numeric(12,2) NOT NULL,            -- PVP, impuesto incluido
  UNIQUE (tenant_id, product_id, tarifa_id)
);
CREATE INDEX IF NOT EXISTS idx_product_price_tarifa ON product_price (tenant_id, tarifa_id);

ALTER TABLE product_price ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON product_price;
CREATE POLICY tenant_isolation ON product_price
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

GRANT ALL ON product_price TO authenticated;

DROP TRIGGER IF EXISTS trg_set_tenant_product_price ON product_price;
CREATE TRIGGER trg_set_tenant_product_price
  BEFORE INSERT ON product_price
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
