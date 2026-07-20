-- 0131 — Que las tarifas SE COBREN.
--
-- El problema: había 75 precios en `product_price` que no ha cobrado nadie
-- nunca. `valorar_linea_pedido` (0053) valora SIEMPRE con `product.precio`, y
-- la tarifa solo se podía asignar a un CLIENTE (`customer.tarifa_id`, 0 filas).
-- Un bar no le pone tarifa a cada cliente: le pone otro precio A LA TERRAZA.
--
-- Por eso la sala elige tarifa, y la valoración la aplica.
--
-- ⚠ RUTA DEL DINERO. La regla que no se rompe: **si no hay precio de tarifa se
-- cobra `product.precio`**. Nunca 0, nunca null. Una tarifa a medio rellenar
-- tiene que cobrar de más (el precio normal), jamás regalar el género.
--
-- La propiedad de seguridad de la 0053 se mantiene intacta: el precio lo pone
-- SIEMPRE el servidor y el que manda el cliente se sigue ignorando.

-- ── La sala elige tarifa ────────────────────────────────────────────────────
alter table public.room add column if not exists tarifa_id uuid references public.tarifa(id) on delete set null;
comment on column public.room.tarifa_id is
  'Tarifa que se aplica a las mesas de esta sala. null = precio normal del artículo.';

-- Buscar el precio de un producto en una tarifa es lo que se hace por CADA
-- línea de CADA pedido: sin índice, un bar con 1.200 artículos escanea la tabla
-- entera en mitad de un servicio.
create unique index if not exists product_price_unico
  on public.product_price (tenant_id, product_id, tarifa_id);

-- ── El precio que toca cobrar ───────────────────────────────────────────────
-- Aparte y con nombre propio para poder probarla sola: es UNA regla y es la que
-- decide lo que paga el cliente.
create or replace function public.precio_de_venta(
  p_tenant uuid, p_product uuid, p_tarifa uuid
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    -- 1) el de la tarifa, si esa tarifa tiene precio para este artículo
    (select pp.precio from product_price pp
      where pp.tenant_id = p_tenant and pp.product_id = p_product
        and pp.tarifa_id = p_tarifa and p_tarifa is not null),
    -- 2) y si no, el de siempre
    (select p.precio from product p where p.id = p_product and p.tenant_id = p_tenant)
  );
$$;

-- ── Valoración con tarifa ───────────────────────────────────────────────────
-- El parámetro va con DEFAULT NULL: sin tarifa se comporta EXACTAMENTE como
-- antes, así que los llamantes que no la pasan no cambian de comportamiento.
-- Hay que borrar la de 2 argumentos primero o la llamada quedaría ambigua.
drop function if exists public.valorar_linea_pedido(uuid, jsonb);

create or replace function public.valorar_linea_pedido(
  p_tenant uuid, p_item jsonb, p_tarifa uuid default null,
  OUT o_product uuid, OUT o_nombre text, OUT o_cantidad numeric,
  OUT o_precio numeric, OUT o_tipo numeric
) returns record
language plpgsql stable security definer set search_path = public as $$
DECLARE v_agotado timestamptz;
BEGIN
  o_product := NULLIF(p_item->>'product_id', '')::uuid;
  IF o_product IS NULL THEN
    RAISE EXCEPTION 'Línea sin product_id';
  END IF;

  o_cantidad := (p_item->>'cantidad')::numeric;
  IF o_cantidad IS NULL OR o_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida para el producto %', o_product;
  END IF;

  SELECT p.nombre, p.tipo_impositivo, p.agotado_hasta
    INTO o_nombre, o_tipo, v_agotado
  FROM product p
  WHERE p.id = o_product AND p.tenant_id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe en este negocio', o_product;
  END IF;
  IF v_agotado IS NOT NULL AND v_agotado > now() THEN
    RAISE EXCEPTION 'Producto % agotado', o_nombre;
  END IF;

  -- Aquí está el cambio, y es el único: el precio sale de la tarifa y, si esa
  -- tarifa no dice nada de este artículo, del precio normal.
  o_precio := public.precio_de_venta(p_tenant, o_product, p_tarifa);

  IF o_precio IS NULL THEN
    -- Precio variable: ÚNICO caso en que se acepta el precio del cliente
    -- (igual que en la 0053; hoy la columna es NOT NULL y no se ejercita).
    o_precio := (p_item->>'precio')::numeric;
    IF o_precio IS NULL OR o_precio < 0 THEN
      RAISE EXCEPTION 'Producto % es de precio variable: falta el precio', o_nombre;
    END IF;
  END IF;
END;
$$;

-- Mismos permisos que tenía: helper interno de las RPC, no invocable de fuera.
revoke execute on function public.valorar_linea_pedido(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.precio_de_venta(uuid, uuid, uuid) from public, anon, authenticated;

-- ── Qué tarifa toca ─────────────────────────────────────────────────────────
-- Primero la de la SALA de la mesa (el precio de terraza), y si no, la del
-- cliente (precio pactado con una empresa). La sala manda porque es donde se
-- está consumiendo: un cliente con tarifa que se sienta en la terraza paga
-- terraza.
create or replace function public.tarifa_de_pedido(p_order uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.tarifa_id
       from sales_order o
       join restaurant_table t on t.id = o.table_id
       join room r on r.id = t.room_id
      where o.id = p_order),
    (select c.tarifa_id
       from sales_order o
       join customer c on c.id = o.customer_id
      where o.id = p_order)
  );
$$;
