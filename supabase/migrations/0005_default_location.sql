-- =============================================================================
--  0005_default_location.sql — Cada empresa tiene un local por defecto.
--  Al registrarse se crea tenant + propietario + un local (datos fiscales a
--  completar luego en Ajustes). Se rellenan también los tenants existentes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_nombre text;
BEGIN
  v_nombre := COALESCE(NULLIF(NEW.raw_user_meta_data->>'empresa_nombre', ''), 'Mi empresa');

  INSERT INTO public.tenant (nombre, plan, email_admin)
  VALUES (v_nombre, 'FREE', NEW.email) RETURNING id INTO v_tenant;

  INSERT INTO public.app_user (tenant_id, nombre, email, rol, auth_user_id, activo)
  VALUES (v_tenant, COALESCE(NULLIF(NEW.raw_user_meta_data->>'nombre', ''), NEW.email),
          NEW.email, 'PROPIETARIO', NEW.id, true);

  INSERT INTO public.location (tenant_id, nombre, cif, razon_social, territorio_fiscal, regimen_facturacion, serie_factura)
  VALUES (v_tenant, v_nombre, 'PENDIENTE', v_nombre, 'PENINSULA_BALEARES', 'VERIFACTU', 'F');

  RETURN NEW;
END;
$$;

-- Backfill: tenants sin local -> crear uno por defecto
INSERT INTO public.location (tenant_id, nombre, cif, razon_social)
SELECT t.id, t.nombre, 'PENDIENTE', t.nombre
FROM public.tenant t
WHERE NOT EXISTS (SELECT 1 FROM public.location l WHERE l.tenant_id = t.id);
