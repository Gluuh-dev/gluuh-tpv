-- 0055_series_formas.sql — Dos features de configuración (Ágora, alta prioridad):
--   (A) Formas de pago: flags que consumirán TPV/arqueo.
--   (B) Series de documento: gestor multi-serie sobre la tabla ya existente
--       `invoice_series` (0019) — se amplía en vez de crear una tabla nueva
--       para no duplicar el concepto de "serie" (evita la trampa customer/client).
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS). No toca datos.

-- ─────────────────────────────────────────────────────────────────────────────
-- (A) FORMAS DE PAGO  (payment_method, definida en 0014)
--     `tipo` y `orden` ya existen desde 0014; aquí solo faltan los dos flags.
--     ponytail: el TPV (cobro) y el arqueo de caja consumirán estos flags;
--     hoy solo se guardan desde el backoffice.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payment_method
  ADD COLUMN IF NOT EXISTS abre_cajon boolean NOT NULL DEFAULT false;    -- efectivo: abre cajón al cobrar
ALTER TABLE public.payment_method
  ADD COLUMN IF NOT EXISTS cuenta_arqueo boolean NOT NULL DEFAULT true;  -- entra en el arqueo de caja

-- ─────────────────────────────────────────────────────────────────────────────
-- (B) SERIES DE DOCUMENTO  (invoice_series, stub creado en 0019: id, tenant_id,
--     nombre, prefijo, created_at + RLS). Se reutiliza:
--       · prefijo  → código de la serie (ej. "F", "T", "A")
--       · nombre   → descripción legible (ej. "Facturas")
--     y se añade el tipo de documento, la marca de predeterminada y la de activa.
--     ponytail: la facturación seguirá leyendo location.serie_factura por ahora;
--     migrará a elegir serie de esta tabla (por tipo) más adelante.
--     ponytail: "una predeterminada por tipo" se garantiza desde la UI (al marcar
--     una se desmarcan las del mismo tipo); sin índice único parcial hasta que
--     haga falta forzarlo en servidor.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.invoice_series
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'FACTURA'
    CHECK (tipo IN ('FACTURA','TICKET','ABONO','PRESUPUESTO'));
ALTER TABLE public.invoice_series
  ADD COLUMN IF NOT EXISTS predeterminada boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoice_series
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;
