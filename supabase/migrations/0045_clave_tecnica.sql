-- 0045 — Clave técnica por cliente: candado de la "Zona técnica" del backoffice
-- (Impresión, Dispositivos, Copias de seguridad). La genera el instalador al dar
-- de alta la empresa (api/admin/crear-empresa) y se guarda hasheada (bcrypt).
--
-- OJO: es un candado blando ("no toques esto"), NO seguridad dura. La tabla
-- tenant ya es legible por el propio tenant vía RLS, así que el hash sale en un
-- SELECT *; se acepta porque solo protege de despistes, no de atacantes.

ALTER TABLE tenant ADD COLUMN IF NOT EXISTS clave_tecnica_hash text;

-- Valida la clave técnica del tenant del llamante. Si la empresa aún no tiene
-- clave configurada devuelve true (candado abierto para empresas antiguas).
CREATE OR REPLACE FUNCTION public.validar_clave_tecnica(p_clave text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT COALESCE(
    (SELECT t.clave_tecnica_hash IS NULL
            OR t.clave_tecnica_hash = crypt(p_clave, t.clave_tecnica_hash)
     FROM public.tenant t
     WHERE t.id = public.current_tenant_id()),
    false);
$$;

REVOKE ALL ON FUNCTION public.validar_clave_tecnica(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validar_clave_tecnica(text) TO authenticated;

-- Cambia la clave técnica. Si ya hay una, exige que p_actual valide.
CREATE OR REPLACE FUNCTION public.establecer_clave_tecnica(p_actual text, p_nueva text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_tenant uuid;
  v_hash text;
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_nueva IS NULL OR length(p_nueva) < 4 THEN
    RAISE EXCEPTION 'La clave nueva debe tener al menos 4 caracteres';
  END IF;

  SELECT clave_tecnica_hash INTO v_hash FROM public.tenant WHERE id = v_tenant;
  IF v_hash IS NOT NULL AND (p_actual IS NULL OR crypt(p_actual, v_hash) <> v_hash) THEN
    RAISE EXCEPTION 'La clave actual no es correcta';
  END IF;

  UPDATE public.tenant
  SET clave_tecnica_hash = crypt(p_nueva, gen_salt('bf')), updated_at = now()
  WHERE id = v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.establecer_clave_tecnica(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.establecer_clave_tecnica(text, text) TO authenticated;

-- Alta desde la plataforma (route crear-empresa con SUPABASE_SECRET_KEY): fija
-- la clave inicial del tenant recién creado. Solo service_role puede llamarla.
CREATE OR REPLACE FUNCTION public.admin_establecer_clave_tecnica(p_tenant uuid, p_clave text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  UPDATE public.tenant
  SET clave_tecnica_hash = crypt(p_clave, gen_salt('bf')), updated_at = now()
  WHERE id = p_tenant;
$$;

REVOKE ALL ON FUNCTION public.admin_establecer_clave_tecnica(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_establecer_clave_tecnica(uuid, text) TO service_role;
