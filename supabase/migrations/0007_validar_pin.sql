-- =============================================================================
--  0007_validar_pin.sql — Login por PIN del empleado (comandera/TPV).
--  El dispositivo entra una vez como la empresa (sesión Supabase). Luego cada
--  empleado se identifica con su PIN: la función comprueba el PIN dentro del
--  tenant de la sesión y devuelve el empleado (para atribuir sus acciones).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validar_pin(p_pin text)
RETURNS TABLE(id uuid, nombre text, rol text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT id, nombre, rol
  FROM public.app_user
  WHERE tenant_id = public.current_tenant_id()
    AND activo
    AND pin_hash IS NOT NULL
    AND pin_hash = crypt(p_pin, pin_hash)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validar_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validar_pin(text) TO authenticated;
