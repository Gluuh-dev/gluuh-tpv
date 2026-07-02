-- 0033 — Emparejado de dispositivos por código de 6 dígitos.
-- Diseño: docs/implementacion/04-modulos-y-emparejado.md (paso 3).
-- Un dispositivo (TPV de escritorio, pantalla de cocina, kiosko…) se vincula
-- introduciendo un código generado desde el backoffice; el código es de un solo
-- uso y caduca. La credencial resultante es un JWT propio (no sesión Supabase).

ALTER TABLE device
  ADD COLUMN IF NOT EXISTS modulo             text,
  ADD COLUMN IF NOT EXISTS codigo_vinculacion text,
  ADD COLUMN IF NOT EXISTS codigo_expira      timestamptz,
  ADD COLUMN IF NOT EXISTS vinculado_at       timestamptz;

-- El código debe ser único mientras está vivo (índice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS device_codigo_uq
  ON device (codigo_vinculacion)
  WHERE codigo_vinculacion IS NOT NULL;

-- Ampliar los tipos de dispositivo a las pantallas del sistema de módulos.
ALTER TABLE device DROP CONSTRAINT IF EXISTS device_tipo_check;
ALTER TABLE device ADD CONSTRAINT device_tipo_check
  CHECK (tipo IN ('TPV','COMANDERA','KDS','WEB','PANTALLA','KIOSKO','CARTELERIA','VISOR'));
