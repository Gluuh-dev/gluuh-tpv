-- 0014_formas_pago.sql — Formas de pago (Ágora: Tarifas y Precios → Formas de Pago)
CREATE TABLE IF NOT EXISTS public.payment_method (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'OTRO' CHECK (tipo IN ('EFECTIVO','TARJETA','BIZUM','VALE','OTRO')),
  activo     boolean DEFAULT true,
  orden      int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_method ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_method_rw ON public.payment_method;
CREATE POLICY payment_method_rw ON public.payment_method FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.payment_method TO authenticated;
