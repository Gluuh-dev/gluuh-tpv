-- 0034 — Consolidación de la tabla invoice (bloqueante para VERIFACTU).
-- CONTEXTO: 0001 creó invoice y 0022 (CREATE TABLE IF NOT EXISTS) fue un no-op,
-- así que la tabla real quedó con la forma de 0001 y SIN las columnas VERIFACTU
-- que /api/factura escribe (verificado contra la BD real el 02-07-2026).
-- Esta migración deja la tabla como 0022 la declaró, sin perder lo de 0001.

-- Columnas VERIFACTU que /api/factura inserta (apps/web/app/api/factura/route.ts).
ALTER TABLE invoice
  ADD COLUMN IF NOT EXISTS num_serie_factura text,
  ADD COLUMN IF NOT EXISTS nif_emisor        text,
  ADD COLUMN IF NOT EXISTS nombre_emisor     text,
  ADD COLUMN IF NOT EXISTS tipo_factura      text NOT NULL DEFAULT 'F2',
  ADD COLUMN IF NOT EXISTS huella            text,
  ADD COLUMN IF NOT EXISTS huella_anterior   text,
  ADD COLUMN IF NOT EXISTS qr_url            text,
  ADD COLUMN IF NOT EXISTS fecha_hora_huso   text,
  ADD COLUMN IF NOT EXISTS estado_aeat       text NOT NULL DEFAULT 'NO_ENVIADA';

-- 0001 exigía local; /api/factura no lo informa (hoy hay un local por tenant).
ALTER TABLE invoice ALTER COLUMN location_id DROP NOT NULL;

-- Fecha de expedición en formato AEAT dd-mm-aaaa (0022 la declaró text; 0001 date).
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invoice'
        AND column_name = 'fecha_expedicion') = 'date' THEN
    ALTER TABLE public.invoice ALTER COLUMN fecha_expedicion DROP DEFAULT;
    ALTER TABLE public.invoice ALTER COLUMN fecha_expedicion TYPE text
      USING to_char(fecha_expedicion, 'DD-MM-YYYY');
  END IF;
END $$;

-- Numeración única por tenant+serie+numero (la de 0022; su DO block sí pudo
-- ejecutarse en su día — por eso el IF NOT EXISTS).
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

-- NOTA: la columna `tipo` de 0001 (DEFAULT 'F2') convive con `tipo_factura`;
-- se retirará cuando el visor y los informes dejen de leerla.
