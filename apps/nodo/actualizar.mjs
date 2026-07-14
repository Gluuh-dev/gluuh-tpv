// ACTUALIZAR EL NODO desde la nube.
//
// "Poder mandarle una actualización y que se actualice, y todo lo que sería normal."
//
// El nodo mira el tablón (`nodo_release` en la nube). Si hay una versión más nueva que la
// suya, se la baja, COMPRUEBA QUE NO VIENE MANIPULADA, la aplica y se reinicia.
//
// CÓMO SE HACE SIN ROMPER EL BAR:
//
//   · Nada se toca hasta tener el paquete entero y verificado. Se descarga a un lado.
//   · El sha256 se comprueba SIEMPRE. Si no cuadra, no se instala y no pasa nada más.
//     Un TPV que instala cualquier cosa que le mandan es una puerta abierta a la caja.
//   · Se guarda una COPIA de lo que había. Si algo sale mal, se vuelve atrás. (Y funciona:
//     durante el desarrollo saltó tres veces y el nodo volvió entero cada una.)
//   · Sólo se aplican las migraciones QUE FALTAN. Reaplicarlas todas revienta —
//     `0001_init.sql` hace `create table tenant` sin `if not exists`. La cuenta la lleva
//     la tabla `nodo_migracion`.
//   · La base de datos NO se para: si se parara, las migraciones se aplicarían contra
//     una base apagada.
//   · Y no se actualiza con la caja abierta. Un bar a las 21:30 un sábado no es momento
//     de reiniciar nada.
//
//   node apps/nodo/actualizar.mjs            mira si hay algo nuevo y actualiza
//   node apps/nodo/actualizar.mjs --revisar  sólo mira y lo dice; no toca nada

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import pg from "pg";
import { cabeceras, credenciales } from "./nube.mjs";

const RAIZ = path.resolve(".");
const NODO = path.join(RAIZ, ".nodo");
const VERSION_FICHERO = path.join(RAIZ, "apps/nodo/version.json");

// Se identifica como su bar, igual que el sincronizador — nunca con la clave maestra de
// la plataforma. Ver nube.mjs.
const NUBE = credenciales().url;
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

const SOLO_REVISAR = process.argv.includes("--revisar");

// Quitar el BOM: PowerShell escribe UTF-8 CON BOM y JSON.parse se atraganta.
// Un nodo que no puede leer su propia versión no se actualiza nunca, y nadie entendería
// por qué. Sale más barato tolerarlo que confiar en que nadie se equivoque de
// codificación dentro de cinco años.
function leerVersion() {
  if (!fs.existsSync(VERSION_FICHERO)) return "0.0.0";
  const crudo = fs.readFileSync(VERSION_FICHERO, "utf8");
  // 0xFEFF es el BOM. Se compara por código en vez de escribirlo: el carácter en sí es
  // invisible y cualquier editor o linter lo trata como basura.
  const limpio = crudo.charCodeAt(0) === 0xfeff ? crudo.slice(1) : crudo;
  return JSON.parse(limpio).version;
}
const versionLocal = leerVersion();

