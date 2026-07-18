-- 0124 — separar_cuenta: saca líneas concretas del pedido de una mesa a un
-- sub-pedido cobrable, y las quita de la mesa. ATÓMICO y NO fiscal: solo mueve
-- líneas; el cobro y la factura los hace el camino de cobro ya probado sobre el
-- sub-pedido devuelto. Sirve para "cobrar por artículos → esas líneas SALEN de la
-- mesa" (dividir cuenta). Diseño: docs/plan/dividir-cuenta-y-ciclo.md §7.1.
-- Invoker (como dividir_cuenta): la RLS aísla por tenant; los triggers set_tenant
-- rellenan tenant_id de sales_order/order_line.

create or replace function public.separar_cuenta(
  p_mesa_order uuid,
  p_location   uuid,
  p_user       uuid,
  p_campos     jsonb,
  p_lineas     jsonb   -- [{product_id, nombre, cantidad, precio_unitario, tipo_impositivo, notas, estacion, modificadores{key,...}}]
) returns uuid
language plpgsql
as $$
declare
  v_sub    uuid;
  v_total  numeric := 0;
  v_l      jsonb;
  v_key    text;
  v_actual numeric;
begin
  -- Candado del pedido de la mesa (evita carreras con otro terminal).
  perform 1 from public.sales_order where id = p_mesa_order for update;
  if not found then
    raise exception 'separar_cuenta: pedido de mesa % no existe', p_mesa_order;
  end if;

  for v_l in select value from jsonb_array_elements(p_lineas) loop
    v_total := v_total + (v_l->>'cantidad')::numeric * (v_l->>'precio_unitario')::numeric;
  end loop;
  v_total := round(v_total, 2);

  -- Sub-pedido: barra (sin mesa), listo para cobrar. El label lo identifica si el
  -- cobro se cancela (queda recuperable en «Aparcado», no se pierde nada).
  insert into public.sales_order (location_id, table_id, user_id, canal, estado,
                                  estado_preparacion, total, client_id, aparcado_como,
                                  tipo_operacion, motivo_no_venta, comensales,
                                  customer_id, cliente_nombre, cliente_telefono)
  values (p_location, null, p_user, 'TPV', 'POR_COBRAR', 'ENTREGADO',
          v_total, gen_random_uuid(),
          coalesce(nullif(p_campos->>'etiqueta',''), 'Parte'),
          coalesce(p_campos->>'tipo_operacion','VENTA'), p_campos->>'motivo_no_venta',
          (p_campos->>'comensales')::int, (p_campos->>'customer_id')::uuid,
          p_campos->>'cliente_nombre', p_campos->>'cliente_telefono')
  returning id into v_sub;

  -- Copia las líneas al sub-pedido y las descuenta del pedido de la mesa
  -- (emparejando por modificadores->>'key', que es la clave de comanda).
  for v_l in select value from jsonb_array_elements(p_lineas) loop
    insert into public.order_line (order_id, product_id, nombre, cantidad, precio_unitario,
                                   tipo_impositivo, notas, estacion, modificadores)
    values (v_sub, (v_l->>'product_id')::uuid, v_l->>'nombre', (v_l->>'cantidad')::numeric,
            (v_l->>'precio_unitario')::numeric, (v_l->>'tipo_impositivo')::numeric,
            v_l->>'notas', v_l->>'estacion', coalesce(v_l->'modificadores','{}'::jsonb));

    v_key := v_l->'modificadores'->>'key';
    if v_key is not null then
      select cantidad into v_actual from public.order_line
        where order_id = p_mesa_order and modificadores->>'key' = v_key
        limit 1 for update;
      if found then
        if v_actual <= (v_l->>'cantidad')::numeric then
          delete from public.order_line where order_id = p_mesa_order and modificadores->>'key' = v_key;
        else
          update public.order_line set cantidad = cantidad - (v_l->>'cantidad')::numeric
            where order_id = p_mesa_order and modificadores->>'key' = v_key;
        end if;
      end if;
    end if;
  end loop;

  -- Recalcula el total de la mesa con lo que queda.
  update public.sales_order
     set total = coalesce((select round(sum(cantidad*precio_unitario),2)
                             from public.order_line where order_id = p_mesa_order), 0),
         updated_at = now()
   where id = p_mesa_order;

  return v_sub;
end $$;

revoke all on function public.separar_cuenta(uuid,uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.separar_cuenta(uuid,uuid,uuid,jsonb,jsonb) to authenticated, service_role;
