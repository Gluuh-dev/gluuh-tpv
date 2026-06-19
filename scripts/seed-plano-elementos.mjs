// Siembra elementos del plano (barra, plantas, puerta) para el demo. Idempotente.
// Uso: node scripts/seed-plano-elementos.mjs
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
  const rooms = (await c.query(`select id,nombre from room where tenant_id=$1`, [TENANT])).rows;
  const salon = rooms.find((r) => r.nombre === "Salón")?.id;
  const terraza = rooms.find((r) => r.nombre === "Terraza")?.id;

  // [tipo, etiqueta, icono, x, y, ancho, alto]
  const ELEMS = {
    [salon]: [
      ["BARRA", "Barra", null, 80, 12, 560, 46],
      ["PLANTA", null, "🪴", 720, 60, 40, 40],
      ["PLANTA", null, "🌿", 720, 320, 40, 40],
      ["PUERTA", "Entrada", null, 760, 470, 90, 24],
    ],
    [terraza]: [
      ["PLANTA", null, "🌴", 700, 80, 40, 40],
      ["PLANTA", null, "🌴", 700, 300, 40, 40],
      ["DECOR", "Pasillo", null, 40, 470, 760, 26],
    ],
  };

  let n = 0;
  for (const [room, items] of Object.entries(ELEMS)) {
    if (!room || room === "undefined") continue;
    const ya = (await c.query(`select count(*)::int n from plano_elemento where tenant_id=$1 and room_id=$2`, [TENANT, room])).rows[0].n;
    if (ya > 0) { console.log(`· Sala ${room.slice(0, 8)} ya tiene ${ya} elementos`); continue; }
    for (const [tipo, etiqueta, icono, x, y, ancho, alto] of items) {
      await c.query(
        `insert into plano_elemento (tenant_id, room_id, tipo, etiqueta, icono, pos_x, pos_y, ancho, alto)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [TENANT, room, tipo, etiqueta, icono, x, y, ancho, alto],
      );
      n++;
    }
  }
  console.log(`✓ ${n} elementos de plano creados`);
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
