-- 0044 — Imagen por categoría/familia (opcional), para mostrarla en el botón del TPV.

ALTER TABLE category
  ADD COLUMN IF NOT EXISTS foto_url text;
