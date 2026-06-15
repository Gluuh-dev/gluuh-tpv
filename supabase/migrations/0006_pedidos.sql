-- =============================================================================
--  0006_pedidos.sql — Pedidos reales en Supabase + Realtime.
-- =============================================================================

-- Consumo (local / para llevar) a nivel de pedido
ALTER TABLE public.sales_order ADD COLUMN IF NOT EXISTS tipo_consumo text;

-- Realtime para que KDS/display reciban cambios al instante (clientes autenticados)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_order;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_line;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Crear pedido desde el servidor (kiosko/anon vía service key). Asigna número.
CREATE OR REPLACE FUNCTION public.crear_pedido_srv(
  p_tenant uuid, p_location uuid, p_canal text, p_tipo_consumo text, p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num int; v_order uuid; v_total numeric(12,2); it jsonb;
BEGIN
  SELECT coalesce(max(numero_pedido), 0) + 1 INTO v_num
  FROM sales_order WHERE location_id = p_location;

  SELECT coalesce(sum((x->>'precio')::numeric * (x->>'cantidad')::numeric), 0) INTO v_total
  FROM jsonb_array_elements(p_items) x;

  INSERT INTO sales_order (tenant_id, location_id, canal, tipo_operacion, estado, estado_preparacion, numero_pedido, tipo_consumo, total, client_id)
  VALUES (p_tenant, p_location, p_canal, 'VENTA', 'ENVIADA_COCINA', 'PENDIENTE', v_num, p_tipo_consumo, v_total, gen_random_uuid())
  RETURNING id INTO v_order;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_line (tenant_id, order_id, product_id, nombre, cantidad, precio_unitario, tipo_impositivo)
    VALUES (p_tenant, v_order, NULLIF(it->>'product_id', '')::uuid, it->>'nombre',
            (it->>'cantidad')::numeric, (it->>'precio')::numeric, coalesce((it->>'tipo')::numeric, 0));
  END LOOP;

  RETURN jsonb_build_object('id', v_order, 'numero', v_num);
END;
$$;
