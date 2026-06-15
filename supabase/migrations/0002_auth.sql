-- =============================================================================
--  0002_auth.sql — Autenticación multiempresa con Supabase Auth
--  - Enlaza empleados (app_user) con cuentas de Supabase (auth.users).
--  - Al registrarse una empresa, crea su tenant + usuario propietario.
--  - RLS por usuario: resuelve el tenant desde el JWT (auth.uid()) sin hook.
-- =============================================================================

-- 1) Enlace app_user -> auth.users
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_app_user_auth ON public.app_user (auth_user_id);

-- 2) Resolver el tenant actual: (a) GUC del backend, (b) claim del JWT,
--    (c) lookup por auth.uid(). SECURITY DEFINER para que el lookup interno
--    no quede atrapado por la RLS de app_user (evita recursión).
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), '')::uuid,
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
    (SELECT au.tenant_id FROM public.app_user au WHERE au.auth_user_id = auth.uid() LIMIT 1)
  )
$$;

-- 3) Provisión automática al registrarse (signUp crea fila en auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  INSERT INTO public.tenant (nombre, plan, email_admin)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'empresa_nombre', ''), 'Mi empresa'), 'FREE', NEW.email)
  RETURNING id INTO v_tenant;

  INSERT INTO public.app_user (tenant_id, nombre, email, rol, auth_user_id, activo)
  VALUES (v_tenant,
          COALESCE(NULLIF(NEW.raw_user_meta_data->>'nombre', ''), NEW.email),
          NEW.email, 'PROPIETARIO', NEW.id, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) Permisos para los roles de Supabase (la RLS sigue filtrando por tenant)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.allergen TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
