// PROVISIONAR EL NODO — bajarse el bar de la nube.
//
// "Si pongo un TPV nuevo, que descargue toda la información a través de internet,
//  aunque después no la use."
//
// Es el PRIMER paso de una instalación real, y el único que necesita internet. El nodo
// nace vacío: sin esto no tendría ni la carta, ni las mesas, ni los empleados. Y lo que
// vendiera no podría subir nunca, porque en la nube ni siquiera existiría el `tenant`.
//
// Después de esto, el bar ya vive solo: vende sin línea y sincroniza cuando la haya.
//
//   node apps/nodo/provisionar.mjs <tenant-id>
//   node apps/nodo/provisionar.mjs --listar        ver qué bares hay en la nube
//
// SÓLO BAJA LO QUE LA NUBE MANDA: catálogo y configuración (carta, salas, empleados,
// tarifas, impresoras…). NO baja ventas ni caja ni facturas: eso nace en el bar y el bar
// tiene la razón — bajarlas sería invitar a que la nube pisara una venta.

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Timestamps en texto: el Date de JS pierde los microsegundos de Postgres.
pg.types.setTypeParser(1184, (v) => v);
pg.types.setTypeParser(1114, (v) => v);

const ENV = path.resolve(".nodo/sync.env");
if (fs.existsSync(ENV)) {
  for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
    if (m) process.env[m[1]] ??= m[2];
  }
}
const NUBE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SECRET_KEY;
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

if (!NUBE || !CLAVE) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en .nodo/sync.env");
  process.exit(1);
}

const cab = { apikey: CLAVE, authorization: `Bearer ${CLAVE}` };

async function nube(ruta) {
  const r = await fetch(`${NUBE}/rest/v1/${ruta}`, { headers: cab });
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// ── Qué NO se baja ───────────────────────────────────────────────────────────
//
// Lo operativo y lo fiscal NACE EN EL BAR. Si lo bajáramos, la nube podría pisar una
// venta — y la regla es que en eso manda el nodo. Las tablas `nodo_*` son la libreta
// interna del nodo y ni siquiera existen en la nube.
const NO_BAJAR = new Set([
  "sales_order", "order_line", "payment", "invoice", "invoice_tax_line", "tax_line",
  "verifactu_record", "ticketbai_record", "cash_session", "cash_move", "print_job",
  "shift", "stock_move", "online_order", "reservation",
  "nodo_migracion", "nodo_sync_estado", "nodo_media_pendiente", "nodo_release",
  "platform_admin", "pago_gluuh", "contact_request",
]);

const bd = new pg.Client({ connectionString: BD });
await bd.connect();

if (process.argv.includes("--listar")) {
  const bares = await nube("tenant?select=id,nombre,slug&order=created_at");
  console.log(`\n${bares.length} bar(es) en la nube:\n`);
  for (const b of bares) console.log(`  ${b.id}   ${b.nombre}`);
  console.log("");
  await bd.end();
  process.exit(0);
}

const tenantId = process.argv[2];
if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
  console.error("Uso: node apps/nodo/provisionar.mjs <tenant-id>   (o --listar)");
  await bd.end();
  process.exit(1);
}

// ── El ORDEN: no se puede bajar un producto antes que su categoría ───────────
//
// Se deduce del propio esquema (las claves foráneas), no de una lista escrita a mano que
// se quedaría vieja en cuanto alguien añada una tabla. Es un orden topológico: cada tabla
// va después de aquellas de las que depende.
const { rows: fks } = await bd.query(`
  select c.conrelid::regclass::text  as hijo,
         c.confrelid::regclass::text as padre
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where c.contype = 'f' and n.nspname = 'public'
     and c.conrelid <> c.confrelid          -- las autorreferencias no ordenan nada
`);

const { rows: tablas } = await bd.query(`
  select tablename from pg_tables where schemaname = 'public'
`);

const limpio = (s) => s.replace(/^public\./, "");
const depende = new Map(tablas.map((t) => [t.tablename, new Set()]));
for (const f of fks) {
  const hijo = limpio(f.hijo);
  const padre = limpio(f.padre);
  if (depende.has(hijo) && depende.has(padre)) depende.get(hijo).add(padre);
}

const orden = [];
const visto = new Set();
const visitar = (t, pila = new Set()) => {
  if (visto.has(t) || pila.has(t)) return;   // ciclo: se corta y ya
  pila.add(t);
  for (const p of depende.get(t) ?? []) visitar(p, pila);
  pila.delete(t);
  visto.add(t);
  orden.push(t);
};
for (const t of depende.keys()) visitar(t);

// ── Bajar ────────────────────────────────────────────────────────────────────
console.log(`Bajando el bar ${tenantId.slice(0, 8)}… de la nube\n`);

const { rows: cols } = await bd.query(`
  select table_name, column_name, data_type, udt_name
    from information_schema.columns where table_schema = 'public'
`);
const columnasDe = new Map();
const tipoDe = new Map();   // "tabla.columna" → tipo
for (const c of cols) {
  if (!columnasDe.has(c.table_name)) columnasDe.set(c.table_name, new Set());
  columnasDe.get(c.table_name).add(c.column_name);
  tipoDe.set(`${c.table_name}.${c.column_name}`, c);
}

