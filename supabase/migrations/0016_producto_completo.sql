-- 0016_producto_completo.sql — ficha de producto completa (Ágora: Catálogo → Productos)
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS descripcion    text;
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS foto_url       text;
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS codigo_barras  text;
-- 14 alérgenos UE como array de códigos. ponytail: array en vez de tabla join.
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS alergenos      text[] NOT NULL DEFAULT '{}';
