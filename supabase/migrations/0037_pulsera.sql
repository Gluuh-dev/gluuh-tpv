-- 0037 — Login de camarero por PULSERA (RFID/NFC), además del PIN.
-- El lector de pulsera actúa como teclado: "teclea" el UID de la pulsera. Aquí
-- se guarda hasheado (como el PIN) y se valida igual. docs/implementacion.

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS pulsera_hash text;

-- Validar pulsera: pareja de validar_pin() pero por código de pulsera.
CREATE OR REPLACE FUNCTION public.validar_pulsera(p_codigo text)
RETURNS TABLE(id uuid, nombre text, rol text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT id, nombre, rol
  FROM public.app_user
  WHERE tenant_id = public.current_tenant_id()
    AND activo
    AND pulsera_hash IS NOT NULL
    AND pulsera_hash = crypt(p_codigo, pulsera_hash)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validar_pulsera(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validar_pulsera(text) TO authenticated;

-- Asignar / quitar la pulsera de un empleado (solo PROPIETARIO/ENCARGADO).
-- p_codigo vacío o null => quita la pulsera.
CREATE OR REPLACE FUNCTION public.asignar_pulsera(p_user_id uuid, p_codigo text)
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
    RAISE EXCEPTION 'Sin permiso para asignar pulseras';
  END IF;

  UPDATE public.app_user
  SET pulsera_hash = CASE WHEN NULLIF(p_codigo, '') IS NULL THEN NULL
                          ELSE crypt(p_codigo, gen_salt('bf')) END,
      updated_at = now()
  WHERE id = p_user_id AND tenant_id = v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.asignar_pulsera(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.asignar_pulsera(uuid, text) TO authenticated;
