// Normaliza product.estacion a valores canónicos (COCINA/BARRA/CAMARERO/NINGUNA).
// Heurística para el demo: bebidas/alcohol → BARRA; el resto → COCINA.
// Uso: node scripts/normalize-estaciones.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync("apps/api/.env", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const TENANT = "ca44a7c7-4234-49ea-ae01-75417fc15c35";

const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const r = await c.query(
    `update product p set estacion = case
       when p.es_alcohol then 'BARRA'
       when lower(coalesce((select nombre from category c where c.id = p.category_id),'')) ~ '(bebid|vino|cerve|refres|caf|copa|gin|ron|whisk|agua|zumo|coct)' then 'BARRA'
       else 'COCINA' end
     where p.tenant_id = $1`,
    [TENANT],
  );
  const cnt = await c.query(`select estacion, count(*)::int n from product where tenant_id=$1 group by estacion order by estacion`, [TENANT]);
  console.log(`✓ ${r.rowCount} productos normalizados`);
  console.table(cnt.rows);
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
