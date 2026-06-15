-- =============================================================================
--  0011_auth_hook.sql — Custom Access Token Hook
--  Mete tenant_id, rol y is_platform_admin DENTRO del JWT, para que la RLS los
--  lea del token (sin consulta extra). current_tenant_id() ya prioriza el claim.
--  IMPORTANTE: tras aplicar, hay que ACTIVARLO en el panel de Supabase:
--    Authentication → Hooks → Custom Access Token → public.custom_access_token_hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims  jsonb;
  v_tenant uuid;
  v_rol    text;
  v_admin  boolean;
BEGIN
  SELECT tenant_id, rol INTO v_tenant, v_rol
  FROM public.app_user
  WHERE auth_user_id = (event->>'user_id')::uuid
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.platform_admin WHERE auth_user_id = (event->>'user_id')::uuid
  ) INTO v_admin;

  claims := COALESCE(event->'claims', '{}'::jsonb);
  IF v_tenant IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant::text));
  END IF;
  IF v_rol IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_rol}', to_jsonb(v_rol));
  END IF;
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(COALESCE(v_admin, false)));

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- El hook lo ejecuta el servicio de Auth con el rol supabase_auth_admin.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Permitir que el rol de Auth lea las tablas necesarias (saltando la RLS normal).
GRANT SELECT ON public.app_user TO supabase_auth_admin;
DROP POLICY IF EXISTS auth_admin_read_app_user ON public.app_user;
CREATE POLICY auth_admin_read_app_user ON public.app_user
  AS PERMISSIVE FOR SELECT TO supabase_auth_admin USING (true);

GRANT SELECT ON public.platform_admin TO supabase_auth_admin;
DROP POLICY IF EXISTS auth_admin_read_platform_admin ON public.platform_admin;
CREATE POLICY auth_admin_read_platform_admin ON public.platform_admin
  AS PERMISSIVE FOR SELECT TO supabase_auth_admin USING (true);
