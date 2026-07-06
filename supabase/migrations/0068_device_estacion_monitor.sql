-- 0068 — Estación por monitor: cada pantalla de cocina (KDS) puede fijar la
-- partida que muestra al arrancar (COCINA/BARRA/CAMARERO/TODAS). null = usa la
-- estación por defecto de la configuración global del módulo Cocina.
-- Aplicada en Supabase el 06-07-2026 (apply_migration device_estacion_monitor).
alter table public.device add column if not exists estacion text;
