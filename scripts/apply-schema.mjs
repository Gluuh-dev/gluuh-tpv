// Aplica el esquema (apps/api/db/schema.sql) a la base de datos indicada por DIRECT_URL.
// Uso:  DIRECT_URL="postgresql://...:5432/postgres" node scripts/apply-schema.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("Falta DIRECT_URL");
  process.exit(1);
}

const sql = readFileSync(new URL("../apps/api/db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  console.log("Conectado a la base de datos. Aplicando esquema en una transacción...");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  const { rows } = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  console.log(`✅ Esquema aplicado. Tablas en 'public': ${rows[0].n}`);
} catch (e) {
  try { await client.query("ROLLBACK"); } catch {}
  console.error("❌ Error aplicando el esquema:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
