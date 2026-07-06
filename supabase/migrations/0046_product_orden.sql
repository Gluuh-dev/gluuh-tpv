-- 0046: orden manual de productos dentro de su categoría (botonera del TPV).
-- Lo consume (panel)/ordenar-productos; el TPV ordenará por (orden, nombre).
alter table public.product add column if not exists orden int not null default 0;
