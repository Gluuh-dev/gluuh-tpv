// Siembra un PLANO demo en el tenant de login: salas Salón/Terraza con mesas
// posicionadas (pos_x/pos_y) + un par de reservas. Idempotente.
// Uso: node scripts/seed-plano.mjs
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
  const loc = (await c.query(`select id from location where tenant_id=$1 limit 1`, [TENANT])).rows[0].id;

  // Sala Salón (ya existe) + Terraza
  const salon = (await c.query(`select id from room where tenant_id=$1 and nombre='Salón' limit 1`, [TENANT])).rows[0]?.id
    ?? (await c.query(`insert into room (tenant_id,location_id,nombre,orden) values ($1,$2,'Salón',1) returning id`, [TENANT, loc])).rows[0].id;
  let terraza = (await c.query(`select id from room where tenant_id=$1 and nombre='Terraza' limit 1`, [TENANT])).rows[0]?.id;
  if (!terraza) {
    terraza = (await c.query(`insert into room (tenant_id,location_id,nombre,orden) values ($1,$2,'Terraza',2) returning id`, [TENANT, loc])).rows[0].id;
    console.log("✓ Sala 'Terraza' creada");
  }

  // Layout: Salón (Mesa 1–5) y Terraza (Mesa 6–8), con posiciones en px
  const LAYOUT = {
    "Mesa 1": [salon, 60, 60], "Mesa 2": [salon, 280, 60], "Mesa 3": [salon, 500, 60],
    "Mesa 4": [salon, 60, 280], "Mesa 5": [salon, 280, 280],
    "Mesa 6": [terraza, 60, 60], "Mesa 7": [terraza, 280, 60], "Mesa 8": [terraza, 500, 60],
  };
  let n = 0;
  for (const [nombre, [room, x, y]] of Object.entries(LAYOUT)) {
    const r = await c.query(
      `update restaurant_table set room_id=$2, pos_x=$3, pos_y=$4 where tenant_id=$1 and nombre=$5`,
      [TENANT, room, x, y, nombre],
    );
    n += r.rowCount;
  }
  console.log(`✓ ${n} mesas posicionadas (Salón 1–5, Terraza 6–8)`);

  // Reservas demo (best-effort: customer_id puede ser NOT NULL)
  try {
    const hay = (await c.query(`select count(*)::int n from reservation where tenant_id=$1`, [TENANT])).rows[0].n;
    if (hay === 0) {
      const hoy = new Date();
      const at = (h) => { const d = new Date(hoy); d.setHours(h, 0, 0, 0); return d.toISOString(); };
      await c.query(
        `insert into reservation (tenant_id,location_id,customer_id,fecha_hora,comensales,estado,notas)
         values ($1,$2,null,$3,4,'PENDIENTE','Familia García - terraza'),
                ($1,$2,null,$4,2,'PENDIENTE','Aniversario, mesa tranquila')`,
        [TENANT, loc, at(14), at(21)],
      );
      console.log("✓ 2 reservas demo creadas");
    } else console.log(`· Ya hay ${hay} reservas`);
  } catch (e) { console.log("· Reservas demo omitidas:", e.message); }

  console.log("\nSeed plano OK.");
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
