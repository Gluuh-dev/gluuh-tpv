-- =============================================================================
--  0108_menu_en_familia.sql — El menú es un ARTÍCULO más (estilo Glop).
--  Hasta ahora `menu` vivía suelto (solo llegable por "Comp. menú"). Con una
--  categoría asignada, el menú sale en la rejilla del TPV dentro de su
--  familia/categoría "Menús" como un producto; al tocarlo abre el MenuModal.
--  FK con ON DELETE SET NULL: borrar la categoría no borra el menú, solo lo
--  desagrupa (vuelve a ser llegable únicamente por "Comp. menú").
-- =============================================================================

alter table public.menu
  add column if not exists category_id uuid references public.category(id) on delete set null;

create index if not exists menu_category_idx on public.menu (category_id);
