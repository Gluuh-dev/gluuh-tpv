-- 0088 — Plan Básica: 80 €/mes con 1 TPV y 1 impresora incluidos.
-- La cuota base pasa a 80 € y el mensual calculado deja de cobrar el PRIMER
-- TPV vinculado (ya va dentro de la base). La impresora no se tarifica por
-- dispositivo (va en la tabla printer), así que no necesita descuento.
-- (Aplicada por MCP el 08-07-2026.)

update public.tarifa_plataforma
   set etiqueta = 'Básica (incluye 1 TPV y 1 impresora)', precio = 80, updated_at = now()
 where clave = 'BASE';

drop function if exists public.admin_resumen_empresas();
create function public.admin_resumen_empresas()
returns table(
  id uuid, nombre text, cif text, email_admin text, plan text,
  codigo_instalacion text, es_plantilla boolean, activo boolean, licencia_limites jsonb,
  licencia_hasta date, licencia_modulos text[], created_at timestamptz,
  ciclo_pago text, forma_pago text, precio_periodo numeric, proximo_pago date,
  precio_calculado numeric,
  n_productos bigint, n_usuarios bigint, n_dispositivos bigint, n_dispositivos_online bigint
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id, t.nombre, t.cif, t.email_admin, t.plan,
         t.codigo_instalacion, t.es_plantilla, t.activo, t.licencia_limites,
         t.licencia_hasta, t.licencia_modulos, t.created_at,
         t.ciclo_pago, t.forma_pago, t.precio_periodo, t.proximo_pago,
         coalesce((select precio from tarifa_plataforma where clave = 'BASE'), 0)
           + coalesce((select sum(coalesce(tar.precio, 0)) from device d
                       left join tarifa_plataforma tar on tar.clave = 'DISPOSITIVO_' || d.tipo
                       where d.tenant_id = t.id and d.vinculado_at is not null), 0)
           -- El primer TPV va incluido en la cuota base (plan Básica).
           - coalesce((select tar.precio from tarifa_plataforma tar
                       where tar.clave = 'DISPOSITIVO_TPV'
                         and exists (select 1 from device d
                                     where d.tenant_id = t.id and d.tipo = 'TPV'
                                       and d.vinculado_at is not null)), 0)
           + coalesce((select sum(coalesce(tar.precio, 0)) from unnest(t.licencia_modulos) mm
                       left join tarifa_plataforma tar on tar.clave = 'MODULO_' || mm), 0) as precio_calculado,
         (select count(*) from public.product  p where p.tenant_id = t.id),
         (select count(*) from public.app_user u where u.tenant_id = t.id),
         (select count(*) from public.device   d where d.tenant_id = t.id),
         (select count(*) from public.device   d where d.tenant_id = t.id and d.ultima_conexion > now() - interval '3 minutes')
  from public.tenant t
  where public.es_admin_plataforma()
  order by t.created_at desc;
$$;
revoke all on function public.admin_resumen_empresas() from public, anon;
grant execute on function public.admin_resumen_empresas() to authenticated, service_role;
