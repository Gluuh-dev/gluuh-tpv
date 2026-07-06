-- 0036 — Columnas para las funciones de cuenta del TPV (estilo Glop).
-- docs/implementacion/05-paridad-glop.md §5.2-5.6.
-- comensales, tipo_operacion y cliente_nombre/telefono YA existen (0001/0029);
-- aquí solo lo que falta: aparcar y cliente registrado.

ALTER TABLE sales_order
  -- Cuenta aparcada: etiqueta con la que se recupera (p. ej. "14:32" o "Rubio").
  -- Aparcado = pedido abierto sin mesa con esta etiqueta no nula.
  ADD COLUMN IF NOT EXISTS aparcado_como text,
  -- Cliente registrado asignado al ticket (además de cliente_nombre/telefono).
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customer(id) ON DELETE SET NULL;
