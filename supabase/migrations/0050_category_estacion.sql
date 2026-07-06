-- 0050 — Estación por categoría: estación de preparación por defecto para los
-- productos de la categoría (COCINA/BARRA/CAMARERO/NINGUNA; null = sin definir).
-- La usa la Carta como valor inicial del alta rápida y para el volcado en bloque
-- a los productos; el enrutado de impresión sigue leyendo product.estacion.

ALTER TABLE category
  ADD COLUMN IF NOT EXISTS estacion text;
