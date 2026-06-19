// Comprobación READ-ONLY del estado de la BD antes de aplicar migraciones.
// Uso: node scripts/db-inspect.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv("apps/api/.env");
const url = env.DATABASE_URL;
if (!url) { console.error("Sin DATABASE_URL en apps/api/.env"); process.exit(1); }
console.log("Host:", new URL(url).host);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const q = async (label, sql) => {
  try { const r = await client.query(sql); console.log(`\n## ${label}`); console.table(r.rows); }
  catch (e) { console.log(`\n## ${label} -> ERROR: ${e.message}`); }
};

await q("¿Existe tabla setting?", `select to_regclass('public.setting') as setting`);
await q("Tablas base presentes", `select table_name from information_schema.tables
  where table_schema='public' and table_name in ('tenant','location','device','setting') order by 1`);
await q("Funciones setting_*", `select proname from pg_proc where proname in ('setting_get','setting_set','current_tenant_id','set_tenant_id','set_updated_at') order by 1`);
await q("¿Historial de migraciones supabase?", `select to_regclass('supabase_migrations.schema_migrations') as hist`);
await q("Versiones registradas (si hay historial)", `select version from supabase_migrations.schema_migrations order by version`);
await q("Nº de tenants", `select count(*) as tenants from tenant`);

await client.end();
console.log("\nOK (read-only).");
