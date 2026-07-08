-- 0086 — Datos editables de una empresa para la ficha de la consola (tenant +
-- su local). SECURITY DEFINER acotada por es_admin_plataforma.
-- (Aplicada por MCP el 08-07-2026.)
create or replace function public.admin_empresa_datos(p_tenant uuid)
returns table(nombre text, cif text, email_admin text, direccion text, poblacion text, provincia text, codigo_postal text, telefono text)
language sql
security definer
set search_path to 'public'
as $$
  select t.nombre, t.cif, t.email_admin,
         l.direccion, l.poblacion, l.provincia, l.codigo_postal, l.telefono
  from public.tenant t
  left join lateral (select * from public.location l0 where l0.tenant_id = t.id order by l0.created_at limit 1) l on true
  where public.es_admin_plataforma() and t.id = p_tenant;
$$;
revoke all on function public.admin_empresa_datos(uuid) from public, anon;
grant execute on function public.admin_empresa_datos(uuid) to authenticated, service_role;
