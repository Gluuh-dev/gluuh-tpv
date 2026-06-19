-- =============================================================================
--  0024_operarios.sql — Listado de operarios para el selector de usuario del TPV
--  Devuelve los empleados con PIN del tenant actual (sin exponer el hash).
--  Pareja de validar_pin(): aquí se LISTAN, allí se VALIDA el PIN.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.listar_operarios()
RETURNS TABLE(id uuid, nombre text, rol text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT id, nombre, rol
  FROM public.app_user
  WHERE tenant_id = public.current_tenant_id()
    AND activo
    AND pin_hash IS NOT NULL
  ORDER BY nombre;
$$;

REVOKE ALL ON FUNCTION public.listar_operarios() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.listar_operarios() TO authenticated;
