-- Script ÚNICO (no es migración): reemplaza la carta del tenant "Plantilla
-- base" por una copia íntegra de la de Bar Demo (11111111-…), con IDs nuevos.
-- También limpia los pedidos de PRUEBA antiguos del tenant plantilla.
-- Bar Demo solo se LEE. Transaccional: o se aplica entero o nada.
-- Ejecutar en: Supabase Dashboard → SQL Editor. (Preparado el 08-07-2026.)

do $$
declare
  demo uuid := '11111111-1111-1111-1111-111111111111';
  pl uuid;
begin
  select id into pl from tenant where es_plantilla;
  if pl is null or pl = demo then raise exception 'plantilla no encontrada o igual a demo'; end if;

  -- 1. Ventas de PRUEBA antiguas del tenant plantilla.
  delete from invoice      where tenant_id = pl;
  delete from online_order where tenant_id = pl;
  delete from order_event  where tenant_id = pl;
  delete from payment      where tenant_id = pl;
  delete from order_line   where tenant_id = pl;
  delete from sales_order  where tenant_id = pl;

  -- 2. Carta antigua de la plantilla (se reemplaza por la de Bar Demo).
  delete from menu_choice               where tenant_id = pl;
  delete from menu_group                where tenant_id = pl;
  delete from menu                      where tenant_id = pl;
  delete from product_etiqueta          where tenant_id = pl;
  delete from etiqueta_producto         where tenant_id = pl;
  delete from modifier                  where tenant_id = pl;
  delete from modifier_group_asignacion where tenant_id = pl;
  delete from modifier_group            where tenant_id = pl;
  delete from product_format            where tenant_id = pl;
  delete from product_category          where tenant_id = pl;
  delete from product_allergen          where tenant_id = pl;
  delete from product_price             where tenant_id = pl;
  delete from nota_preparacion          where tenant_id = pl;
  delete from product                   where tenant_id = pl;
  delete from category                  where tenant_id = pl;
  delete from family                    where tenant_id = pl;

  -- 3. Mapas de IDs demo → plantilla.
  create temp table mf (old uuid primary key, new uuid) on commit drop;
  create temp table mc (old uuid primary key, new uuid) on commit drop;
  create temp table mp (old uuid primary key, new uuid) on commit drop;
  create temp table mg (old uuid primary key, new uuid) on commit drop;
  create temp table me (old uuid primary key, new uuid) on commit drop;
  create temp table mm (old uuid primary key, new uuid) on commit drop;
  create temp table mmg (old uuid primary key, new uuid) on commit drop;
  insert into mf  select id, gen_random_uuid() from family where tenant_id = demo;
  insert into mc  select id, gen_random_uuid() from category where tenant_id = demo;
  insert into mp  select id, gen_random_uuid() from product where tenant_id = demo;
  insert into mg  select id, gen_random_uuid() from modifier_group where tenant_id = demo;
  insert into me  select id, gen_random_uuid() from etiqueta_producto where tenant_id = demo;
  insert into mm  select id, gen_random_uuid() from menu where tenant_id = demo;
  insert into mmg select id, gen_random_uuid() from menu_group where tenant_id = demo;

  -- 4. Clonado íntegro desde Bar Demo.
  insert into family (id, tenant_id, nombre, orden, color, grupo_mayor_id, mostrar_venta, mostrar_menus, familia_padre_id, orden_impresion, texto_boton, foto_url)
  select m.new, pl, f.nombre, f.orden, f.color, null, f.mostrar_venta, f.mostrar_menus, (select new from mf where old = f.familia_padre_id), f.orden_impresion, f.texto_boton, f.foto_url
  from family f join mf m on m.old = f.id;

  insert into category (id, tenant_id, nombre, orden, family_id, foto_url, estacion, icono, mostrar_venta, mostrar_menus, categoria_padre_id, texto_boton, carta_nombre, carta_descripcion, color)
  select m.new, pl, c.nombre, c.orden, (select new from mf where old = c.family_id), c.foto_url, c.estacion, c.icono, c.mostrar_venta, c.mostrar_menus, (select new from mc where old = c.categoria_padre_id), c.texto_boton, c.carta_nombre, c.carta_descripcion, c.color
  from category c join mc m on m.old = c.id;

  insert into product (id, tenant_id, category_id, nombre, precio, tipo_impositivo, es_alcohol, estacion, foto_url, disponible, clase_fiscal, descripcion, codigo_barras, alergenos, agotado_hasta, vendido_por_peso, orden, nombre_ticket, nombre_cocina, family_id, plu, es_principal, es_anadido, tiempo_preparacion_min, texto_boton, carta_nombre)
  select m.new, pl, (select new from mc where old = p.category_id), p.nombre, p.precio, p.tipo_impositivo, p.es_alcohol, p.estacion, p.foto_url, p.disponible, p.clase_fiscal, p.descripcion, p.codigo_barras, p.alergenos, null, p.vendido_por_peso, p.orden, p.nombre_ticket, p.nombre_cocina, (select new from mf where old = p.family_id), p.plu, p.es_principal, p.es_anadido, p.tiempo_preparacion_min, p.texto_boton, p.carta_nombre
  from product p join mp m on m.old = p.id;

  insert into product_category (tenant_id, product_id, category_id, orden)
  select pl, (select new from mp where old = pc.product_id), (select new from mc where old = pc.category_id), pc.orden
  from product_category pc where pc.tenant_id = demo
    and exists (select 1 from mp where old = pc.product_id) and exists (select 1 from mc where old = pc.category_id);

  insert into product_format (id, tenant_id, product_id, nombre, precio, orden)
  select gen_random_uuid(), pl, (select new from mp where old = f.product_id), f.nombre, f.precio, f.orden
  from product_format f where f.tenant_id = demo and exists (select 1 from mp where old = f.product_id);

  insert into modifier_group (id, tenant_id, product_id, nombre, min_sel, max_sel, tipo)
  select m.new, pl, (select new from mp where old = g.product_id), g.nombre, g.min_sel, g.max_sel, g.tipo
  from modifier_group g join mg m on m.old = g.id;

  insert into modifier (id, tenant_id, modifier_group_id, nombre, precio_extra)
  select gen_random_uuid(), pl, (select new from mg where old = md.modifier_group_id), md.nombre, md.precio_extra
  from modifier md where md.tenant_id = demo and exists (select 1 from mg where old = md.modifier_group_id);

  insert into modifier_group_asignacion (id, tenant_id, modifier_group_id, family_id, category_id, product_id, modo)
  select gen_random_uuid(), pl, (select new from mg where old = a.modifier_group_id),
         (select new from mf where old = a.family_id), (select new from mc where old = a.category_id), (select new from mp where old = a.product_id), a.modo
  from modifier_group_asignacion a where a.tenant_id = demo and exists (select 1 from mg where old = a.modifier_group_id);

  insert into nota_preparacion (id, tenant_id, nombre, descripcion)
  select gen_random_uuid(), pl, n.nombre, n.descripcion from nota_preparacion n where n.tenant_id = demo;

  insert into etiqueta_producto (id, tenant_id, nombre, color)
  select m.new, pl, e.nombre, e.color from etiqueta_producto e join me m on m.old = e.id;

  insert into product_etiqueta (tenant_id, product_id, etiqueta_id)
  select pl, (select new from mp where old = pe.product_id), (select new from me where old = pe.etiqueta_id)
  from product_etiqueta pe where pe.tenant_id = demo
    and exists (select 1 from mp where old = pe.product_id) and exists (select 1 from me where old = pe.etiqueta_id);

  insert into menu (id, tenant_id, nombre, precio, clase_fiscal, activo, orden)
  select m.new, pl, mn.nombre, mn.precio, mn.clase_fiscal, mn.activo, mn.orden from menu mn join mm m on m.old = mn.id;

  insert into menu_group (id, tenant_id, menu_id, nombre, orden)
  select m.new, pl, (select new from mm where old = g.menu_id), g.nombre, g.orden from menu_group g join mmg m on m.old = g.id;

  insert into menu_choice (tenant_id, group_id, product_id)
  select pl, (select new from mmg where old = c.group_id), (select new from mp where old = c.product_id)
  from menu_choice c where c.tenant_id = demo
    and exists (select 1 from mmg where old = c.group_id) and exists (select 1 from mp where old = c.product_id);
end $$;

-- Verificación rápida (ejecutar después):
-- select 'family' t, count(*) from family f join tenant tn on tn.id=f.tenant_id and tn.es_plantilla
-- union all select 'product', count(*) from product p join tenant tn on tn.id=p.tenant_id and tn.es_plantilla;
