-- Suelo (textura) de cada sala para el plano. Vacío = liso.
ALTER TABLE room ADD COLUMN IF NOT EXISTS suelo text;
