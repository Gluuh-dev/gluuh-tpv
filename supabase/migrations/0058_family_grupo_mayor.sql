-- 0058_family_grupo_mayor.sql — Grupo mayor como división por encima de las familias
-- Jerarquía del catálogo: grupo mayor → familia → categoría → producto.
-- Un "grupo mayor" agrupa varias familias (ej.: Salón, Terraza, o Bebidas/Comida
-- a alto nivel). NULL = familia sin grupo mayor. Aditiva e idempotente.

ALTER TABLE public.family
  ADD COLUMN IF NOT EXISTS grupo_mayor_id uuid REFERENCES public.grupo_mayor(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_family_grupo_mayor ON public.family (tenant_id, grupo_mayor_id);
