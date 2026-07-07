-- 0069 — Empresa y Local (Fase S1): datos administrativos, ubicación y contacto
-- completos en `location` (ficha de empresa estilo Ágora). Aditiva e idempotente.
-- Aplicada en Supabase el 07-07-2026 (apply_migration location_empresa_contacto).
alter table public.location add column if not exists nombre_comercial text;
alter table public.location add column if not exists poblacion text;
alter table public.location add column if not exists provincia text;
alter table public.location add column if not exists codigo_postal text;
alter table public.location add column if not exists contacto text;   -- persona de contacto
alter table public.location add column if not exists telefono text;
alter table public.location add column if not exists email text;
alter table public.location add column if not exists web text;
