#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Genera `supabase/types/database.types.ts` de forma REPRODUCIBLE (F0, plan 016).
//
//   node scripts/generar-tipos-supabase.mjs           regenera el fichero
//   node scripts/generar-tipos-supabase.mjs --check   gate de drift: falla si el
//                                                     fichero versionado no coincide
//                                                     con la nube (no escribe nada)
//
// Reglas que este script garantiza (y que PowerShell 5.1 no garantiza con `>`):
//   · salida UTF-8 SIN BOM y con finales LF — dos generaciones = mismo hash;
//   · cero bytes nulos (el fichero histórico quedó en UTF-16 LE y ESLint lo
//     trataba como binario);
//   · reemplazo ATÓMICO: solo se toca el destino si la CLI salió con exit 0.
//
// Requiere `SUPABASE_ACCESS_TOKEN` (solo lectura del proyecto). Sin credencial
// sale con código 2: el gate queda en "manual" y se anota en el PR de migración.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROYECTO = "gxcqihslbicrszgzudjs"; // único proyecto autorizado (REGLA Nº 1)
const DESTINO = join(RAIZ, "supabase", "types", "database.types.ts");
const CHECK = process.argv.includes("--check");

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "[tipos] Falta SUPABASE_ACCESS_TOKEN: no se puede contactar la nube.\n" +
      "[tipos] Gate en modo MANUAL: documenta en el PR que los tipos se regeneraron a mano.",
  );
  process.exit(2);
}

let bruto;
try {
  bruto = execFileSync(
    "pnpm",
    ["exec", "supabase", "gen", "types", "typescript", "--project-id", PROYECTO, "--schema", "public"],
    { cwd: RAIZ, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 },
  );
} catch (e) {
  console.error("[tipos] La CLI de Supabase falló; NO se toca el fichero versionado.");
  console.error(String(e.stderr ?? e.message).slice(0, 2000));
  process.exit(1);
}

const limpio = bruto.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
if (!limpio.startsWith("export type Json")) {
  console.error("[tipos] La salida no parece un fichero de tipos (¿login/red?); abortando sin escribir.");
  process.exit(1);
}
if (limpio.includes("\u0000")) {
  console.error("[tipos] La salida contiene bytes nulos; abortando sin escribir.");
  process.exit(1);
}

const hash = createHash("sha256").update(limpio).digest("hex");
const actual = existsSync(DESTINO)
  ? readFileSync(DESTINO, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  : null;

if (CHECK) {
  if (actual === limpio) {
    console.log(`[tipos] Sin drift: el fichero versionado coincide con la nube (${hash.slice(0, 12)}).`);
    process.exit(0);
  }
  console.error("[tipos] DRIFT: la nube y supabase/types/database.types.ts no coinciden.");
  console.error("[tipos] Regenera con `pnpm tipos:generar` y revisa el diff antes de commitear.");
  process.exit(1);
}

if (actual === limpio) {
  console.log(`[tipos] Ya al día (${hash.slice(0, 12)}).`);
  process.exit(0);
}
const temporal = DESTINO + ".tmp";
writeFileSync(temporal, limpio, "utf8");
renameSync(temporal, DESTINO);
console.log(`[tipos] Escrito ${DESTINO} (sha256 ${hash.slice(0, 12)}, UTF-8, LF).`);
