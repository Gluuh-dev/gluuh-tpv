-- 0066 — Color propio de la categoría (null = hereda el de su familia).
-- Aplicada en Supabase el 06-07-2026 (apply_migration categoria_color).
alter table public.category add column if not exists color text;
