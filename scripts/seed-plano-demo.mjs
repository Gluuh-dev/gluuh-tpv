// Reseed del plano DEMO del Salón con los SVG nuevos: barra, plantas, taburetes
// (comandables), suelo de madera (interior) + zona de terraza (exterior).
// Uso: node scripts/seed-plano-demo.mjs
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
  const salon = (await c.query(`select id from room where tenant_id=$1 and nombre='Salón' limit 1`, [TENANT])).rows[0]?.id;
  if (!salon) throw new Error("No existe la sala Salón");

  // Suelo base interior
  await c.query(`update room set suelo='suelo-madera' where id=$1`, [salon]);

  // Reset de elementos + taburetes demo del Salón
  await c.query(`delete from plano_elemento where tenant_id=$1 and room_id=$2`, [TENANT, salon]);
  await c.query(`delete from restaurant_table where tenant_id=$1 and room_id=$2 and capacidad=1`, [TENANT, salon]);

  // Elementos: [tipo, icono, etiqueta, x, y, ancho, alto]
  const ELEMS = [
    ["DECOR", "suelo:suelo-terraza", "Terraza", 640, 360, 320, 260],   // zona exterior
    ["BARRA", "barra-recta", "Barra", 240, 16, 136, 43],
    ["PLANTA", "planta-redonda", "Planta", 770, 60, 33, 33],
    ["PLANTA", "jardinera-larga", "Jardinera", 700, 300, 75, 27],
    ["PLANTA", "arbol", "Árbol", 800, 430, 60, 58],
  ];
  for (const [tipo, icono, etiqueta, x, y, an, al] of ELEMS) {
    await c.query(
      `insert into plano_elemento (tenant_id, room_id, tipo, icono, etiqueta, pos_x, pos_y, ancho, alto)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [TENANT, salon, tipo, icono, etiqueta, x, y, an, al],
    );
  }

  // Taburetes comandables bajo la barra (capacidad 1)
  for (let i = 0; i < 5; i++) {
    await c.query(
      `insert into restaurant_table (tenant_id, room_id, nombre, estado, pos_x, pos_y, capacidad)
       values ($1,$2,$3,'LIBRE',$4,68,1)`,
      [TENANT, salon, `B${i + 1}`, 250 + i * 44],
    );
  }

  console.log("✓ Plano demo del Salón sembrado (barra, plantas, 5 taburetes, suelo madera + zona terraza)");
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
