-- 0094 — Reemplazo ATÓMICO de las líneas de una orden (TPV crearOrden).
-- Antes el TPV hacía DELETE de order_line y luego INSERT desde el navegador:
-- un fallo entre medias (red, constraint) dejaba la cuenta guardada con total
-- pero SIN líneas (comanda perdida). Esta función hace ambas cosas en una
-- transacción.
--
-- SECURITY INVOKER (por defecto): corre con la RLS del usuario → el aislamiento
-- por tenant queda intacto, y el trigger set_tenant_id (0004) rellena tenant_id
-- en los inserts igual que cuando insertaba el navegador.
--
-- p_lineas: array JSON con las mismas claves que inserta el TPV hoy:
--   product_id, nombre, cantidad, precio_unitario, tipo_impositivo,
--   notas, estacion, user_id, modificadores, pase
create or replace function reemplazar_lineas_orden(p_order_id uuid, p_lineas jsonb)
returns void
language plpgsql
as $$
begin
  delete from order_line where order_id = p_order_id;
  insert into order_line (order_id, product_id, nombre, cantidad, precio_unitario,
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
end;
$$;

grant execute on function reemplazar_lineas_orden(uuid, jsonb) to authenticated;
