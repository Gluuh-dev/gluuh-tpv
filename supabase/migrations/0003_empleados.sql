-- =============================================================================
--  0003_empleados.sql — Crear empleados (camareros/cocina) con PIN hasheado.
--  El PIN se guarda con bcrypt (pgcrypto, schema 'extensions' en Supabase).
--  La función deriva el tenant del usuario autenticado (no se puede falsear).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crear_empleado(
  p_nombre text, p_email text, p_rol text, p_pin text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_tenant uuid;
  v_caller_rol text;
  v_id uuid;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT rol INTO v_caller_rol FROM public.app_user WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_caller_rol NOT IN ('PROPIETARIO', 'ENCARGADO') THEN
    RAISE EXCEPTION 'Sin permiso para crear empleados';
  END IF;

  IF p_rol NOT IN ('ENCARGADO', 'CAMARERO', 'COCINA') THEN
    RAISE EXCEPTION 'Rol no válido: %', p_rol;
  END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 THEN
    RAISE EXCEPTION 'El PIN debe tener al menos 4 dígitos';
  END IF;

  INSERT INTO public.app_user (tenant_id, nombre, email, rol, pin_hash, activo)
  VALUES (v_tenant, p_nombre, NULLIF(p_email, ''), p_rol, crypt(p_pin, gen_salt('bf')), true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_empleado(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crear_empleado(text, text, text, text) TO authenticated;
