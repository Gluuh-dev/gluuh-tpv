-- 0097 — Plano de mesas EN VIVO entre terminales.
--
-- BUG (encontrado el 13-07-2026): si el comandero (o cualquier otra terminal) abría,
-- cobraba o traspasaba una mesa, **los demás TPV no se enteraban**. El plano solo se
-- refrescaba cuando ESE MISMO TPV hacía una operación suya, o al recargar la página.
-- El camarero podía estar mirando un plano mentiroso.
--
-- Causa doble:
--   1) El TPV solo se suscribía por realtime a product/category/family (el catálogo).
--      Arreglado en apps/web/app/tpv/page.tsx (canal `tpv_salas`).
--   2) `restaurant_table` NI SIQUIERA ESTABA PUBLICADA en realtime — así que la
--      suscripción no habría disparado nunca. Eso lo arregla esta migración.
--      (`sales_order` sí estaba publicada: por eso la COCINA sí recibe comandas al
--      instante, pero el plano del TPV no.)
--
-- Recordatorio de la 0081: al crear una tabla que el cliente deba ESCUCHAR, hay que
-- añadirla a la publicación o el realtime no dispara.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'restaurant_table'
  ) then
    alter publication supabase_realtime add table public.restaurant_table;
  end if;
end $$;
