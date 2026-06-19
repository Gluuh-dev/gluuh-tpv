// Aplica un fichero .sql a la BD (DATABASE_URL de apps/api/.env).
// Este proyecto aplica las migraciones por conexión directa (no usa el historial
// de `supabase db push`). Uso: node scripts/db-apply.mjs supabase/migrations/0023_setting.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) { console.error("Uso: node scripts/db-apply.mjs <ruta.sql>"); process.exit(1); }

function loadEnv(p) {
  const o = {};
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return o;
}

const env = loadEnv("apps/api/.env");
if (!env.DATABASE_URL) { console.error("Falta DATABASE_URL en apps/api/.env"); process.exit(1); }

const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(readFileSync(file, "utf8"));
  console.log(`✓ Aplicado: ${file}`);
} catch (e) {
  console.error(`✗ Error aplicando ${file}: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