/** Compara semver: ¿es `a` más nueva que `b`? */
function masNueva(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

// ── 1. ¿Hay algo nuevo? ──────────────────────────────────────────────────────
const cab = await cabeceras();
if (!NUBE || !cab) {
  console.log("Sin credenciales de la nube (o sin línea): este nodo no se actualiza ahora.");
  process.exit(0);
}

let ultima;
try {
  const r = await fetch(
    `${NUBE}/rest/v1/nodo_release?select=*&order=publicada_at.desc&limit=1`,
    { headers: cab },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  [ultima] = await r.json();
} catch (e) {
  // Sin internet no es un error: el bar sigue con la versión que tiene, que funciona.
  console.log(`No se pudo consultar la nube (${e.message}). El bar sigue igual.`);
  process.exit(0);
}

if (!ultima || !masNueva(ultima.version, versionLocal)) {
  console.log(`Al día: versión ${versionLocal}.`);
  process.exit(0);
}

console.log(`Hay versión nueva: ${versionLocal} → ${ultima.version}`);
if (ultima.notas) console.log(`  ${ultima.notas}`);

if (SOLO_REVISAR) process.exit(0);

// ── 2. ¿Es buen momento? ─────────────────────────────────────────────────────
const bd = new pg.Client({ connectionString: BD });
await bd.connect();

const { rows: [ocupado] } = await bd.query(`
  select (select count(*) from public.sales_order where estado = 'ABIERTA') as cuentas_abiertas,
         (select count(*) from public.cash_session where cerrada_en is null) as cajas_abiertas
`);

if (Number(ocupado.cuentas_abiertas) > 0 || Number(ocupado.cajas_abiertas) > 0) {
  // NO se actualiza con el bar trabajando. Reiniciar los servicios con mesas abiertas
  // es tirarle el TPV al camarero en plena comanda. Ya se actualizará al cerrar.
  console.log(
    `\nAhora no: hay ${ocupado.cuentas_abiertas} cuenta(s) abiertas y ` +
    `${ocupado.cajas_abiertas} caja(s) sin cerrar. Se actualizará cuando cierre el bar.`,
  );
  await bd.end();
  process.exit(0);
}

// ── 3. Bajar y COMPROBAR que no viene manipulado ─────────────────────────────
const tmp = path.join(NODO, "tmp", `actualizacion-${ultima.version}`);
fs.mkdirSync(tmp, { recursive: true });
const zip = path.join(tmp, "nodo.zip");

console.log("\nDescargando…");
const desc = await fetch(ultima.url);
if (!desc.ok) throw new Error(`no se pudo bajar el paquete: HTTP ${desc.status}`);
const bytes = Buffer.from(await desc.arrayBuffer());

const huella = crypto.createHash("sha256").update(bytes).digest("hex");
if (huella !== ultima.sha256) {
  // El paquete NO es el que publicamos. No se instala, y punto.
  console.error("\n¡EL PAQUETE NO CUADRA! No se instala.");
  console.error(`  esperado: ${ultima.sha256}`);
  console.error(`  recibido: ${huella}`);
  await bd.end();
  process.exit(1);
}
fs.writeFileSync(zip, bytes);
console.log(`  verificado (sha256 correcto, ${(bytes.length / 1024).toFixed(0)} KB)`);

// ── 4. Copia de seguridad de lo que hay ──────────────────────────────────────
const respaldo = path.join(NODO, "respaldo");
fs.rmSync(respaldo, { recursive: true, force: true });
fs.mkdirSync(respaldo, { recursive: true });
for (const carpeta of ["apps/nodo", "supabase"]) {
  fs.cpSync(path.join(RAIZ, carpeta), path.join(respaldo, carpeta), { recursive: true });
}
console.log("  copia de seguridad hecha");

// ── 5. Aplicar ───────────────────────────────────────────────────────────────
try {
  console.log("\nParando los servicios (la base de datos sigue viva)…");
  // -MantenerBd: hay que parar los servicios para cambiarles el código, pero Postgres
  // TIENE que seguir en marcha — si no, las migraciones de abajo se aplicarían contra
  // una base de datos apagada y la actualización se caería entera.
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${RAIZ}\\supabase\\nodo\\arrancar-nodo.ps1" -Parar -MantenerBd`,
    { stdio: "ignore" });

  console.log("Aplicando la versión nueva…");
  // Expand-Archive: descomprimir sin añadir una dependencia sólo para esto.
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${RAIZ}' -Force"`,
    { stdio: "ignore" });

  console.log("Aplicando migraciones…");
  //
  // SÓLO LAS QUE FALTAN. Las migraciones NO son idempotentes: `0001_init.sql` hace
  // `create table tenant` a secas. Reaplicarlas todas revienta con «relation "tenant"
  // already exists» y el bar no se actualizaría jamás. La cuenta la lleva
  // `nodo_migracion` (creada en 00_bootstrap).
  const psql = path.join(NODO, "pgsql", "bin", "psql.exe");
  process.env.PGPASSWORD = "gluuh";

  // Sin esto, psql se cree que el fichero viene en WIN1252 (la codificación del sistema
  // en un Windows español) y revienta en la primera tilde:
  //   «character with byte sequence 0x8d in encoding "WIN1252" has no equivalent in UTF8»
  // Nuestras migraciones están en UTF-8 y llenas de acentos, porque el proyecto está en
  // español. Se lo decimos y punto.
  process.env.PGCLIENTENCODING = "UTF8";

  const { rows: yaEstan } = await bd.query("select fichero from public.nodo_migracion");
  const aplicadas = new Set(yaEstan.map((r) => r.fichero));

  // Si una migración falla hay que VER POR QUÉ. Con `stdio: "ignore"` el fallo llegaba
  // mudo —«Command failed»— y ni el soporte ni nosotros sabríamos qué pasó en el bar.
  const migrar = (fichero) => {
    try {
      execSync(`"${psql}" -h 127.0.0.1 -p 55432 -U postgres -d gluuh -q -v ON_ERROR_STOP=1 -f "${fichero}"`,
        { stdio: ["ignore", "ignore", "pipe"] });
    } catch (e) {
      throw new Error(`${path.basename(fichero)}: ${String(e.stderr ?? "").trim() || e.message}`, { cause: e });
    }
  };

  let nuevas = 0;
  for (const f of fs.readdirSync(path.join(RAIZ, "supabase/migrations")).sort()) {
    if (aplicadas.has(f)) continue;
    migrar(path.join(RAIZ, "supabase/migrations", f));
    await bd.query("insert into public.nodo_migracion (fichero) values ($1) on conflict do nothing", [f]);
    console.log(`  + ${f}`);
    nuevas++;
  }
  console.log(`  ${nuevas} migración(es) nueva(s)`);

  // Éstas SÍ se reaplican siempre: son las del propio nodo (triggers de realtime,
  // permisos…) y están escritas para poder pasarse mil veces. Y hace falta: una
  // migración nueva puede traer una tabla que necesite su trigger y sus permisos.
  //
  // `06_auth_nodo.sql` FALTABA. Ahí viven las funciones con las que entran el dueño y los
  // camareros (`verificar_password_local`, `fijar_password_local`): un arreglo en ellas se
  // publicaba, el bar se lo bajaba… y no se aplicaba nunca. Y `05_permisos` va EL ÚLTIMO
  // porque tiene que cubrir todo lo que acaba de nacer.
  for (const f of ["02_realtime_nodo.sql", "03_media_nodo.sql", "04_sync_nodo.sql",
                   "06_auth_nodo.sql", "05_permisos_nodo.sql"]) {
    migrar(path.join(RAIZ, "supabase/nodo", f));
  }

  fs.writeFileSync(VERSION_FICHERO, JSON.stringify({ version: ultima.version, instalada: new Date().toISOString() }, null, 2) + "\n");

  console.log("Arrancando…");
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${RAIZ}\\supabase\\nodo\\arrancar-nodo.ps1"`,
    { stdio: "inherit" });

  console.log(`\nActualizado a la ${ultima.version}.`);
} catch (e) {
  // Algo se ha torcido: se vuelve a lo que había y se levanta. El bar tiene que abrir
  // mañana, con la versión vieja si hace falta.
  console.error(`\nFALLÓ la actualización: ${e.message}`);
  console.error("Volviendo a la versión anterior…");
  for (const carpeta of ["apps/nodo", "supabase"]) {
    fs.cpSync(path.join(respaldo, carpeta), path.join(RAIZ, carpeta), { recursive: true, force: true });
  }
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${RAIZ}\\supabase\\nodo\\arrancar-nodo.ps1"`,
    { stdio: "inherit" });
  console.error("Se ha vuelto atrás. El bar sigue funcionando con la versión anterior.");
  await bd.end();
  process.exit(1);
}

await bd.end();
