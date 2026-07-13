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

const RAIZ = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const MARCA = "/storage/v1/object/public/media/";

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

for (const url of urls) {
  const rel = url.slice(url.indexOf(MARCA) + MARCA.length);
  const destino = path.resolve(RAIZ, rel);

  // Ya la tenemos: ni la pedimos. Reinstalar no debe volver a bajarse 400 fotos.
  if (fs.existsSync(destino)) { ya++; continue; }

  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
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
