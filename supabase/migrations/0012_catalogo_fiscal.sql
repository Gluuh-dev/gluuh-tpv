-- =============================================================================
--  0012_catalogo_fiscal.sql — Catálogo completo + IVA automático
--  · family: familias que agrupan categorías (Ágora: Familias → Categorías → Artículos)
--  · product.clase_fiscal: GENERAL / REDUCIDO / SUPERREDUCIDO / EXENTO
--  · tax_rate: % por territorio (IVA peninsular, IGIC Canarias, IPSI Ceuta/Melilla)
--  · resolver_iva(): devuelve el % automáticamente según clase + territorio
-- =============================================================================

-- ---------- Familias -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  orden      int  DEFAULT 0,
  color      text DEFAULT '#64748b',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.family ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS family_rw ON public.family;
CREATE POLICY family_rw ON public.family FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.family TO authenticated;

ALTER TABLE public.category ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.family(id) ON DELETE SET NULL;

-- ---------- Clase fiscal del producto -----------------------------------------
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS clase_fiscal text NOT NULL DEFAULT 'REDUCIDO'
  CHECK (clase_fiscal IN ('GENERAL','REDUCIDO','SUPERREDUCIDO','EXENTO'));

-- ---------- Tipos impositivos por territorio ----------------------------------
CREATE TABLE IF NOT EXISTS public.tax_rate (
  territorio   text NOT NULL,
  clase_fiscal text NOT NULL,
  porcentaje   numeric(5,2) NOT NULL,
  PRIMARY KEY (territorio, clase_fiscal)
);
INSERT INTO public.tax_rate (territorio, clase_fiscal, porcentaje) VALUES
  ('PENINSULA_BALEARES','GENERAL',21),('PENINSULA_BALEARES','REDUCIDO',10),('PENINSULA_BALEARES','SUPERREDUCIDO',4),('PENINSULA_BALEARES','EXENTO',0),
  ('CANARIAS','GENERAL',7),('CANARIAS','REDUCIDO',3),('CANARIAS','SUPERREDUCIDO',0),('CANARIAS','EXENTO',0),
  ('CEUTA_MELILLA','GENERAL',10),('CEUTA_MELILLA','REDUCIDO',4),('CEUTA_MELILLA','SUPERREDUCIDO',1),('CEUTA_MELILLA','EXENTO',0),
  ('FORAL_PV','GENERAL',21),('FORAL_PV','REDUCIDO',10),('FORAL_PV','SUPERREDUCIDO',4),('FORAL_PV','EXENTO',0),
  ('FORAL_NAVARRA','GENERAL',21),('FORAL_NAVARRA','REDUCIDO',10),('FORAL_NAVARRA','SUPERREDUCIDO',4),('FORAL_NAVARRA','EXENTO',0)
ON CONFLICT (territorio, clase_fiscal) DO UPDATE SET porcentaje = EXCLUDED.porcentaje;
GRANT SELECT ON public.tax_rate TO authenticated, anon;

-- ---------- Resolver IVA automático -------------------------------------------
CREATE OR REPLACE FUNCTION public.resolver_iva(p_clase text, p_territorio text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_terr text; v_pct numeric;
BEGIN
  v_terr := COALESCE(
    p_territorio,
    (SELECT territorio_fiscal FROM location WHERE tenant_id = public.current_tenant_id() ORDER BY created_at LIMIT 1),
    'PENINSULA_BALEARES'
  );
  SELECT porcentaje INTO v_pct FROM tax_rate WHERE territorio = v_terr AND clase_fiscal = p_clase;
  RETURN COALESCE(v_pct, 0);
END; $$;
GRANT EXECUTE ON FUNCTION public.resolver_iva(text, text) TO authenticated, anon;
