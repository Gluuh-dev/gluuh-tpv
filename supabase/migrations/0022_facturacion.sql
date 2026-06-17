-- 0022_facturacion.sql — Facturas VERIFACTU encadenadas (huella SHA-256)
-- Idempotente: usa IF NOT EXISTS + DO blocks para policies e índices.

-- ─────────────────────────────────────────────────────────────────────────────
--  Tabla principal de facturas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  order_id            uuid        REFERENCES public.sales_order(id) ON DELETE SET NULL,
  serie               text        NOT NULL,
  numero              int         NOT NULL,
  num_serie_factura   text        NOT NULL,
  fecha_expedicion    text        NOT NULL,   -- dd-mm-aaaa (formato AEAT)
  nif_emisor          text        NOT NULL,
  nombre_emisor       text,
  tipo_factura        text        NOT NULL DEFAULT 'F2',
  base_total          numeric(12,2) NOT NULL,
  cuota_total         numeric(12,2) NOT NULL,
  importe_total       numeric(12,2) NOT NULL,
  huella              text        NOT NULL,   -- SHA-256 encadenado VERIFACTU
  huella_anterior     text,                   -- null en el primer registro
  qr_url              text,
  fecha_hora_huso     text,
  estado_aeat         text        NOT NULL DEFAULT 'NO_ENVIADA',
  created_at          timestamptz DEFAULT now()
);

-- UNIQUE (tenant_id, serie, numero) — evita numeración duplicada
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_tenant_serie_numero_key'
      AND conrelid = 'public.invoice'::regclass
  ) THEN
    ALTER TABLE public.invoice
      ADD CONSTRAINT invoice_tenant_serie_numero_key UNIQUE (tenant_id, serie, numero);
  END IF;
END $$;

-- Índice de búsqueda por tenant + serie + número
CREATE INDEX IF NOT EXISTS idx_invoice_tenant_serie_numero
  ON public.invoice (tenant_id, serie, numero);

-- RLS
ALTER TABLE public.invoice ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_rw ON public.invoice;
CREATE POLICY invoice_rw ON public.invoice FOR ALL
  USING     (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.invoice TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
--  Desglose por tipo impositivo (IVA/IGIC/IPSI)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_tax_line (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  invoice_id  uuid        NOT NULL REFERENCES public.invoice(id) ON DELETE CASCADE,
  tipo        numeric(5,2) NOT NULL,
  base        numeric(12,2) NOT NULL,
  cuota       numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_tax_line_invoice
  ON public.invoice_tax_line (tenant_id, invoice_id);

-- RLS
ALTER TABLE public.invoice_tax_line ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_tax_line_rw ON public.invoice_tax_line;
CREATE POLICY invoice_tax_line_rw ON public.invoice_tax_line FOR ALL
  USING     (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.invoice_tax_line TO authenticated;
