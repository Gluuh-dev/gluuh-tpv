-- 0043 — Nota por cuenta/mesa (texto libre): alergias, cumpleaños, avisos…
-- Se muestra en el plano y puede imprimirse en la comanda/cuenta.

ALTER TABLE sales_order
  ADD COLUMN IF NOT EXISTS notas text;
