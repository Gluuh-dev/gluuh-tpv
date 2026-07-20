// LA PRUEBA QUE IMPORTA: sincronizar dos veces no puede cobrar dos veces.
//
// Escenario real: un bar que ya existe en la nube, una venta CERRADA en el nodo (sin
// internet), y el sincronizador pasando DOS veces —como pasaría si se corta la línea a
// mitad y reintenta.
import fs from "node:fs";
import { execSync } from "node:child_process";
import pg from "pg";
import crypto from "node:crypto";

for (const l of fs.readFileSync(".nodo/sync.env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const NUBE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SECRET_KEY;
const cab = { apikey: CLAVE, authorization: `Bearer ${CLAVE}`, "content-type": "application/json" };

const nube = (ruta, opts = {}) =>
  fetch(`${NUBE}/rest/v1/${ruta}`, { headers: cab, ...opts }).then(async (r) => {
    const t = await r.text();
    if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  });

const bd = new pg.Client({ connectionString: "postgres://postgres:gluuh@127.0.0.1:55432/gluuh" });
await bd.connect();

// ── 1. Un bar que YA EXISTE en la nube (así nace un nodo real: provisionado de allí) ──
//
// TIENE QUE SER EL MISMO BAR QUE SINCRONIZA EL NODO. Antes se cogía uno cualquiera
// de la nube (`tenant?…&limit=1`); desde que `elBarDeEsteNodo()` es determinista
// (excluye la plantilla y para si hay duda), podían no coincidir: la venta se creaba
// para un bar y el sincronizador subía el de otro → 0 filas, y la prueba concluía
// «se ha duplicado» sin que se hubiera subido nada.
const { rows: [barNodo] } = await bd.query(
  `select id, nombre from public.tenant
    where ($1::uuid is null or id = $1::uuid)
      and coalesce(es_plantilla, false) = false
    order by created_at limit 1`,
  [process.env.NODO_TENANT ?? null],
);
if (!barNodo) {
  console.error("\n⚠️  Este nodo no tiene ningún bar (solo la plantilla, que no se toca).");
  console.error("   Crea uno:  node scripts/sembrar-restaurante.mjs");
  await bd.end();
  process.exit(2);
}
const [tenant] = await nube(`tenant?select=id,nombre&id=eq.${barNodo.id}`);
if (!tenant) {
  console.error(`\n⚠️  «${barNodo.nombre}» no existe en la NUBE, y el nodo no crea empresas allí`);
  console.error("   (un bar se provisiona desde la nube). Sin eso, todo rebota con FK.");
  await bd.end();
  process.exit(2);
}
const [local] = await nube(`location?select=id&tenant_id=eq.${tenant.id}&limit=1`);
if (!local) throw new Error("ese tenant no tiene local en la nube");
console.log(`Bar de la nube: ${tenant.nombre}`);

// Lo "provisionamos" en el nodo (copiando de la nube, como haría el instalador).
const [tFull] = await nube(`tenant?select=*&id=eq.${tenant.id}`);
const [lFull] = await nube(`location?select=*&id=eq.${local.id}`);
const cols = (o) => Object.keys(o).map((k) => `"${k}"`).join(",");
const vals = (o) => Object.values(o);
const ph = (o) => Object.keys(o).map((_, i) => `$${i + 1}`).join(",");
await bd.query(`insert into public.tenant (${cols(tFull)}) values (${ph(tFull)}) on conflict (id) do nothing`, vals(tFull));
await bd.query(`insert into public.location (${cols(lFull)}) values (${ph(lFull)}) on conflict (id) do nothing`, vals(lFull));

// ── 2. Una venta CERRADA en el nodo, como si el bar estuviera sin internet ──────────
const clientId = crypto.randomUUID();
const { rows: [pedido] } = await bd.query(
  `insert into public.sales_order (tenant_id, location_id, estado, total, client_id)
        values ($1, $2, 'COBRADA', 12.50, $3) returning id`,
  [tenant.id, local.id, clientId],
);
await bd.query(
  `insert into public.order_line (tenant_id, order_id, nombre, cantidad, precio_unitario, tipo_impositivo)
        values ($1, $2, 'Menu del dia', 1, 12.50, 7)`,
  [tenant.id, pedido.id],
);
console.log(`Venta cerrada en el nodo: 12,50 EUR  (client_id ${clientId.slice(0, 8)}…)`);

// ── 3. Sincronizar DOS VECES (como si se cortara la linea y reintentara) ────────────
console.log("\n--- pase 1 ---");
console.log(execSync("node apps/nodo/sincronizar.mjs", { encoding: "utf8" }).trim());
console.log("\n--- pase 2 (el reintento) ---");
console.log(execSync("node apps/nodo/sincronizar.mjs", { encoding: "utf8" }).trim());

// ── 4. ¿Cuantas veces esta esa venta en la nube? ────────────────────────────────────
const enNube = await nube(`sales_order?select=id,total,estado&client_id=eq.${clientId}`);
const lineas = await nube(`order_line?select=nombre,precio_unitario&order_id=eq.${pedido.id}`);

console.log("\n== EN LA NUBE ==");
console.log(`  la venta aparece ${enNube.length} vez/veces`);
if (enNube[0]) console.log(`  total ${enNube[0].total} EUR, estado ${enNube[0].estado}`);
console.log(`  lineas: ${lineas.length} -> ${lineas.map((l) => l.nombre).join(", ")}`);

const ok = enNube.length === 1 && lineas.length === 1;
console.log(ok
  ? "\nOK: dos sincronizaciones, UNA sola venta. No se duplica el cobro."
  : "\nMAL: la venta se ha duplicado.");

// ── 5. Limpiar: esto era una prueba, no una venta del cliente ───────────────────────
await nube(`order_line?order_id=eq.${pedido.id}`, { method: "DELETE" });
await nube(`sales_order?client_id=eq.${clientId}`, { method: "DELETE" });
await bd.query("delete from public.order_line where order_id = $1", [pedido.id]);
await bd.query("delete from public.sales_order where id = $1", [pedido.id]);
console.log("(prueba limpiada de la nube y del nodo)");

await bd.end();
process.exit(ok ? 0 : 1);
