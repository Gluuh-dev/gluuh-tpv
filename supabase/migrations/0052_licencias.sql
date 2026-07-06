-- =============================================================================
--  0052_licencias.sql — Sistema de licencias por código de activación.
--  Cloud-first: la licencia efectiva vive en la fila tenant (licencia_hasta +
--  licencia_modulos); el "código" es solo la llave que la activa/renueva.
--  El catálogo de módulos vive en código (apps/web/app/lib/modulos.ts); aquí
--  solo qué módulos premium tiene comprados el tenant y hasta cuándo.
--
--  Compat: tenant.licencia_hasta NULL = empresa SIN licencia registrada → el
--  gating por licencia NO aplica (las empresas existentes siguen igual). En
--  cuanto se canjea el primer código, empieza a mandar la licencia.
-- =============================================================================

-- Estado efectivo de la licencia del tenant.
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS licencia_hasta date;
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS licencia_modulos text[] NOT NULL DEFAULT '{}';

-- Códigos emitidos (uno por venta/renovación). Se canjea una sola vez.
CREATE TABLE IF NOT EXISTS licencia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  codigo      text NOT NULL UNIQUE,
  meses       int  NOT NULL CHECK (meses > 0),
  modulos     text[] NOT NULL DEFAULT '{}',
  canjeado_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_licencia_tenant ON licencia (tenant_id);

ALTER TABLE licencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE licencia FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON licencia;
CREATE POLICY tenant_isolation ON licencia FOR ALL
  USING     (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT ALL ON licencia TO authenticated;

-- Canjea un código: renueva la caducidad del tenant y suma los módulos. La
-- nueva fecha extiende la vigente (si aún no ha caducado) o parte de hoy.
CREATE OR REPLACE FUNCTION public.activar_licencia(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_tenant  uuid;
  v_lic     public.licencia;
  v_actual  date;
  v_modulos text[];
  v_base    date;
  v_hasta   date;
  v_final   text[];
BEGIN
  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_lic
  FROM public.licencia
  WHERE codigo = upper(trim(p_codigo))
    AND tenant_id = v_tenant
    AND canjeado_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código no válido o ya usado';
  END IF;

  SELECT licencia_hasta, licencia_modulos INTO v_actual, v_modulos
  FROM public.tenant WHERE id = v_tenant;

  v_base  := CASE WHEN v_actual IS NOT NULL AND v_actual > current_date
                  THEN v_actual ELSE current_date END;
  v_hasta := v_base + (v_lic.meses * interval '1 month');
  v_final := ARRAY(SELECT DISTINCT unnest(
    coalesce(v_modulos, '{}'::text[]) || coalesce(v_lic.modulos, '{}'::text[])
  ));

  UPDATE public.tenant
  SET licencia_hasta = v_hasta, licencia_modulos = v_final, updated_at = now()
  WHERE id = v_tenant;

  UPDATE public.licencia SET canjeado_at = now() WHERE id = v_lic.id;

  RETURN jsonb_build_object('hasta', v_hasta, 'modulos', to_jsonb(v_final));
END;
$$;

REVOKE ALL ON FUNCTION public.activar_licencia(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.activar_licencia(text) TO authenticated;

-- Emite un código desde la plataforma (route api/admin/generar-licencia con
-- SUPABASE_SECRET_KEY). El código legible lo genera el route en JS; aquí solo
-- se inserta. Solo service_role, igual que admin_establecer_clave_tecnica (0045).
CREATE OR REPLACE FUNCTION public.admin_generar_licencia(
  p_tenant uuid, p_meses int, p_modulos text[], p_codigo text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  INSERT INTO public.licencia (tenant_id, codigo, meses, modulos)
  VALUES (p_tenant, upper(trim(p_codigo)), p_meses, coalesce(p_modulos, '{}'::text[]));
$$;

REVOKE ALL ON FUNCTION public.admin_generar_licencia(uuid, int, text[], text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_generar_licencia(uuid, int, text[], text) TO service_role;
