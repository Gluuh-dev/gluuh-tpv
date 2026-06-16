-- 0021_config_extra.sql — plantillas de etiquetas/comandas, notas y tipos de preparación
CREATE TABLE IF NOT EXISTS public.plantilla_etiqueta (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.plantilla_comanda (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.nota_preparacion (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tipo_preparacion (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plantilla_etiqueta','plantilla_comanda','nota_preparacion','tipo_preparacion'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_rw ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_rw ON public.%I FOR ALL USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())', t, t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
  END LOOP;
END $$;
