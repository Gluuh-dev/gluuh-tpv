// PUBLICAR UNA VERSIÓN DEL NODO — esto lo corremos NOSOTROS, no el bar.
//
// Empaqueta el nodo, lo sube a la nube y lo anuncia en el tablón. A partir de ese
// momento, cada nodo lo ve y se actualiza solo (cuando el bar esté cerrado).
//
//   node apps/nodo/publicar.mjs 1.1.0 "Arregla el redondeo del IGIC"
//
// El sha256 se calcula aquí y se guarda en el tablón. Es la huella que cada nodo va a
// exigir antes de instalar nada: si el zip que se descarga no la cumple, no se instala.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const version = process.argv[2];
const notas = process.argv[3] ?? null;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Uso: node apps/nodo/publicar.mjs <version> "<notas>"   (ej: 1.1.0)');
  process.exit(1);
}

const RAIZ = path.resolve(".");
for (const l of fs.readFileSync(".nodo/sync.env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const NUBE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SECRET_KEY;

// La versión va DENTRO del paquete: así el nodo, al descomprimirlo, ya sabe cuál tiene.
fs.writeFileSync(
  path.join(RAIZ, "apps/nodo/version.json"),
  JSON.stringify({ version }, null, 2) + "\n",
);

const zip = path.join(RAIZ, ".nodo", "tmp", `nodo-${version}.zip`);
fs.mkdirSync(path.dirname(zip), { recursive: true });
fs.rmSync(zip, { force: true });

// Sólo lo que el nodo necesita: su código y las migraciones. Ni binarios, ni datos, ni
// —jamás— .nodo/ (que es donde viven las credenciales).
console.log("Empaquetando apps/nodo + supabase…");
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${RAIZ}\\apps\\nodo','${RAIZ}\\supabase' -DestinationPath '${zip}' -Force"`,
  { stdio: "inherit" },
);

const bytes = fs.readFileSync(zip);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
console.log(`  ${(bytes.length / 1024).toFixed(0)} KB   sha256 ${sha256.slice(0, 16)}…`);

const ruta = `nodo/nodo-${version}.zip`;
const cab = { apikey: CLAVE, authorization: `Bearer ${CLAVE}` };

console.log("Subiendo a Storage…");
const sub = await fetch(`${NUBE}/storage/v1/object/media/${ruta}`, {
  method: "POST",
  headers: { ...cab, "x-upsert": "true", "content-type": "application/zip" },
  body: bytes,
});
if (!sub.ok) throw new Error(`no se pudo subir: HTTP ${sub.status} ${await sub.text()}`);

const url = `${NUBE}/storage/v1/object/public/media/${ruta}`;

console.log("Anunciando en el tablón…");
const anuncio = await fetch(`${NUBE}/rest/v1/nodo_release?on_conflict=version`, {
  method: "POST",
  headers: { ...cab, "content-type": "application/json", prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify([{ version, url, sha256, notas }]),
});
if (!anuncio.ok) throw new Error(`no se pudo anunciar: HTTP ${anuncio.status} ${await anuncio.text()}`);

console.log(`\nPublicada la ${version}. Los nodos se actualizarán solos cuando cierren.`);
