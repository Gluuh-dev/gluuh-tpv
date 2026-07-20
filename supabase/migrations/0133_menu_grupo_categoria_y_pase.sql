-- 0133 — Los pasos de un menú, como en Ágora.
--
-- De la pantalla «Editar Menú» de Ágora (Grupo de Platos: Nombre · Cat.
-- Productos · Nº Platos · Ord. Preparación) salen dos ideas que nos faltaban, y
-- las dos importan:
--
-- 1) LAS OPCIONES SALEN DE UNA CATEGORÍA, no de una lista de platos.
--    Ágora apunta el paso «PRIMEROS» a la categoría «PRIMEROS MENU». Así,
--    cambiar el menú del día es cambiar QUÉ HAY EN LA CATEGORÍA — que es lo que
--    hace el encargado un martes a las once — en vez de entrar a editar el menú
--    y añadir y quitar platos uno a uno. Con 30 `menu_choice` a mano, el menú
--    del día se queda viejo el primer día que alguien tiene prisa.
--
-- 2) EL PASE SE CONFIGURA, NO SE ADIVINA.
--    Hoy `paseDeGrupo()` lo saca con un regex del NOMBRE del grupo
--    («postre»→4, «bebid»→5…). Un bar que llame a un paso «Para picar» o
--    «Entrantes» se queda SIN PASE: la comanda sale sin ordenar y cocina no
--    sabe qué va antes. No da ningún error; simplemente sale mal.
--
-- Aditivo. `menu_choice` se queda: los dos modos conviven (categoría entera, o
-- lista explícita para el menú de Nochevieja que se monta a dedo).

alter table public.menu_group add column if not exists category_id uuid
  references public.category(id) on delete set null;
alter table public.menu_group add column if not exists num_platos int not null default 1;
alter table public.menu_group add column if not exists orden_prep int;

comment on column public.menu_group.category_id is
  'De qué categoría salen las opciones de este paso. null = se usan las de menu_choice.';
comment on column public.menu_group.num_platos is
  'Cuántos platos se eligen en este paso (el «Nº Platos» de Ágora). 1 = uno.';
comment on column public.menu_group.orden_prep is
  'Pase de cocina: 1 primeros, 2 segundos, 3 terceros, 4 postres, 5 bebidas. null = se deduce del nombre.';

-- Los pasos que ya existen conservan el pase que HOY se estaba deduciendo del
-- nombre, para que rellenar la columna no cambie lo que sale por cocina. Solo
-- se tocan los que están vacíos: si alguien ya lo configuró, manda lo suyo.
update public.menu_group set orden_prep = case
    when lower(nombre) like '%postre%' then 4
    when lower(nombre) like '%bebid%'  then 5
    when lower(nombre) like '1%' or lower(nombre) like '%prim%' then 1
    when lower(nombre) like '2%' or lower(nombre) like '%segu%' then 2
    when lower(nombre) like '3%' or lower(nombre) like '%terc%' then 3
  end
where orden_prep is null;
