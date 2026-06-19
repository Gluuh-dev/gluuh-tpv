-- Capacidad (nº de comensales) de cada mesa, para dibujarla en el plano
-- (simple/doble/grande) y validar aforo.
ALTER TABLE restaurant_table
  ADD COLUMN IF NOT EXISTS capacidad int NOT NULL DEFAULT 2;
