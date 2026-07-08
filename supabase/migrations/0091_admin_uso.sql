-- 0091 — Análisis de uso para la consola de plataforma. Dos RPC (SECURITY
-- DEFINER acotadas por es_admin_plataforma, como 0083):
--  · admin_uso_empresas(): ranking global — pedidos 7/30 días, última venta,
--    última conexión de dispositivo y última copia de seguridad por empresa.
--  · admin_uso_empresa(p_tenant): detalle — serie diaria de pedidos/importe
--    (30 días) + las mismas señales.
-- "Uso online" = pedidos en sales_order (el TPV escribe ahí cuando sincroniza);
-- la última copia sale del setting GLOBAL backup.ultima. (Aplicada por MCP el
-- 08-07-2026.)

create or replace function public.admin_uso_empresas()
returns table(
  tenant_id uuid, pedidos_7d bigint, pedidos_30d bigint, importe_30d numeric,
  ultima_venta timestamptz, ultima_conexion timestamptz, ultima_copia timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id,
         (select count(*) from sales_order o where o.tenant_id = t.id and o.deleted_at is null and o.created_at > now() - interval '7 days'),
         (select count(*) from sales_order o where o.tenant_id = t.id and o.deleted_at is null and o.created_at > now() - interval '30 days'),
         (select coalesce(sum(o.total), 0) from sales_order o where o.tenant_id = t.id and o.deleted_at is null and o.created_at > now() - interval '30 days'),
         (select max(o.created_at) from sales_order o where o.tenant_id = t.id and o.deleted_at is null),
         (select max(d.ultima_conexion) from device d where d.tenant_id = t.id),
         (select (s.value->>'fecha')::timestamptz from setting s
           where s.tenant_id = t.id and s.scope = 'GLOBAL' and s.key = 'backup.ultima' limit 1)
  from public.tenant t
  where public.es_admin_plataforma();
$$;
revoke all on function public.admin_uso_empresas() from public, anon;
grant execute on function public.admin_uso_empresas() to authenticated, service_role;

create or replace function public.admin_uso_empresa(p_tenant uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select case when not public.es_admin_plataforma() then null else jsonb_build_object(
    'ventas_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'pedidos', d.n, 'importe', d.imp) order by d.dia), '[]'::jsonb)
      from (
        select created_at::date as dia, count(*) as n, coalesce(sum(total), 0) as imp
        from sales_order
        where tenant_id = p_tenant and deleted_at is null and created_at > now() - interval '30 days'
        group by 1
      ) d),
    'pedidos_7d',  (select count(*) from sales_order o where o.tenant_id = p_tenant and o.deleted_at is null and o.created_at > now() - interval '7 days'),
    'pedidos_30d', (select count(*) from sales_order o where o.tenant_id = p_tenant and o.deleted_at is null and o.created_at > now() - interval '30 days'),
    'importe_30d', (select coalesce(sum(o.total), 0) from sales_order o where o.tenant_id = p_tenant and o.deleted_at is null and o.created_at > now() - interval '30 days'),
    'ultima_venta', (select max(o.created_at) from sales_order o where o.tenant_id = p_tenant and o.deleted_at is null),
    'ultima_conexion', (select max(d.ultima_conexion) from device d where d.tenant_id = p_tenant),
    'ultima_copia', (select s.value->>'fecha' from setting s
                      where s.tenant_id = p_tenant and s.scope = 'GLOBAL' and s.key = 'backup.ultima' limit 1)
  ) end;
$$;
revoke all on function public.admin_uso_empresa(uuid) from public, anon;
grant execute on function public.admin_uso_empresa(uuid) to authenticated, service_role;
