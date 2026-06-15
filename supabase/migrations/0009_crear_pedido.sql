-- =============================================================================
--  0009_crear_pedido.sql — Crear pedido desde un dispositivo autenticado
--  (kiosko de la empresa). Deriva tenant/local de la sesión y asigna número.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crear_pedido(p_tipo_consumo text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_loc uuid; v_num int; v_order uuid; v_total numeric(12,2); it jsonb;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT id INTO v_loc FROM location WHERE tenant_id = v_tenant ORDER BY created_at LIMIT 1;
  SELECT coalesce(max(numero_pedido), 0) + 1 INTO v_num FROM sales_order WHERE location_id = v_loc;
  SELECT coalesce(sum((x->>'precio')::numeric * (x->>'cantidad')::numeric), 0) INTO v_total
  FROM jsonb_array_elements(p_items) x;

  INSERT INTO sales_order (tenant_id, location_id, canal, tipo_operacion, estado, estado_preparacion, numero_pedido, tipo_consumo, total, client_id)
  VALUES (v_tenant, v_loc, 'KIOSKO', 'VENTA', 'ENVIADA_COCINA', 'PENDIENTE', v_num, p_tipo_consumo, v_total, gen_random_uuid())
  RETURNING id INTO v_order;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_line (tenant_id, order_id, product_id, nombre, cantidad, precio_unitario, tipo_impositivo)
    VALUES (v_tenant, v_order, NULLIF(it->>'product_id', '')::uuid, it->>'nombre',
            (it->>'cantidad')::numeric, (it->>'precio')::numeric, coalesce((it->>'tipo')::numeric, 0));
  END LOOP;

  RETURN jsonb_build_object('id', v_order, 'numero', v_num);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_pedido(text, jsonb) TO authenticated;
