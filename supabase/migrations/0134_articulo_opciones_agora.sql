-- 0134 — Las opciones del artículo que faltaban (ficha de Ágora §1).
--
-- `solicitar_anadidos` y `solicitar_notas` NO son casillas decorativas: hoy el
-- modal de extras se abre SIEMPRE que el artículo tenga grupos, y no hay forma
-- de decir «este no». En una barra a las dos de la tarde, un modal de más por
-- cada caña es lo que hace que el camarero deje de usar el TPV bien.
--
-- Por defecto van a `true` — que es el comportamiento de HOY. Así, aplicar la
-- migración no cambia nada para nadie; el que quiera silenciar un artículo lo
-- apaga a mano.

alter table public.product add column if not exists solicitar_anadidos boolean not null default true;
alter table public.product add column if not exists solicitar_notas    boolean not null default true;

comment on column public.product.solicitar_anadidos is
  'Al venderlo, abre solo el modal de extras si los tiene. Apagado: se piden a mano.';
comment on column public.product.solicitar_notas is
  'Al venderlo, pide la nota de preparación. Apagado: no molesta.';

-- Pide la cantidad al añadirlo (el «Preguntar cantidad» de Ágora). Para lo que
-- se vende de a muchos: hielo, pan, cafés para una mesa de doce.
alter table public.product add column if not exists preguntar_cantidad boolean not null default false;

-- Descuento fijo de escandallo: el % que se descuenta del coste teórico al
-- calcular el margen (mermas, mermas de corte, lo que se pierde al elaborar).
alter table public.product add column if not exists descuento_escandallo numeric(5,2);
comment on column public.product.descuento_escandallo is
  'Merma en % sobre el coste teórico, para que el margen no salga optimista.';

-- ⚠ ESTE NO ES «es un menú». Es «PUEDE FORMAR PARTE de un menú», que es la
-- casilla «Artículo menú» de Ágora. Un menú sigue siendo `menu` + `menu_group` +
-- `menu_choice`; esto solo marca qué artículos pueden aparecer como opción y
-- llevar suplemento (`product_price.suplemento_menu`, 0132).
--
-- Se llama distinto A PROPÓSITO de `es_menu_del_dia` (0128, retirado de la
-- ficha), para que nadie los confunda al leer el esquema.
alter table public.product add column if not exists es_articulo_menu boolean not null default false;
comment on column public.product.es_articulo_menu is
  'Puede aparecer como opción dentro de un menú. NO significa que el artículo sea un menú.';
