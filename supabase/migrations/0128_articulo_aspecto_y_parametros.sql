-- 0128 — Ficha de artículo del TPV nuevo: aspecto del botón + parámetros que
-- faltaban, y coste/raciones por formato.
--
-- Sale de portar la ficha estilo Glop a `apps/tpv`: la pantalla ya pedía estos
-- datos y no tenían columna, así que se perdían al guardar. Todo ADITIVO y con
-- `if not exists` — se puede pasar dos veces sin romper nada (los nodos ya
-- instalados la reciben por el mismo camino).
--
-- ⚠ Lo que NO entra: el precio por sala (barra/salón/terraza). La ficha lo
-- enseña, pero meterlo como tres columnas incrusta las salas en el esquema; el
-- modelo bueno es una tabla de TARIFAS. Hasta esa decisión, la pantalla avisa de
-- que esas casillas no se guardan.

-- ── Aspecto del botón en la botonera ────────────────────────────────────────
-- `icono` guarda el NOMBRE del icono (set de lucide: beer, coffee, pizza…),
-- igual que `category.icono` de la 0060: así el dato sobrevive a cambiar de
-- librería de iconos. `color` null = hereda el de su familia.
alter table public.product add column if not exists color text;
alter table public.product add column if not exists icono text;

-- ── Parámetros del artículo (ventana «Parámetros» de la ficha) ──────────────
alter table public.product add column if not exists controla_stock       boolean not null default false;
alter table public.product add column if not exists no_imprimir_si_cero  boolean not null default false;
alter table public.product add column if not exists descripcion_libre    boolean not null default false;
alter table public.product add column if not exists preguntar_precio     boolean not null default false;
alter table public.product add column if not exists ecommerce            boolean not null default false;
alter table public.product add column if not exists es_menu_del_dia      boolean not null default false;

comment on column public.product.color   is 'Color del botón en el TPV. null = el de su familia.';
comment on column public.product.icono   is 'Nombre de icono lucide (ver lib/iconos). Solo se pinta si no hay foto.';
comment on column public.product.preguntar_precio is 'Sin precio fijo: lo teclea el camarero al añadirlo.';
comment on column public.product.descripcion_libre is 'Pide un texto al vender (platos fuera de carta).';
comment on column public.product.no_imprimir_si_cero is 'A 0 € no ensucia la comanda de cocina (invitaciones).';

-- ── Escandallo por formato ──────────────────────────────────────────────────
-- `coste` es el precio de compra/producción: con él la ficha calcula el margen.
-- `raciones` es cuántas salen de ese formato (una botella da 6 copas).
alter table public.product_format add column if not exists coste    numeric(10,4);
alter table public.product_format add column if not exists raciones numeric(10,3);
