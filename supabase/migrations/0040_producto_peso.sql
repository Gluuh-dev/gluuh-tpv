-- 0040 — Venta por peso (verticales: heladería, charcutería, fruta, pescadería).
-- El producto marcado como "por peso" usa su `precio` como €/kg; al venderlo se
-- teclea (o lee de balanza) el peso y el importe = precio × peso.

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS vendido_por_peso boolean NOT NULL DEFAULT false;
