#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Gate del CONTRATO de esquema (F0, plan 016 paso 4). Sin red: contrasta los
// literales `.from("tabla")` y `.rpc("funcion")` del código contra los tipos
// generados en `supabase/types/database.types.ts`.
//
//   node scripts/verificar-contrato-supabase.mjs
//
// Falla (exit 1) si el código usa una tabla/RPC que no existe en el contrato
// y no está en EXCEPCIONES. Así una RPC retirada (p. ej. las de 0105) no puede
// volver a colarse sin que alguien lo escriba aquí con nombre y motivo.
// También verifica que el fichero de tipos sigue siendo UTF-8 sin BOM/nulos.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIPOS = join(RAIZ, "supabase", "types", "database.types.ts");

// Excepciones DOCUMENTADAS: nombre → motivo. Vacío hoy; si algo legítimo solo
// existe en el nodo (nunca en la nube), se apunta aquí con su migración.
const EXCEPCIONES = new Map([
  // ["nombre", "motivo y migración"] — vacío: todo lo escrito está aplicado en
  // la nube (0111–0116, 17-07) y cubierto por los tipos generados.
]);

// Dónde vive código que habla con PostgREST/Supabase.
const CARPETAS = ["apps/web/app", "apps/web/components", "apps/web/lib", "apps/mobile/src", "apps/nodo", "packages"];
const IGNORAR = new Set(["node_modules", "dist", ".next", ".turbo", "coverage", "pruebas"]);
const EXTENSIONES = /\.(ts|tsx|mjs)$/;

// 1 ── Codificación del contrato
const bytes = readFileSync(TIPOS);
if (bytes[0] === 0xff || bytes[0] === 0xfe || (bytes[0] === 0xef && bytes[1] === 0xbb)) {
  console.error("[contrato] database.types.ts tiene BOM; regenera con `pnpm tipos:generar`.");
  process.exit(1);
}
if (bytes.includes(0)) {
  console.error("[contrato] database.types.ts contiene bytes nulos (¿UTF-16?); regenera.");
  process.exit(1);
}

// 2 ── Nombres del contrato (tablas, vistas y funciones del esquema public)
const texto = bytes.toString("utf8");
function nombresDeSeccion(seccion) {
  const inicio = texto.indexOf(`    ${seccion}: {`);
  if (inicio === -1) return new Set();
  const cuerpo = texto.slice(inicio);
  // Nombres al nivel de 6 espacios hasta que cierra la sección (4 espacios + }).
  const fin = cuerpo.search(/\n {4}\}/);
  const nombres = new Set();
  for (const m of cuerpo.slice(0, fin).matchAll(/^ {6}(\w+): \{/gm)) nombres.add(m[1]);
  return nombres;
}
const tablas = new Set([...nombresDeSeccion("Tables"), ...nombresDeSeccion("Views")]);
const rpcs = nombresDeSeccion("Functions");

// 3 ── Literales usados por el código
const usos = []; // { tipo: "from"|"rpc", nombre, fichero, linea }
function recorrer(dir) {
  for (const entrada of readdirSync(dir)) {
    if (IGNORAR.has(entrada)) continue;
    const ruta = join(dir, entrada);
    const st = statSync(ruta);
    if (st.isDirectory()) recorrer(ruta);
    else if (EXTENSIONES.test(entrada)) {
      const lineas = readFileSync(ruta, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        // `.storage.from("bucket")` es un bucket de Storage, no una tabla.
        for (const m of linea.matchAll(/(?<!\.storage)\.(from|rpc)\(\s*"([A-Za-z0-9_]+)"/g)) {
          usos.push({ tipo: m[1], nombre: m[2], fichero: relative(RAIZ, ruta), linea: i + 1 });
        }
      });
    }
  }
}
for (const c of CARPETAS) {
  try { recorrer(join(RAIZ, c)); } catch { /* carpeta opcional */ }
}

// 4 ── Contraste
const faltan = usos.filter((u) => {
  if (EXCEPCIONES.has(u.nombre)) return false;
  return u.tipo === "from" ? !tablas.has(u.nombre) : !rpcs.has(u.nombre);
});

console.log(`[contrato] ${tablas.size} tablas/vistas y ${rpcs.size} RPC en el contrato; ${usos.length} usos literales en el código.`);
if (faltan.length) {
  console.error(`[contrato] ${faltan.length} uso(s) NO existen en el contrato generado:`);
  for (const u of faltan) console.error(`  ${u.fichero}:${u.linea}  .${u.tipo}("${u.nombre}")`);
  console.error("[contrato] O el esquema vivo va por detrás (migración sin aplicar), o el código usa un objeto retirado.");
  process.exit(1);
}
console.log("[contrato] OK: todo lo que el código nombra existe en el contrato.");
