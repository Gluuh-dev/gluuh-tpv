-- 0106_semilla_formas_pago.sql
--
-- FORMAS DE PAGO POR DEFECTO al crear una empresa — como SEMILLA, no clonadas de la plantilla.
--
-- El alta de empresa (api/admin/crear-empresa) ya siembra en código perfiles, operarios y
-- catálogo de ejemplo. Pero las FORMAS DE PAGO solo llegaban si el admin marcaba "importar
-- formas de pago" de la empresa plantilla. Sin ellas, un bar recién creado NO PODÍA COBRAR:
-- la pantalla de cobro se queda sin métodos. Y depender de la plantilla para algo tan básico
-- es justo lo que queremos quitar.
--
-- Ahora se siembran SIEMPRE, definidas aquí en código (no en un tenant molde). El bar puede
-- editarlas, desactivarlas o borrarlas después.
create or replace function public.admin_sembrar_formas_pago(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Idempotente: si ya tiene formas de pago (creadas a mano o importadas), no se toca nada.
  if exists (select 1 from public.payment_method where tenant_id = p_tenant) then
    return;
  end if;
  insert into public.payment_method (tenant_id, nombre, tipo, activo, orden, abre_cajon) values
    (p_tenant, 'Efectivo', 'EFECTIVO', true, 1, true),   -- abre el cajón portamonedas
    (p_tenant, 'Tarjeta',  'TARJETA',  true, 2, false),
    (p_tenant, 'Bizum',    'BIZUM',    true, 3, false);
end;
$$;

-- La llama el alta de empresa con la clave de servicio (como el resto de admin_sembrar_*).
revoke all on function public.admin_sembrar_formas_pago(uuid) from public;
grant execute on function public.admin_sembrar_formas_pago(uuid) to service_role;
