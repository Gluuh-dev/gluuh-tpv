-- =============================================================================
--  0053_precios_server_side.sql — Seguridad C1: los precios se valoran SIEMPRE
--  en el servidor.
--
--  Antes, crear_pedido (0009) y crear_pedido_srv (0006) aceptaban `precio` y
--  `tipo` del cliente y los usaban tal cual para order_line y el total: el
--  kiosko (público, sesión de tenant) podía enviar precio 0. Ahora cada línea
--  se valora con product.precio y product.tipo_impositivo del propio tenant.
--
--  Firmas SIN cambios (el kiosko y otros llamantes no se tocan). Cambios de
--  comportamiento deliberados:
--    - Toda línea exige un product_id existente en el tenant; si no, EXCEPTION
--      (se acabaron las líneas fantasma / texto libre por estas RPC).
--    - `precio` y `tipo` entrantes se IGNORAN. Única excepción: si algún día
--      product.precio pasa a ser NULL (precio variable, catálogo pendiente de
--      gluuh-base-datos), solo en ese caso se acepta el precio del cliente
--      (>= 0); hoy la columna es NOT NULL, así que la rama no se ejercita.
--    - `nombre` también se copia de la BD (snapshot fiable en el ticket).
--    - Producto agotado (agotado_hasta > now()) se rechaza: el kiosko no debe
--      poder colar un 86.
-- =============================================================================

-- Valoración de una línea contra el catálogo del tenant. Compartida por ambas
-- RPC para no duplicar la lógica de precios.
CREATE OR REPLACE FUNCTION public.valorar_linea_pedido(
  p_tenant uuid, p_item jsonb,
  OUT o_product uuid, OUT o_nombre text, OUT o_cantidad numeric,
  OUT o_precio numeric, OUT o_tipo numeric
) RETURNS record
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  SELECT p.nombre, p.precio, p.tipo_impositivo, p.agotado_hasta
    INTO o_nombre, o_precio, o_tipo, v_agotado
  FROM product p
  WHERE p.id = o_product AND p.tenant_id = p_tenant;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe en este negocio', o_product;
  END IF;
  IF v_agotado IS NOT NULL AND v_agotado > now() THEN
    RAISE EXCEPTION 'Producto % agotado', o_nombre;
  END IF;

  IF o_precio IS NULL THEN
    -- Precio variable: ÚNICO caso en que se acepta el precio del cliente.
    o_precio := (p_item->>'precio')::numeric;
    IF o_precio IS NULL OR o_precio < 0 THEN
      RAISE EXCEPTION 'Producto % es de precio variable: falta el precio', o_nombre;
    END IF;
  END IF;
END;
$$;

-- Kiosko autenticado: tenant/local se derivan de la sesión.
CREATE OR REPLACE FUNCTION public.crear_pedido(p_tipo_consumo text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid; v_loc uuid; v_num int; v_order uuid;
  v_total numeric(12,2) := 0;
  it jsonb; l record;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin líneas';
  END IF;

  SELECT id INTO v_loc FROM location WHERE tenant_id = v_tenant ORDER BY created_at LIMIT 1;
  SELECT coalesce(max(numero_pedido), 0) + 1 INTO v_num FROM sales_order WHERE location_id = v_loc;

  INSERT INTO sales_order (tenant_id, location_id, canal, tipo_operacion, estado, estado_preparacion, numero_pedido, tipo_consumo, total, client_id)
  VALUES (v_tenant, v_loc, 'KIOSKO', 'VENTA', 'ENVIADA_COCINA', 'PENDIENTE', v_num, p_tipo_consumo, 0, gen_random_uuid())
  RETURNING id INTO v_order;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    l := public.valorar_linea_pedido(v_tenant, it);
    INSERT INTO order_line (tenant_id, order_id, product_id, nombre, cantidad, precio_unitario, tipo_impositivo)
    VALUES (v_tenant, v_order, l.o_product, l.o_nombre, l.o_cantidad, l.o_precio, l.o_tipo);
    v_total := v_total + round(l.o_precio * l.o_cantidad, 2);
  END LOOP;

  UPDATE sales_order SET total = v_total WHERE id = v_order;
  RETURN jsonb_build_object('id', v_order, 'numero', v_num);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido(text, jsonb) TO authenticated;

-- Variante servidor (service key): el tenant llega como parámetro.
CREATE OR REPLACE FUNCTION public.crear_pedido_srv(
  p_tenant uuid, p_location uuid, p_canal text, p_tipo_consumo text, p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_num int; v_order uuid;
  v_total numeric(12,2) := 0;
  it jsonb; l record;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Pedido sin líneas';
  END IF;

  SELECT coalesce(max(numero_pedido), 0) + 1 INTO v_num
  FROM sales_order WHERE location_id = p_location;

  INSERT INTO sales_order (tenant_id, location_id, canal, tipo_operacion, estado, estado_preparacion, numero_pedido, tipo_consumo, total, client_id)
  VALUES (p_tenant, p_location, p_canal, 'VENTA', 'ENVIADA_COCINA', 'PENDIENTE', v_num, p_tipo_consumo, 0, gen_random_uuid())
  RETURNING id INTO v_order;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    l := public.valorar_linea_pedido(p_tenant, it);
    INSERT INTO order_line (tenant_id, order_id, product_id, nombre, cantidad, precio_unitario, tipo_impositivo)
    VALUES (p_tenant, v_order, l.o_product, l.o_nombre, l.o_cantidad, l.o_precio, l.o_tipo);
    v_total := v_total + round(l.o_precio * l.o_cantidad, 2);
  END LOOP;

  UPDATE sales_order SET total = v_total WHERE id = v_order;
  RETURN jsonb_build_object('id', v_order, 'numero', v_num);
END;
$$;

-- crear_pedido_srv es SOLO para la service key (recibe p_tenant arbitrario):
-- nunca debe ser invocable por anon/authenticated vía PostgREST.
REVOKE EXECUTE ON FUNCTION public.crear_pedido_srv(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
-- valorar_linea_pedido es un helper interno de las RPC anteriores.
REVOKE EXECUTE ON FUNCTION public.valorar_linea_pedido(uuid, jsonb) FROM PUBLIC, anon, authenticated;
