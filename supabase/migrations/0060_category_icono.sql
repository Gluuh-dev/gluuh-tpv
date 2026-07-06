-- 0060 — Icono por categoría para la botonera del TPV (estilo mockup del cliente).
-- Guarda el NOMBRE del icono (set de lucide: beer, coffee, cup-soda, wine, beef,
-- sandwich, pizza, utensils-crossed, croissant, cake-slice…). null = sin icono
-- (el tile usa foto o solo color de familia). Lo consumen la Carta y el TPV.
alter table public.category add column if not exists icono text;
