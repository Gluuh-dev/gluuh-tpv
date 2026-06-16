-- 0018_crud_basicos.sql — entidades CRUD simples (Clientes, Proveedores, Almacenes)
CREATE TABLE IF NOT EXISTS public.client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, nif text, email text, telefono text, notas text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.supplier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, nif text, email text, telefono text, notas text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.warehouse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, direccion text,
  created_at timestamptz DEFAULT now()
);

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client','supplier','warehouse'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_rw ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_rw ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t, t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
  END LOOP;
END $$;
