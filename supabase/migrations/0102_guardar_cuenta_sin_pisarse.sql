-- 0102 — GUARDAR UNA CUENTA SIN QUE DOS CAMAREROS SE PISEN.
--
-- ─────────────────────────────────────────────────────────────────────────────
--  LA MESA 5, UN VIERNES A LAS 22:00
--
--  Ana abre la mesa 5 en el TPV de la barra. Tiene 2 cañas.
--  Berto abre la MISMA mesa 5 en el comandero. También ve 2 cañas.
--
--  Ana añade una tortilla y guarda.  → la mesa tiene 2 cañas + tortilla.
--  Berto añade un vino y guarda.     → Berto manda SU foto: 2 cañas + vino.
--
--  **La tortilla desaparece.** Nadie ve un error. El cliente se la come y no la paga, y
--  el arqueo de la noche no cuadra por 8 €. Y nadie sabrá nunca por qué.
--
--  Pasa porque guardar era «borra todas las líneas y mete las mías»
--  (`reemplazar_lineas_orden`, migración 0094) sin mirar si alguien había tocado la
--  cuenta mientras tanto. En un bar con dos TPV y una mesa compartida, esto no es un caso
--  raro de laboratorio: es un viernes.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Se arregla con una VERSIÓN. El TPV, al abrir la mesa, se queda con su `updated_at`. Al
-- guardar lo devuelve. Si no coincide con el que hay ahora, es que otro ha guardado por
-- medio: **no se pisa nada**, se avisa, y el TPV recarga la mesa.
--
-- Es control optimista, y aquí es lo correcto: dos camareros sobre la misma mesa a la vez
-- es raro, pero cuando pasa, pasa con dinero de por medio. Bloquear la mesa mientras uno
-- la mira sería peor: un camarero que se va al baño con la mesa 5 abierta dejaría a los
-- demás sin poder tocarla.

-- Guarda la cuenta ENTERA (cabecera + líneas) de una vez.
--
-- Antes eran dos llamadas desde el navegador: `update sales_order` y luego el RPC de las
-- líneas. Entre una y otra podía irse la red y quedaba una cuenta con el total nuevo y las
-- líneas viejas. Ahora es **una transacción**: o entra todo, o no entra nada.
create or replace function public.guardar_cuenta(
  p_order_id uuid,
  p_lineas   jsonb,
  p_cuenta   jsonb,
  -- La versión que el TPV cree tener. `null` = «no compruebes» (lo usa quien crea la
  -- cuenta desde cero, que no tiene con qué chocar).
  p_version  timestamptz default null
)
returns timestamptz
language plpgsql
-- SECURITY INVOKER (por defecto): corre con la RLS de quien llama, así que un `order_id`
-- de otro bar no existe para él. El aislamiento entre empresas queda intacto.
as $$
declare
  v_version timestamptz;
begin
  -- `for update`: si dos TPV entran a la vez, el segundo ESPERA aquí. Cuando pase, verá la
  -- versión que dejó el primero y saltará el aviso de abajo. Sin esto, los dos leerían la
  -- misma versión vieja, los dos la darían por buena, y volveríamos al punto de partida.
  select updated_at into v_version
    from public.sales_order
   where id = p_order_id
   for update;

  if not found then
    raise exception 'La cuenta no existe' using errcode = 'GLU02';
  end if;

  if p_version is not null and v_version is distinct from p_version then
    -- SQLSTATE propio: el TPV lo distingue de un fallo de red y sabe que tiene que
    -- recargar la mesa en vez de reintentar (reintentar volvería a pisar).
    raise exception 'Otro TPV ha cambiado esta cuenta'
      using errcode = 'GLU01',
            hint = 'Recarga la mesa: alguien ha añadido o quitado algo mientras la tenías abierta.';
  end if;

  -- ── La cabecera ───────────────────────────────────────────────────────────
  -- Sólo lo que el TPV manda. `coalesce(p_cuenta->>'x', columna)` NO vale: no distingue
  -- «no lo mando» de «ponlo a null» —y hay campos que SÍ se ponen a null a propósito
  -- (quitarle el cliente a una cuenta). Se mira si la clave viene.
  update public.sales_order o set
    estado             = case when p_cuenta ? 'estado'             then p_cuenta->>'estado'             else o.estado end,
    estado_preparacion = case when p_cuenta ? 'estado_preparacion' then p_cuenta->>'estado_preparacion' else o.estado_preparacion end,
    tipo_operacion     = case when p_cuenta ? 'tipo_operacion'     then p_cuenta->>'tipo_operacion'     else o.tipo_operacion end,
    motivo_no_venta    = case when p_cuenta ? 'motivo_no_venta'    then p_cuenta->>'motivo_no_venta'    else o.motivo_no_venta end,
    cliente_nombre     = case when p_cuenta ? 'cliente_nombre'     then p_cuenta->>'cliente_nombre'     else o.cliente_nombre end,
    cliente_telefono   = case when p_cuenta ? 'cliente_telefono'   then p_cuenta->>'cliente_telefono'   else o.cliente_telefono end,
    total              = case when p_cuenta ? 'total'              then (p_cuenta->>'total')::numeric   else o.total end,
    comensales         = case when p_cuenta ? 'comensales'         then (p_cuenta->>'comensales')::int  else o.comensales end,
    customer_id        = case when p_cuenta ? 'customer_id'        then (p_cuenta->>'customer_id')::uuid else o.customer_id end,
    -- La versión avanza SIEMPRE, aunque no cambie ni una coma de la cabecera: lo que ha
    -- cambiado son las LÍNEAS, y el siguiente que guarde tiene que enterarse.
    --
    -- (Sin este `now()` explícito, el trigger `set_updated_at` de la 0101 vería una fila
    -- idéntica —`new is not distinct from old`— y NO le movería la fecha. La versión se
    -- quedaría clavada y el control optimista no serviría de nada.)
    updated_at = now()
  where o.id = p_order_id
  returning o.updated_at into v_version;

  -- ── Y las líneas, de golpe ────────────────────────────────────────────────
  delete from public.order_line where order_id = p_order_id;

  insert into public.order_line (order_id, product_id, nombre, cantidad, precio_unitario,
                                 tipo_impositivo, notas, estacion, user_id, modificadores, pase)
  select p_order_id,
         (l->>'product_id')::uuid,
         l->>'nombre',
         coalesce((l->>'cantidad')::numeric, 1),
         (l->>'precio_unitario')::numeric,
         (l->>'tipo_impositivo')::numeric,
         l->>'notas',
         l->>'estacion',
         (l->>'user_id')::uuid,
         coalesce(l->'modificadores', '[]'::jsonb),
         (l->>'pase')::int
    from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) as l;

  return v_version;
end;
$$;

grant execute on function public.guardar_cuenta(uuid, jsonb, jsonb, timestamptz) to authenticated;

-- La vieja se va. No la llamaba nadie más que el TPV, y dejarla ahí es dejar puesta la
-- escopeta: cualquiera que la use vuelve a pisar líneas sin enterarse.
drop function if exists public.reemplazar_lineas_orden(uuid, jsonb);
