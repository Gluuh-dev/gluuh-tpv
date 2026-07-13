-- 0095 — Traspaso entre mesas y división de cuenta ATÓMICOS.
--
-- Antes ambas operaciones hacían N escrituras sueltas desde el navegador:
--   · Traspaso: insert en destino → delete/update en origen, línea a línea. Un fallo
--     a medias dejaba líneas DUPLICADAS (ya insertadas en destino, no borradas del
--     origen) o perdidas.
--   · División: update + delete de las líneas del pedido base y luego N inserts de
--     sales_order SIN comprobar el resultado → una parte de la cuenta podía
--     desaparecer en silencio.
-- Aquí cada operación va en UNA transacción.
--
-- SECURITY INVOKER (por defecto): corre con la RLS del usuario → aislamiento por
-- tenant intacto; el trigger set_tenant_id (0004) rellena tenant_id en los inserts.

-- ── Traspaso ────────────────────────────────────────────────────────────────────
-- p_movimientos: [{"clave":"<clave de línea>","uds":n}, …]. Vacío/null = mesa entera.
-- OJO: la clave es la de la COMANDA (order_line.modificadores->>'key'), NO el
-- product_id: un mismo producto puede estar en varias líneas (formato, extras,
-- descuento) y hay que mover exactamente la que eligió el camarero.
create or replace function traspasar_lineas(
  p_origen       uuid,
  p_destino_mesa uuid,
  p_location     uuid,
  p_user         uuid,
  p_movimientos  jsonb default '[]'::jsonb
) returns uuid
language plpgsql
as $$
declare
  v_dest    uuid;
  v_l       record;
  v_clave   text;
  v_mover   numeric;
  v_total   numeric;
  v_mesa_or uuid;
  v_todo    boolean := (p_movimientos is null or jsonb_array_length(p_movimientos) = 0);
begin
  select table_id into v_mesa_or from sales_order where id = p_origen;

  -- Pedido destino: reutiliza el abierto de la mesa o crea uno.
  select id into v_dest from sales_order
   where table_id = p_destino_mesa
     and estado in ('ABIERTA','ENVIADA_COCINA','SERVIDA','POR_COBRAR')
   order by created_at desc limit 1;

  if v_dest is null then
    insert into sales_order (location_id, table_id, user_id, canal, estado,
                             estado_preparacion, total, client_id)
    values (p_location, p_destino_mesa, p_user, 'TPV', 'ENVIADA_COCINA',
            'EN_PREPARACION', 0, gen_random_uuid())
    returning id into v_dest;
  end if;

  for v_l in select * from order_line where order_id = p_origen loop
    v_clave := coalesce(v_l.modificadores->>'key', v_l.product_id::text);
    if v_todo then
      v_mover := v_l.cantidad;
    else
      select coalesce(max((m->>'uds')::numeric), 0) into v_mover
        from jsonb_array_elements(p_movimientos) m
       where m->>'clave' = v_clave;
      v_mover := least(coalesce(v_mover, 0), v_l.cantidad);
    end if;
    if v_mover is null or v_mover <= 0 then continue; end if;

    insert into order_line (order_id, product_id, nombre, cantidad, precio_unitario,
                            tipo_impositivo, notas, estacion, modificadores, pase)
    values (v_dest, v_l.product_id, v_l.nombre, v_mover, v_l.precio_unitario,
            v_l.tipo_impositivo, v_l.notas, v_l.estacion, v_l.modificadores, v_l.pase);

    if v_mover >= v_l.cantidad then
      delete from order_line where id = v_l.id;
    else
      update order_line set cantidad = cantidad - v_mover where id = v_l.id;
    end if;
  end loop;

  -- Totales y estados
  select coalesce(sum(cantidad * precio_unitario), 0) into v_total
    from order_line where order_id = v_dest;
  update sales_order set total = round(v_total, 2) where id = v_dest;
  update restaurant_table set estado = 'OCUPADA' where id = p_destino_mesa;

  if exists (select 1 from order_line where order_id = p_origen) then
    select coalesce(sum(cantidad * precio_unitario), 0) into v_total
      from order_line where order_id = p_origen;
    update sales_order set total = round(v_total, 2) where id = p_origen;
  else
    -- Origen vacío: se anula y se libera su mesa.
    update sales_order set estado = 'ANULADA', total = 0 where id = p_origen;
    if v_mesa_or is not null then
      update restaurant_table set estado = 'LIBRE' where id = v_mesa_or;
    end if;
  end if;

  return v_dest;
