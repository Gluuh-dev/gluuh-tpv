// Aplica un archivo SQL a la base de datos de DIRECT_URL (en una transacción).
// Uso:  DIRECT_URL="postgresql://...:5432/postgres" node scripts/apply-sql.mjs <archivo.sql>
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
const url = process.env.DIRECT_URL;
if (!file || !url) {
  console.error("Uso: DIRECT_URL=... node scripts/apply-sql.mjs <archivo.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const c = new pg.Client({ connectionString: url });
try {
  await c.connect();
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("✅ Aplicado:", file);
} catch (e) {
  try { await c.query("ROLLBACK"); } catch {}
  console.error("❌ Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
