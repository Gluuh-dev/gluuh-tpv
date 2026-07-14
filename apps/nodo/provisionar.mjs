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

import pg from "pg";
import { cabeceras, credenciales } from "./nube.mjs";
import { NO_BAJAR, SOLO_AL_PROVISIONAR, leerEsquema, meterFilas } from "./espejo.mjs";

// El nodo se identifica como SU bar y la RLS lo acota a él. NUNCA lleva la clave maestra
// de la plataforma: en el mini-PC de un cliente, esa clave sería la llave de los datos de
// todos los demás clientes. Ver nube.mjs.
const NUBE = credenciales().url;
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

const cab = await cabeceras();
if (!NUBE || !cab) {
  console.error("Sin credenciales de la nube (.nodo/sync.env) o sin conexión.");
  process.exit(1);
}

async function nube(ruta) {
  const r = await fetch(`${NUBE}/rest/v1/${ruta}`, { headers: cab });
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

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

// El orden (por claves foráneas), las claves primarias de verdad y los tipos de cada
// columna: todo eso lo sabe `espejo.mjs`, que es el mismo que usa el sincronizador. Antes
// vivía aquí duplicado, y una copia de dos que se separan es un fallo esperando su turno.
console.log(`Bajando el bar ${tenantId.slice(0, 8)}… de la nube\n`);
const esquema = await leerEsquema(bd);

let total = 0;
for (const tabla of esquema.orden) {
  // Lo operativo no se baja… salvo las JORNADAS, y sólo aquí, una vez. Sin ellas, un bar que
  // ya venía de la nube empezaría a numerar desde 1, chocaría con la jornada 1 que ya está
  // allí, y **dejaría de subir sus ventas** (cada venta apunta a su jornada). Ver espejo.mjs.
  if (NO_BAJAR.has(tabla) && !SOLO_AL_PROVISIONAR.has(tabla)) continue;
  const columnas = esquema.columnasDe.get(tabla);
  if (!columnas || !esquema.pkDe.get(tabla)?.length) continue;   // sin PK no hay upsert

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

  await meterFilas(bd, esquema, tabla, filas);
  console.log(`  ${tabla.padEnd(26)} ${filas.length}`);
  total += filas.length;
}

console.log(`\n${total} filas bajadas. El bar ya está en el nodo.`);
console.log("Ahora las fotos:  node apps/nodo/descargar-imagenes.mjs\n");

await bd.end();
