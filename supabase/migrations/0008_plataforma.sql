-- =============================================================================
--  0008_plataforma.sql — Registro controlado por el administrador de plataforma.
--  Solo el admin de Gluuh crea cuentas de empresa. Web pública con contacto.
-- =============================================================================

-- Administradores de la plataforma (Gluuh)
CREATE TABLE IF NOT EXISTS public.platform_admin (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_self ON public.platform_admin;
CREATE POLICY pa_self ON public.platform_admin USING (auth_user_id = auth.uid());
GRANT SELECT ON public.platform_admin TO authenticated;

CREATE OR REPLACE FUNCTION public.es_admin_plataforma() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admin WHERE auth_user_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.es_admin_plataforma() TO authenticated;

-- El admin de plataforma puede leer/gestionar todas las empresas
DROP POLICY IF EXISTS tenant_self ON public.tenant;
CREATE POLICY tenant_self ON public.tenant
  USING (id = public.current_tenant_id() OR public.es_admin_plataforma())
  WITH CHECK (id = public.current_tenant_id() OR public.es_admin_plataforma());

-- Solicitudes de acceso / contacto (desde la web pública)
CREATE TABLE IF NOT EXISTS public.contact_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text,
  email text,
  telefono text,
  mensaje text,
  atendida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_request ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cr_insert ON public.contact_request;
CREATE POLICY cr_insert ON public.contact_request FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS cr_read ON public.contact_request;
CREATE POLICY cr_read ON public.contact_request FOR SELECT USING (public.es_admin_plataforma());
GRANT INSERT ON public.contact_request TO anon, authenticated;
GRANT SELECT ON public.contact_request TO authenticated;
