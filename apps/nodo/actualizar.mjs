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
//   · Se guarda una COPIA de lo que había. Si algo sale mal, se vuelve atrás.
//   · Las migraciones son idempotentes (`if not exists`): se pueden reaplicar sin miedo.
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

const RAIZ = path.resolve(".");
const NODO = path.join(RAIZ, ".nodo");
const VERSION_FICHERO = path.join(RAIZ, "apps/nodo/version.json");

// Credenciales de la nube (el mismo fichero que usa el sincronizador).
const ENV = path.join(NODO, "sync.env");
if (fs.existsSync(ENV)) {
  for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
    if (m) process.env[m[1]] ??= m[2];
  }
}
const NUBE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SECRET_KEY;
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

const SOLO_REVISAR = process.argv.includes("--revisar");

const versionLocal = fs.existsSync(VERSION_FICHERO)
  ? JSON.parse(fs.readFileSync(VERSION_FICHERO, "utf8")).version
  : "0.0.0";

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
if (!NUBE || !CLAVE) {
  console.log("Sin credenciales de la nube: este nodo no se actualiza solo.");
  process.exit(0);
}

let ultima;
try {
  const r = await fetch(
    `${NUBE}/rest/v1/nodo_release?select=*&order=publicada_at.desc&limit=1`,
    { headers: { apikey: CLAVE, authorization: `Bearer ${CLAVE}` } },
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
  console.log("\nParando el nodo…");
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${RAIZ}\\supabase\\nodo\\arrancar-nodo.ps1" -Parar`,
    { stdio: "ignore" });

  console.log("Aplicando la versión nueva…");
  // Expand-Archive: descomprimir sin añadir una dependencia sólo para esto.
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${RAIZ}' -Force"`,
    { stdio: "ignore" });

  console.log("Aplicando migraciones…");
  // Las migraciones son idempotentes (`if not exists`): reaplicarlas todas es seguro y
  // evita llevar la cuenta de cuáles faltan.
  const psql = path.join(NODO, "pgsql", "bin", "psql.exe");
  process.env.PGPASSWORD = "gluuh";
  for (const f of fs.readdirSync(path.join(RAIZ, "supabase/migrations")).sort()) {
    execSync(`"${psql}" -h 127.0.0.1 -p 55432 -U postgres -d gluuh -q -v ON_ERROR_STOP=1 -f "${path.join(RAIZ, "supabase/migrations", f)}"`,
      { stdio: "ignore" });
  }
  for (const f of ["02_realtime_nodo.sql", "03_media_nodo.sql", "04_sync_nodo.sql"]) {
    execSync(`"${psql}" -h 127.0.0.1 -p 55432 -U postgres -d gluuh -q -v ON_ERROR_STOP=1 -f "${path.join(RAIZ, "supabase/nodo", f)}"`,
      { stdio: "ignore" });
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