end;
$$;

grant execute on function traspasar_lineas(uuid, uuid, uuid, uuid, jsonb) to authenticated;

-- ── División de cuenta ──────────────────────────────────────────────────────────
-- p_docs: [{"total":n,"lineas":[{product_id,nombre,cantidad,precio_unitario,
--           tipo_impositivo,notas,estacion,modificadores}, …]}, …]
-- El doc 1 se queda en el pedido original (o se crea si no había); el resto salen
-- como cuentas de barra aparcadas "<etiqueta> (2)", "(3)"…, cobrables por separado.
create or replace function dividir_cuenta(
  p_origen        uuid,
  p_location      uuid,
  p_mesa          uuid,
  p_user          uuid,
  p_etiqueta_base text,
  p_campos        jsonb,
  p_docs          jsonb
) returns void
language plpgsql
as $$
declare
  v_base uuid := p_origen;
  v_id   uuid;
  v_doc  jsonb;
  v_i    int := 0;
begin
  for v_doc in select value from jsonb_array_elements(p_docs) loop
    v_i := v_i + 1;

    if v_i = 1 then
      if v_base is null then
        insert into sales_order (location_id, table_id, user_id, canal, estado,
                                 estado_preparacion, total, client_id, tipo_operacion,
                                 motivo_no_venta, comensales, customer_id,
                                 cliente_nombre, cliente_telefono)
        values (p_location, p_mesa, p_user, 'TPV', 'ENVIADA_COCINA', 'EN_PREPARACION',
                (v_doc->>'total')::numeric, gen_random_uuid(),
                p_campos->>'tipo_operacion', p_campos->>'motivo_no_venta',
                (p_campos->>'comensales')::int, (p_campos->>'customer_id')::uuid,
                p_campos->>'cliente_nombre', p_campos->>'cliente_telefono')
        returning id into v_base;
      else
        update sales_order
           set estado             = 'ENVIADA_COCINA',
               estado_preparacion = 'EN_PREPARACION',
               total              = (v_doc->>'total')::numeric,
               tipo_operacion     = p_campos->>'tipo_operacion',
               motivo_no_venta    = p_campos->>'motivo_no_venta',
               comensales         = (p_campos->>'comensales')::int,
               customer_id        = (p_campos->>'customer_id')::uuid,
               cliente_nombre     = p_campos->>'cliente_nombre',
               cliente_telefono   = p_campos->>'cliente_telefono'
         where id = v_base;
        delete from order_line where order_id = v_base;
      end if;
      v_id := v_base;
    else
      insert into sales_order (location_id, table_id, user_id, canal, estado,
                               estado_preparacion, total, client_id, aparcado_como,
                               tipo_operacion, motivo_no_venta, comensales,
                               customer_id, cliente_nombre, cliente_telefono)
      values (p_location, null, p_user, 'TPV', 'ENVIADA_COCINA', 'EN_PREPARACION',
              (v_doc->>'total')::numeric, gen_random_uuid(),
              p_etiqueta_base || ' (' || v_i || ')',
              p_campos->>'tipo_operacion', p_campos->>'motivo_no_venta',
              (p_campos->>'comensales')::int, (p_campos->>'customer_id')::uuid,
              p_campos->>'cliente_nombre', p_campos->>'cliente_telefono')
      returning id into v_id;
    end if;

    insert into order_line (order_id, product_id, nombre, cantidad, precio_unitario,
                            tipo_impositivo, notas, estacion, modificadores)
    select v_id,
           (l->>'product_id')::uuid,
           l->>'nombre',
           (l->>'cantidad')::numeric,
           (l->>'precio_unitario')::numeric,
           (l->>'tipo_impositivo')::numeric,
           l->>'notas',
           l->>'estacion',
           coalesce(l->'modificadores', '[]'::jsonb)
      from jsonb_array_elements(v_doc->'lineas') l;
  end loop;

  if p_mesa is not null then
    update restaurant_table set estado = 'OCUPADA' where id = p_mesa;
  end if;
end;
$$;

grant execute on function dividir_cuenta(uuid, uuid, uuid, uuid, text, jsonb, jsonb) to authenticated;