/**
 * Adapta un valor de JSON al tipo REAL de la columna.
 *
 * Sin esto, un `text[]` de Postgres (p. ej. `product.alergenos`) llega como array de JS,
 * se serializa a `"[]"` y Postgres lo rechaza: «malformed array literal». Un array de JS
 * y un JSON que casualmente es una lista se ven idénticos desde aquí — la única forma de
 * distinguirlos es preguntarle al esquema de qué tipo es la columna.
 */
function valorPara(tabla, columna, v) {
  // ── LOS `auth_user_id` DE LA NUBE NO VALEN AQUÍ ────────────────────────────
  //
  // El nodo tiene su PROPIO GoTrue, con su propia tabla de cuentas. Un `auth_user_id`
  // copiado de la nube apunta a una cuenta que en el nodo NO EXISTE.
  //
  // Y no es un detalle: al entrar un camarero, `/api/entrar-operario` ve que el operario
  // ya tiene `auth_user_id` y hace `updateUserById(ese-id)` contra el GoTrue del nodo…
  // que responde «user not found». **Nadie podría entrar al TPV.**
  //
  // Vaciándolo, la primera vez que entre cada camarero se le crea la cuenta en el nodo
  // (esa rama del código ya existe) y a partir de ahí todo va solo.
  if (columna === "auth_user_id") return null;

  if (v === null || v === undefined) return null;
  const t = tipoDe.get(`${tabla}.${columna}`);
  if (!t) return v;
  if (t.data_type === "ARRAY") return v;                       // el driver ya sabe
  if (t.data_type === "json" || t.data_type === "jsonb") return JSON.stringify(v);
  return typeof v === "object" ? JSON.stringify(v) : v;
}

// La CLAVE PRIMARIA de cada tabla, tal como es — no "id" a lo bruto.
//
// Hay tablas cuya PK no se llama `id`: `tenant_branding` va por `tenant_id`, y las de
// unión (product_category, product_etiqueta…) tienen PK compuesta. Exigiendo `id` se
// saltaban en silencio y el bar se habría quedado **sin logo ni colores** — y sin la
// mitad de las relaciones de la carta.
const { rows: pks } = await bd.query(`
  select t.relname as tabla, a.attname as columna
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
   where i.indisprimary and n.nspname = 'public'
`);
const pkDe = new Map();
for (const p of pks) {
  if (!pkDe.has(p.tabla)) pkDe.set(p.tabla, []);
  pkDe.get(p.tabla).push(p.columna);
}

let total = 0;
for (const tabla of orden) {
  if (NO_BAJAR.has(tabla)) continue;
  const columnas = columnasDe.get(tabla);
  const pk = pkDe.get(tabla);
  if (!columnas || !pk?.length) continue;   // sin clave primaria no hay upsert posible

  // `tenant` se filtra por su propio `id` (no tiene columna tenant_id: ella ES el bar).
  // Sin este caso aparte se bajaban TODOS los bares de la nube al nodo de uno solo.
  let filtro = "";
  if (tabla === "tenant") filtro = `id=eq.${tenantId}`;
  else if (columnas.has("tenant_id")) filtro = `tenant_id=eq.${tenantId}`;
  // Sin tenant_id ni ser `tenant` → catálogo global (tipos de IVA, alérgenos…): entero.

  let filas;
  try {
    filas = await nube(`${tabla}?select=*${filtro ? `&${filtro}` : ""}&limit=5000`);
  } catch (e) {
    // Una tabla que en la nube no existe (o no deja leer) no puede tumbar la instalación.
    console.warn(`  ${tabla.padEnd(26)} se salta (${e.message.slice(0, 60)})`);
    continue;
  }
  if (filas.length === 0) continue;

  const claves = Object.keys(filas[0]);
  const lista = claves.map((k) => `"${k}"`).join(", ");
  const huecos = claves.map((_, i) => `$${i + 1}`).join(", ");
  const conflicto = pk.map((k) => `"${k}"`).join(", ");
  const otras = claves.filter((k) => !pk.includes(k));
  const pisar = otras.map((k) => `"${k}" = excluded."${k}"`).join(", ");

  // Si TODAS las columnas son la clave (una tabla de unión pura), no hay nada que pisar:
  // `do update set` sin columnas es un error de sintaxis. Se ignora el duplicado.
  const alChocar = pisar ? `do update set ${pisar}` : "do nothing";

  for (const fila of filas) {
    await bd.query(
      `insert into public."${tabla}" (${lista}) values (${huecos})
       on conflict (${conflicto}) ${alChocar}`,
      claves.map((k) => valorPara(tabla, k, fila[k])),
    );
  }

  console.log(`  ${tabla.padEnd(26)} ${filas.length}`);
  total += filas.length;
}

console.log(`\n${total} filas bajadas. El bar ya está en el nodo.`);
console.log("Ahora las fotos:  node apps/nodo/descargar-imagenes.mjs\n");

await bd.end();
