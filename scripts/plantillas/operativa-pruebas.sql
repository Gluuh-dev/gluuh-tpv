-- ============================================================================
-- DATOS OPERATIVOS del «Restaurante de pruebas» (tenant 4c792677…).
--
-- Añade lo que le faltaba a la semilla básica (empresa+local+equipo+carta) para
-- ser un bar realista contra el que probar EN REAL: salas y mesas, tarifas con
-- precios por tarifa, formatos múltiples, un cliente de prueba, tipos de cliente,
-- descuentos e impresoras con rutas de cocina/barra.
--
-- IDEMPOTENTE: cada bloque comprueba antes de insertar; correrlo dos veces no
-- duplica. NO cambia el id del tenant ni pisa lo que ya tiene.
-- Se aplica en el nodo (55432) y en la nube (mismo tenant), para que coincidan.
-- ============================================================================
do $$
declare
  v_tenant uuid := '4c792677-c66b-4af8-bd3f-8c2e32031db8';
  v_loc uuid;
  v_t_terraza uuid; v_t_happy uuid;
  v_room_comedor uuid; v_room_terraza uuid;
  v_p_cocina uuid; v_p_barra uuid;
begin
  select id into v_loc from public.location where tenant_id = v_tenant order by created_at limit 1;
  if v_loc is null then raise exception 'El tenant de pruebas no tiene local'; end if;

  -- ── TARIFAS ────────────────────────────────────────────────────────────────
  -- General = precio de carta (no necesita filas: «si la tarifa no dice nada, se
  -- cobra el precio normal»). Terraza recarga, Happy hour descuenta.
  if not exists (select 1 from public.tarifa where tenant_id = v_tenant) then
    insert into public.tarifa (tenant_id, nombre, descripcion) values
      (v_tenant, 'General',     'Precio de carta'),
      (v_tenant, 'Terraza',     'Recargo del 10 % en terraza'),
      (v_tenant, 'Happy hour',  '20 % de descuento en bebidas de barra');
  end if;
  select id into v_t_terraza from public.tarifa where tenant_id = v_tenant and nombre = 'Terraza';
  select id into v_t_happy   from public.tarifa where tenant_id = v_tenant and nombre = 'Happy hour';

  -- Precios por tarifa: Terraza +10 % a todo; Happy hour −20 % solo a barra.
  insert into public.product_price (tenant_id, product_id, tarifa_id, precio)
    select v_tenant, p.id, v_t_terraza, round(p.precio * 1.10, 2)
    from public.product p
    where p.tenant_id = v_tenant and p.precio is not null
    on conflict (tenant_id, product_id, tarifa_id) do nothing;
  insert into public.product_price (tenant_id, product_id, tarifa_id, precio)
    select v_tenant, p.id, v_t_happy, round(p.precio * 0.80, 2)
    from public.product p
    where p.tenant_id = v_tenant and p.precio is not null and p.estacion = 'BARRA'
    on conflict (tenant_id, product_id, tarifa_id) do nothing;

  -- ── SALAS Y MESAS ──────────────────────────────────────────────────────────
  if not exists (select 1 from public.room where tenant_id = v_tenant) then
    insert into public.room (tenant_id, location_id, nombre, orden, tarifa_id)
      values (v_tenant, v_loc, 'Comedor', 0, null) returning id into v_room_comedor;
    insert into public.room (tenant_id, location_id, nombre, orden, tarifa_id)
      values (v_tenant, v_loc, 'Terraza', 1, v_t_terraza) returning id into v_room_terraza;
    -- Comedor: 10 mesas en rejilla 5×2; capacidad variada.
    insert into public.restaurant_table (tenant_id, room_id, nombre, capacidad, pos_x, pos_y)
      select v_tenant, v_room_comedor, 'M' || g,
             case when g % 3 = 0 then 6 when g % 2 = 0 then 4 else 2 end,
             ((g - 1) % 5) * 140 + 60, ((g - 1) / 5) * 120 + 60
      from generate_series(1, 10) g;
    -- Terraza: 4 mesas de 4 en fila.
    insert into public.restaurant_table (tenant_id, room_id, nombre, capacidad, pos_x, pos_y)
      select v_tenant, v_room_terraza, 'T' || g, 4, ((g - 1) % 4) * 140 + 60, 60
      from generate_series(1, 4) g;
  end if;

  -- ── FORMATOS MÚLTIPLES ─────────────────────────────────────────────────────
  -- El PRIMER formato (orden 0) = precio base, para no cambiar el precio que ya
  -- se ve en el botón; las variantes suben.
  -- Cervezas → Caña / Doble / Jarra.
  insert into public.product_format (tenant_id, product_id, nombre, precio, orden)
    select v_tenant, p.id, x.nombre, round(p.precio * x.factor, 2), x.orden
    from public.product p
    join public.category c on c.id = p.category_id
    cross join (values ('Caña',1.0,0), ('Doble',1.6,1), ('Jarra',2.2,2)) x(nombre, factor, orden)
    where p.tenant_id = v_tenant and c.nombre = 'Cervezas'
      and not exists (select 1 from public.product_format f where f.product_id = p.id and f.nombre = x.nombre);
  -- Para picar → Ración / Media / Fuente.
  insert into public.product_format (tenant_id, product_id, nombre, precio, orden)
    select v_tenant, p.id, x.nombre, round(p.precio * x.factor, 2), x.orden
    from public.product p
    join public.category c on c.id = p.category_id
    cross join (values ('Ración',1.0,0), ('Media ración',0.6,1), ('Fuente',1.7,2)) x(nombre, factor, orden)
    where p.tenant_id = v_tenant and c.nombre = 'Para picar'
      and not exists (select 1 from public.product_format f where f.product_id = p.id and f.nombre = x.nombre);

  -- ── CLIENTE DE PRUEBA + TIPOS ──────────────────────────────────────────────
  insert into public.customer_type (tenant_id, nombre)
    select v_tenant, x from (values ('Particular'), ('Empresa')) v(x)
    where not exists (select 1 from public.customer_type ct where ct.tenant_id = v_tenant and ct.nombre = v.x);
  insert into public.customer (tenant_id, nombre, nif, email, telefono, poblacion, provincia)
    select v_tenant, 'Cliente de prueba', '12345678Z', 'cliente@pruebas.local',
           '600123123', 'Santa Cruz de Tenerife', 'Santa Cruz de Tenerife'
    where not exists (select 1 from public.customer c where c.tenant_id = v_tenant and c.nombre = 'Cliente de prueba');

  -- ── DESCUENTOS ─────────────────────────────────────────────────────────────
  insert into public.discount (tenant_id, nombre, tipo, valor, orden)
    select v_tenant, x.n, 'PORCENTAJE', x.v, x.o from (values
      ('Invitación casa', 100, 0),
      ('Descuento 10 %',   10, 1),
      ('Personal 25 %',    25, 2)) x(n, v, o)
    where not exists (select 1 from public.discount d where d.tenant_id = v_tenant and d.nombre = x.n);

  -- ── IMPRESORAS + RUTAS ─────────────────────────────────────────────────────
  if not exists (select 1 from public.printer where tenant_id = v_tenant) then
    insert into public.printer (tenant_id, location_id, nombre, rol) values
      (v_tenant, v_loc, 'Caja',   'TICKETS'),
      (v_tenant, v_loc, 'Cocina', 'COCINA'),
      (v_tenant, v_loc, 'Barra',  'BARRA');
  end if;
  select id into v_p_cocina from public.printer where tenant_id = v_tenant and nombre = 'Cocina';
  select id into v_p_barra  from public.printer where tenant_id = v_tenant and nombre = 'Barra';
  insert into public.print_route (tenant_id, estacion, printer_id)
    select v_tenant, 'COCINA', v_p_cocina
    where not exists (select 1 from public.print_route r where r.tenant_id = v_tenant and r.estacion = 'COCINA');
  insert into public.print_route (tenant_id, estacion, printer_id)
    select v_tenant, 'BARRA', v_p_barra
    where not exists (select 1 from public.print_route r where r.tenant_id = v_tenant and r.estacion = 'BARRA');
end $$;
