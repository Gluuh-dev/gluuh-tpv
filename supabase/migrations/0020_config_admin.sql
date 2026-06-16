-- 0020_config_admin.sql — entidades de configuración del módulo Administración
CREATE TABLE IF NOT EXISTS public.tarifa (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.promocion (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  activa     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.perfil (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.plantilla_ticket (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.periodo_servicio (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  hora_inicio text,
  hora_fin   text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.punto_venta (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.grupo_mayor (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.alergeno (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.etiqueta_producto (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  color      text,
  created_at timestamptz DEFAULT now()
);

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tarifa','promocion','perfil','plantilla_ticket','periodo_servicio','punto_venta','grupo_mayor','alergeno','etiqueta_producto'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_rw ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_rw ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t, t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
  END LOOP;
END $$;
