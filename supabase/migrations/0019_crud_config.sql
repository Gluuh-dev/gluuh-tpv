-- 0019_crud_config.sql — más entidades CRUD de configuración (Ágora)
CREATE TABLE IF NOT EXISTS public.unit_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, abreviatura text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, descripcion text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sales_center (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, descripcion text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cancel_reason (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.invoice_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, prefijo text, created_at timestamptz DEFAULT now()
);

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['unit_of_measure','customer_type','sales_center','cancel_reason','invoice_series'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_rw ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_rw ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t, t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
  END LOOP;
END $$;
