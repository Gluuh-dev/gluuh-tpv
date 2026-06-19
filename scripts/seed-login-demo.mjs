// Añade una categoría "Demo Gluuh" con productos al tenant del LOGIN
// (admin@gluuh.com → ca44a7c7), para tener datos limpios y visibles en el TPV.
// Idempotente: no duplica (salta lo que ya existe). Usa DATABASE_URL de apps/api/.env.
// Uso: node scripts/seed-login-demo.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync("apps/api/.env", "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);

const TENANT = "ca44a7c7-4234-49ea-ae01-75417fc15c35"; // login admin@gluuh.com (PENINSULA)

// PENINSULA: GENERAL=21, REDUCIDO=10
const PRODUCTOS = [
  { nombre: "Café Demo",        precio: 1.50, clase: "REDUCIDO", tipo: 10, est: "Barra" },
  { nombre: "Tostada Demo",     precio: 2.20, clase: "REDUCIDO", tipo: 10, est: "Cocina" },
  { nombre: "Caña Demo",        precio: 1.90, clase: "GENERAL",  tipo: 21, est: "Barra", alcohol: true },
  { nombre: "Refresco Demo",    precio: 2.30, clase: "GENERAL",  tipo: 21, est: "Barra" },
  { nombre: "Hamburguesa Demo", precio: 8.50, clase: "REDUCIDO", tipo: 10, est: "Cocina" },
  { nombre: "Tarta Demo",       precio: 3.50, clase: "REDUCIDO", tipo: 10, est: "Cocina" },
];

const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  let { rows } = await c.query(`select id from category where tenant_id=$1 and nombre=$2 limit 1`, [TENANT, "Demo Gluuh"]);
  let catId = rows[0]?.id;
  if (!catId) {
    ({ rows } = await c.query(`insert into category (tenant_id, nombre, orden) values ($1,'Demo Gluuh',99) returning id`, [TENANT]));
    catId = rows[0].id;
    console.log("✓ Categoría 'Demo Gluuh' creada");
  } else console.log("· Categoría 'Demo Gluuh' ya existía");

  let nuevos = 0;
  for (const p of PRODUCTOS) {
    const ex = await c.query(`select 1 from product where tenant_id=$1 and nombre=$2 limit 1`, [TENANT, p.nombre]);
    if (ex.rowCount) continue;
    await c.query(
      `insert into product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [TENANT, catId, p.nombre, p.precio, p.tipo, p.clase, p.alcohol ?? false, p.est],
    );
    nuevos++;
  }
  console.log(`✓ Productos demo: ${nuevos} nuevos (${PRODUCTOS.length - nuevos} ya existían)`);
  console.log("\nSeed login-demo OK. Entra en el TPV → categoría 'Demo Gluuh'.");
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
