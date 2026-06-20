-- Colores elegibles del plano: relleno de mesa y de sillas.
ALTER TABLE tenant_branding
  ADD COLUMN IF NOT EXISTS mesa_color  text,
  ADD COLUMN IF NOT EXISTS silla_color text;
