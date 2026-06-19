-- Datos del cliente para pedidos "para llevar" (cuenta sin mesa).
-- Un pedido para llevar = sales_order con table_id NULL y cliente_nombre no nulo.
ALTER TABLE sales_order
  ADD COLUMN IF NOT EXISTS cliente_nombre   text,
  ADD COLUMN IF NOT EXISTS cliente_telefono text;
