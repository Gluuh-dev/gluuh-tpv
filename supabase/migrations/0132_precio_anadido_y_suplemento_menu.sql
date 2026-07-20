-- 0132 — Precio añadido y suplemento de menú (modelo Ágora §8).
--
-- QUÉ ARREGLA. `product.es_anadido` llevaba días siendo un flag muerto, y no
-- por descuido: es que **le faltaba el precio**. Marcar «esto es un añadido» no
-- puede hacer nada si no hay dónde decir cuánto cuesta vendido como añadido.
--
-- Y de paso responde a «¿un artículo puede ser un menú?». En Ágora NO: un
-- artículo nunca es un menú. Lo que tiene es un **suplemento** para cuando entra
-- dentro de uno («el menú vale 12 €, pero si eliges solomillo, +3 €»). El menú
-- se compone aparte (`menu` + `menu_group` + `menu_choice`, que ya existen).
-- Por eso `es_menu_del_dia` se retiró de la ficha: no era el campo que hacía
-- falta.
--
-- Los tres precios van POR TARIFA, como en Ágora (LOCAL / COFFEE en su demo):
--   Precio · Precio Añadido · Supl. Menú
--
-- Todo ADITIVO. `product_price` ya guardaba el primero (0131).

alter table public.product_price add column if not exists precio_anadido   numeric(10,2);
alter table public.product_price add column if not exists suplemento_menu  numeric(10,2);

comment on column public.product_price.precio_anadido is
  'Lo que cuesta este artículo vendido como AÑADIDO de otro. null = no se vende así.';
comment on column public.product_price.suplemento_menu is
  'Lo que SUMA si entra dentro de un menú. null = no suma nada.';

-- ── Un extra ES un producto, no un texto suelto ─────────────────────────────
-- Hoy `modifier` es (nombre, precio_extra): un número tecleado a mano que no
-- cuadra con nada. Si el «extra de queso» apunta al PRODUCTO queso, hereda su
-- precio de añadido y su clase fiscal, y cambiar el precio del queso una vez lo
-- cambia en las catorce pizzas donde aparece.
--
-- Sigue siendo OPCIONAL: los modificadores de texto («sin cebolla», «muy hecho»)
-- no son productos y no deben serlo.
alter table public.modifier add column if not exists product_ref_id uuid
  references public.product(id) on delete set null;

comment on column public.modifier.product_ref_id is
  'Si esta opción ES un producto (extra de queso), su id. null = opción de texto.';

create index if not exists modifier_por_producto on public.modifier (product_ref_id)
  where product_ref_id is not null;
