-- 0098 — RLS de los catálogos globales (`tax_rate`, `allergen`) + arreglo de un bug.
--
-- DESCUBIERTO el 13-07-2026 al aplicar las 97 migraciones a un Postgres VACÍO y
-- comparar el resultado con la BD de la nube. Divergían 2 tablas:
--
--   · En la NUBE: `tax_rate` y `allergen` tienen **RLS activada y CERO políticas**.
--   · En las MIGRACIONES: no se les activa RLS por ningún lado.
--
-- Alguien la activó a mano en el panel de Supabase y ese cambio NO está en el repo.
-- Consecuencias, las dos malas:
--
--   1) Un NODO nuevo (que se construye aplicando las migraciones) nacería con esas
--      tablas SIN RLS → no converge con la nube.
--
--   2) 💣 BUG REAL EN LA NUBE: "RLS activada + cero políticas" = **NADIE puede leer
--      la tabla**. Y la página de Impuestos del backoffice la lee desde el navegador
--      (`apps/web/app/(panel)/impuestos/page.tsx:26`,
--       `sb.from("tax_rate").select(...)`) → **devuelve SIEMPRE cero filas**.
--      La página está muerta en silencio. No se notó porque `tax_rate` está vacía y
--      porque `resolver_iva()` es SECURITY DEFINER (se salta la RLS), así que el
--      motor fiscal sí funciona.
--
-- QUÉ SON estas tablas: catálogos GLOBALES de referencia, sin `tenant_id`:
--   · tax_rate  (territorio, clase_fiscal, porcentaje) → los tipos de IVA/IGIC/IPSI
--   · allergen  (id, codigo, nombre)                   → los alérgenos estándar
-- No son datos de ninguna empresa: son datos de referencia que TODOS necesitan leer.
--
-- SOLUCIÓN: RLS activada (defensa en profundidad, converge con la nube) + política
-- de SOLO LECTURA para usuarios autenticados. La escritura queda para el
-- service_role (el alta de empresa las clona con la clave secreta).

-- ── tax_rate ─────────────────────────────────────────────────────────────────
alter table public.tax_rate enable row level security;

drop policy if exists tax_rate_lectura on public.tax_rate;
create policy tax_rate_lectura on public.tax_rate
  for select to authenticated
  using (true);   -- referencia global: sin tenant que filtrar

grant select on public.tax_rate to authenticated;

-- ── allergen ─────────────────────────────────────────────────────────────────
alter table public.allergen enable row level security;

drop policy if exists allergen_lectura on public.allergen;
create policy allergen_lectura on public.allergen
  for select to authenticated
  using (true);   -- referencia global (alérgenos estándar de la UE)

grant select on public.allergen to authenticated;
