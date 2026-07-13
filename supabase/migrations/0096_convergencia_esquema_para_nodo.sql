-- 0096 — CONVERGENCIA del esquema: que las migraciones reproduzcan la BD real.
--
-- CONTEXTO (12-07-2026). El nodo local (docs/plan/10) construye su base de datos
-- aplicando TODAS las migraciones a un Postgres vacío. Para que eso funcione, el
-- resultado de `migrations/*.sql` tiene que ser IDÉNTICO a la BD de la nube.
-- Se comparó una contra otra (80 tablas y 91 columnas añadidas) y solo divergían
-- DOS cosas — las dos por migraciones que nunca llegaron a aplicarse (el historial
-- registra 31 de 95):
--
--   1) `invoice_tax_line` (la declara 0022): NO existe en la BD… pero el código SÍ
--      la usa: apps/web/app/api/factura/route.ts:219 inserta ahí el desglose de
--      impuestos de cada factura, y NO comprueba el error. O sea: en cuanto se
--      active VERIFACTU, cada factura se guardaría SIN sus líneas de impuestos y
--      en silencio. Aquí se crea (idempotente, misma forma que 0022).
--
--   2) `app_user.permisos` (la añade 0041): existe en las migraciones pero NO en la
--      BD, y NO la usa nadie — los permisos viven en `perfil.permisos` (0048) y el
--      usuario los hereda por `app_user.perfil_id` (0070). Es una trampa: quien vea
--      la columna puede creer que ahí van los permisos. Se elimina para que un nodo
--      nuevo no la cree.
--
-- Ambas operaciones son IDEMPOTENTES y no-op en la nube salvo la creación de la
-- tabla (que es justo lo que falta).

-- ── 1. La tabla que el motor fiscal necesita y no existía ────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_tax_line (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid          NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  invoice_id  uuid          NOT NULL REFERENCES public.invoice(id) ON DELETE CASCADE,
  tipo        numeric(5,2)  NOT NULL,
  base        numeric(12,2) NOT NULL,
  cuota       numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_tax_line_invoice
  ON public.invoice_tax_line (tenant_id, invoice_id);

ALTER TABLE public.invoice_tax_line ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_tax_line_rw ON public.invoice_tax_line;
CREATE POLICY invoice_tax_line_rw ON public.invoice_tax_line FOR ALL
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.invoice_tax_line TO authenticated;

-- ── 2. Fuera la columna fantasma de permisos ─────────────────────────────────
-- (no-op en la nube: nunca existió; en un nodo nuevo, 0041 la crea y aquí se va)
ALTER TABLE public.app_user DROP COLUMN IF EXISTS permisos;
