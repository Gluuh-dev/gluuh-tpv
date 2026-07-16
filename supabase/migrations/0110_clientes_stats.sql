-- =============================================================================
--  0110_clientes_stats.sql — Visitas y última visita por cliente (para la lista de
--  clientes del TPV, como el mockup: "34 visitas · Ayer"). Función SQL normal
--  (SECURITY INVOKER): la RLS de sales_order ya la limita al tenant del que llama.
-- =============================================================================

create or replace function public.clientes_stats()
returns table (customer_id uuid, visitas bigint, ultima timestamptz)
language sql
stable
as $$
  select customer_id, count(*)::bigint as visitas, max(created_at) as ultima
  from public.sales_order
  where customer_id is not null
  group by customer_id;
$$;

grant execute on function public.clientes_stats() to authenticated;
