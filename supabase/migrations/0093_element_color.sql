-- Añadir columna color a la tabla de elementos decorativos
ALTER TABLE public.plano_elemento ADD COLUMN IF NOT EXISTS color text;
