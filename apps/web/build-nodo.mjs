// Compila la web PARA EL NODO (build `standalone`, autocontenido).
//
//   pnpm --filter @gluuh/web build:nodo
//
// Existe este fichero en vez de un `NODO_BUILD=1 next build` en el package.json porque
// eso no funciona en Windows (cmd no entiende el prefijo) y no merece la pena añadir una
// dependencia —`cross-env`— para poner una variable de entorno.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

process.env.NODO_BUILD = "1";

const next = spawn("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

next.on("exit", (codigo) => {
  if (codigo !== 0) process.exit(codigo ?? 1);

  // ── LA TRAMPA DEL STANDALONE ───────────────────────────────────────────────
  //
  // Next NO copia `.next/static` ni `public` dentro del standalone. Hay que hacerlo a
  // mano — y si se olvida, la web ARRANCA IGUAL pero sirve el HTML **sin CSS y sin
  // JavaScript**: una página en blanco en el TPV de un bar, sin un solo error en los
  // logs. (Y sin `public`, el plano de mesas se queda sin sus SVG.)
  const destino = path.join(".next", "standalone", "apps", "web");

  for (const [de, a] of [
    [path.join(".next", "static"), path.join(destino, ".next", "static")],
    ["public", path.join(destino, "public")],
  ]) {
    if (!fs.existsSync(de)) continue;
    fs.rmSync(a, { recursive: true, force: true });
    fs.cpSync(de, a, { recursive: true });
    console.log(`  copiado al standalone: ${de}`);
  }

  console.log("\nWeb del nodo lista en apps/web/.next/standalone/");
});
