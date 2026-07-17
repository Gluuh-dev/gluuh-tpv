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

  aplanarStandalone();

  console.log("\nWeb del nodo lista en apps/web/.next/standalone/");
});

// ── LA OTRA TRAMPA DEL STANDALONE: NO ES AUTOCONTENIDO ─────────────────────────
//
// Con pnpm, `next build --standalone` NO deja un `node_modules` plano: deja los paquetes en
// `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>` y, en `apps/web/node_modules/next`, un
// SYMLINK con RUTA ABSOLUTA al `.pnpm` del repo de quien compiló. En nuestra máquina arranca
// (el enlace resuelve), pero al empaquetar para el bar ese enlace se rompe: `next` queda como
// una copia pelada sin sus dependencias y Next se cae nada más arrancar con
//   Error: Cannot find module '@swc/helpers/_/_interop_require_default'
// La web muere, el puerto 3100 no responde, y el panel del TPV sale con un ECONNREFUSED.
//
// No lo pillábamos porque probábamos el nodo desde el repo (con el enlace intacto), nunca el
// standalone COPIADO como lo recibe el bar. Aquí se aplana: cada paquete real del `.pnpm` se
// hoista al `node_modules` de nivel superior (plano, autocontenido), y se borra el
// `apps/web/node_modules` (que solo tenía el enlace roto que sombreaba la resolución buena).
function aplanarStandalone() {
  const raiz = path.join(".next", "standalone");
  const saNM = path.join(raiz, "node_modules");
  const pnpmDir = path.join(saNM, ".pnpm");
  if (!fs.existsSync(pnpmDir)) return;

  const esDirReal = (p) => {
    try { return !fs.lstatSync(p).isSymbolicLink() && fs.statSync(p).isDirectory(); }
    catch { return false; }
  };
  let n = 0;
  // Un STUB es lo que deja el tracer de Next con pnpm: un symlink, o una carpeta
  // con SOLO el package.json y sin el código. Si se respeta ("ya existe"), el
  // paquete queda pelado y Next muere al arrancar con MODULE_NOT_FOUND — en el
  // bar, no aquí. Un paquete real siempre tiene más de una entrada.
  const esStub = (p) => {
    try {
      if (fs.lstatSync(p).isSymbolicLink()) return true;
      return fs.readdirSync(p).length <= 1;
    } catch { return true; }
  };
  const hoist = (nombre, origen) => {
    const destino = path.join(saNM, nombre);
    if (fs.existsSync(destino)) {
      if (!esStub(destino)) return;                // real: el primero gana
      fs.rmSync(destino, { recursive: true, force: true });  // stub: se pisa
    }
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.cpSync(origen, destino, { recursive: true, dereference: true });
    n++;
  };

  for (const store of fs.readdirSync(pnpmDir)) {
    if (store === "node_modules") continue;        // solo enlaces; los cubren sus stores
    const nm = path.join(pnpmDir, store, "node_modules");
    if (!fs.existsSync(nm)) continue;
    for (const ent of fs.readdirSync(nm)) {
      const p = path.join(nm, ent);
      if (ent.startsWith("@")) {
        for (const sub of fs.readdirSync(p)) {
          const sp = path.join(p, sub);
          if (esDirReal(sp)) hoist(path.join(ent, sub), sp);
        }
      } else if (esDirReal(p)) {
        hoist(ent, p);
      }
    }
  }

  const appNM = path.join(raiz, "apps", "web", "node_modules");
  if (fs.existsSync(appNM)) fs.rmSync(appNM, { recursive: true, force: true });

  console.log(`  standalone autocontenido: ${n} paquetes hoisted, enlaces rotos fuera`);
}
