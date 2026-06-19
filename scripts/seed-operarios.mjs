// Fija PINs conocidos de operarios en el tenant del login, para probar el
// selector de usuario del TPV. Idempotente. Uso: node scripts/seed-operarios.mjs
//   maría=1234, pedro=5678, admin=1111
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync("apps/api/.env", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const TENANT = "ca44a7c7-4234-49ea-ae01-75417fc15c35";

const OPERARIOS = [
  { nombre: "Maria", rol: "CAMARERO", pin: "1234" },
  { nombre: "Pedro", rol: "CAMARERO", pin: "5678" },
  { nombre: "admin@gluuh.com", rol: "PROPIETARIO", pin: "1111" }, // dar PIN al propietario existente
];

const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  for (const o of OPERARIOS) {
    // Busca por nombre (case-insensitive) dentro del tenant.
    const ex = await c.query(
      `select id from app_user where tenant_id=$1 and lower(nombre)=lower($2) limit 1`,
      [TENANT, o.nombre],
    );
    if (ex.rowCount) {
      await c.query(
        `update app_user set pin_hash = crypt($2, gen_salt('bf')), activo = true where id = $1`,
        [ex.rows[0].id, o.pin],
      );
      console.log(`· ${o.nombre}: PIN actualizado (${o.pin})`);
    } else {
      await c.query(
        `insert into app_user (tenant_id, nombre, rol, pin_hash, activo)
         values ($1,$2,$3, crypt($4, gen_salt('bf')), true)`,
        [TENANT, o.nombre, o.rol, o.pin],
      );
      console.log(`✓ ${o.nombre}: creado con PIN ${o.pin}`);
    }
  }
  console.log("\nSeed operarios OK.");
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
