-- 0057 — Cambiar el PIN de un empleado ya creado (solo PROPIETARIO/ENCARGADO).
-- Pareja de crear_empleado: rehashea el PIN con bcrypt. Resetea el bloqueo por
-- intentos (0054) al cambiarlo. Lo usa el panel de edición de (panel)/empleados.

CREATE OR REPLACE FUNCTION public.cambiar_pin(p_user_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_tenant uuid;
  v_caller_rol text;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT rol INTO v_caller_rol FROM public.app_user WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_caller_rol NOT IN ('PROPIETARIO', 'ENCARGADO') THEN
    RAISE EXCEPTION 'Sin permiso para cambiar el PIN';
  END IF;

  IF p_pin IS NULL OR length(p_pin) < 4 THEN
    RAISE EXCEPTION 'El PIN debe tener al menos 4 dígitos';
  END IF;

  UPDATE public.app_user
  SET pin_hash = crypt(p_pin, gen_salt('bf')),
      pin_intentos = 0,
      pin_bloqueado_hasta = NULL,
      updated_at = now()
  WHERE id = p_user_id AND tenant_id = v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.cambiar_pin(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_pin(uuid, text) TO authenticated;
