-- 0015_descuentos.sql — Descuentos (Ágora: Tarifas y Precios → Descuentos)
CREATE TABLE IF NOT EXISTS public.discount (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'PORCENTAJE' CHECK (tipo IN ('PORCENTAJE','IMPORTE')),
  valor      numeric(12,2) NOT NULL DEFAULT 0,
  activo     boolean DEFAULT true,
  orden      int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.discount ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS discount_rw ON public.discount;
CREATE POLICY discount_rw ON public.discount FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.discount TO authenticated;
