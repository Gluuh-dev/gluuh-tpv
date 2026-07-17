// DESCARGA LAS IMÁGENES DE LA NUBE AL NODO.
//
// Se ejecuta al INSTALAR (que es el único momento en que se garantiza internet) y luego
// cada vez que haya conexión: un TPV nuevo se baja toda la carta y a partir de ahí la
// pinta desde la LAN, sin depender de nada.
//
// Busca las URLs en la propia base de datos: cualquier columna de texto que apunte a
// Supabase Storage. Así no hay una lista de columnas que mantener a mano y que se quede
// vieja en cuanto alguien añada una foto en otro sitio.
//
//   node apps/nodo/descargar-imagenes.mjs

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { urlNube } from "./secreto.mjs";

const RAIZ = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const MARCA = "/storage/v1/object/public/media/";
// F5 (plans/023): SOLO se descarga del Supabase de ESTE bar. Una URL colada en
// cualquier campo de texto (nombre de producto, nota…) que apunte a 127.0.0.1,
// 169.254.169.254 o a un tercero, simplemente no es de este origen y se ignora.
// Con esto no hace falta lista negra de IPs: la lista blanca es de UNO.
const ORIGEN_PERMITIDO = (() => {
  try { return new URL(urlNube()).origin; } catch { return null; }
})();
const MAX_BYTES_FICHERO = 20 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

const bd = new pg.Client({ connectionString: BD });
await bd.connect();

// Todas las columnas de texto de la aplicación, preguntadas al propio esquema.
const { rows: columnas } = await bd.query(`
  select table_name, column_name
    from information_schema.columns
   where table_schema = 'public'
     and data_type in ('text', 'character varying')
`);

const urls = new Set();
for (const c of columnas) {
  const { rows } = await bd.query(
    `select distinct "${c.column_name}" as u
       from public."${c.table_name}"
      where "${c.column_name}" like $1`,
    [`%${MARCA}%`],
  );
  for (const r of rows) if (r.u) urls.add(r.u);
}

console.log(`${urls.size} imagen(es) referenciadas en la base de datos`);

let bajadas = 0;
let ya = 0;
let fallos = 0;

if (!ORIGEN_PERMITIDO && urls.size > 0) {
  console.warn("Sin SUPABASE_URL en .nodo/sync.env: no se descarga nada (origen desconocido).");
}

for (const url of urls) {
  // Allowlist de origen (F5): solo el Supabase de este bar, y por su ruta de
  // Storage. `redirect: "error"` evita que una redirección nos saque de él.
  let parseada;
  try { parseada = new URL(url); } catch { fallos++; continue; }
  if (!ORIGEN_PERMITIDO || parseada.origin !== ORIGEN_PERMITIDO || !parseada.pathname.startsWith(MARCA)) {
    console.warn(`  ignorada (origen no permitido): ${url.slice(0, 80)}`);
    fallos++;
    continue;
  }

  const rel = parseada.pathname.slice(parseada.pathname.indexOf(MARCA) + MARCA.length);
  // Contención: el destino tiene que colgar de RAIZ (un `..%2f` en la ruta de la
  // foto no escribe fuera de la carpeta de media).
  const destino = path.resolve(RAIZ, decodeURIComponent(rel));
  if (destino !== RAIZ && !destino.startsWith(RAIZ + path.sep)) {
    console.warn(`  ignorada (ruta fuera de media): ${rel.slice(0, 80)}`);
    fallos++;
    continue;
  }

  // Ya la tenemos: ni la pedimos. Reinstalar no debe volver a bajarse 400 fotos.
  if (fs.existsSync(destino)) { ya++; continue; }

  try {
    const r = await fetch(parseada, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const cuerpo = Buffer.from(await r.arrayBuffer());
    if (cuerpo.length > MAX_BYTES_FICHERO) throw new Error(`demasiado grande (${cuerpo.length} bytes)`);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, cuerpo);
    bajadas++;
  } catch (e) {
    // Una foto que no se baja NO puede tumbar la instalación: el producto saldrá sin
    // imagen y el bar abre igual. Se avisa y se sigue.
    console.warn(`  no se pudo bajar ${rel}: ${e.message}`);
    fallos++;
  }
}

console.log(`bajadas: ${bajadas}   ya estaban: ${ya}   fallidas: ${fallos}`);
await bd.end();
