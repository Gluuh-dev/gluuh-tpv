-- Añadir columna color a la tabla de mesas
ALTER TABLE public.restaurant_table ADD COLUMN IF NOT EXISTS color text;
