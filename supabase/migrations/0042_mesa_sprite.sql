-- 0042 — Forma (sprite) por mesa: permite elegir redonda / sombrilla / etc. además
-- de la forma por defecto que da la capacidad. NULL = usar la de la capacidad.

ALTER TABLE restaurant_table
  ADD COLUMN IF NOT EXISTS sprite text;
