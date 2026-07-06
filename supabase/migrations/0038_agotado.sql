-- 0038 — Producto agotado ("86") desde el TPV.
-- docs/implementacion/07-creacion-rapida-desde-tpv.md §7.3.
-- El flag cuelga del PRODUCTO (no de la carta/botón), así se agota a la vez en
-- TPV, kiosko y comandera. "Agotado hoy" = fecha de mañana 06:00 (se reactiva solo).

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS agotado_hasta timestamptz;
