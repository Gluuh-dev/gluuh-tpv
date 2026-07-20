-- =============================================================================
--  0127_retirar_stubs_alergenos_y_plantilla_ticket.sql
--
--  LIMPIEZA: retira 4 "stubs del CRUD genérico" (0018-0021) que nunca se usaron
--  y que competían con el modelo real. Tener dos verdades para lo mismo es lo
--  que hace que alguien construya una pantalla sobre la tabla equivocada.
--
--  ── Alérgenos: había TRES modelos ───────────────────────────────────────────
--    · product.alergenos[]   ← EL QUE SE USA (110 productos lo tienen relleno)
--    · allergen + product_allergen  (0 filas, 0 referencias en código)
--    · alergeno                     (0 filas, 0 referencias en código)
--  Se quedan los datos donde están: en la columna del producto. Se van las tablas.
--
--  ── Diseño del ticket: había DOS ────────────────────────────────────────────
--    · setting → clave 'impresion.config'.ticket  ← EL QUE SE USA (lo lee el TPV)
--    · plantilla_ticket                            (0 filas, nunca clonó nada)
--  El mecanismo `setting` (0023) es el sitio de la configuración (regla de la
--  skill gluuh-base-datos: no crear tablas de config nuevas).
--
--  ⚠️ LO QUE NO SE TOCA, a propósito:
--  `printer`, `print_route` y `print_job` (0079, impresión compartida) NO son
--  stubs: tienen código vivo (apps/web/app/lib/print-routing.ts y el
--  PrintDispatcher). Están vacías porque ningún bar las ha configurado todavía,
--  no porque estén muertas. La duplicidad "tablas printer vs setting.impresion.
--  config.impresoras" es una decisión de arquitectura pendiente (ver AHORA.md);
--  no se resuelve borrando, se resuelve migrando cuando haya ámbito DEVICE.
--
--  Verificado contra la BD antes de escribir esta migración (20-07-2026):
--    allergen 0 · product_allergen 0 · alergeno 0 · plantilla_ticket 0
--    product con alergenos: 110 · tax_rate: 20 (sano, no se toca)
--
--  Idempotente: se puede aplicar dos veces sin error.
-- =============================================================================

-- GUARDA: no se retira nada a ciegas. Si alguna de estas tablas tuviera filas
-- (alguien las empezó a usar entre el análisis y la aplicación), la migración
-- FALLA y no borra nada, en vez de llevarse datos por delante.
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['product_allergen', 'allergen', 'alergeno', 'plantilla_ticket'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'public.% tiene % fila(s): se esperaba vacía. Revisa antes de retirarla.', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

-- El orden importa: product_allergen referencia a allergen.
DROP TABLE IF EXISTS public.product_allergen;
DROP TABLE IF EXISTS public.allergen;
DROP TABLE IF EXISTS public.alergeno;

-- El diseño del ticket vive en `setting`; esta tabla nunca tuvo una fila.
DROP TABLE IF EXISTS public.plantilla_ticket;
