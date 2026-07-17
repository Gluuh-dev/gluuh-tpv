// EL NODO SIRVE LA WEB.
//
// ─────────────────────────────────────────────────────────────────────────────
//  POR QUÉ, Y QUÉ SE LLEVA POR DELANTE
//
//  La app de escritorio del TPV carga la interfaz de una URL (apps/desktop, `loadURL`).
//  Así que alguien tiene que servirla. En un bar sin internet, ese alguien es el nodo.
//
//  Y hacerlo así se lleva por delante el mayor foco de errores de instalación:
//
//    · Las `NEXT_PUBLIC_*` se incrustan AL COMPILAR. Cada bar tiene su IP y su secreto
//      (y por tanto su clave), así que habría que compilar UNA WEB POR CLIENTE. Aquí no:
//      la configuración se le pasa a la app en tiempo de ejecución (ver app/lib/config.ts),
//      y una sola compilación vale para todos.
//
//    · Y como la web y los datos salen del MISMO ORIGEN, el TPV habla con su propio
//      servidor: **en las terminales no hay NADA que configurar**. Antes eran cuatro
//      variables en un `.env.local` por máquina — y equivocarse en una (poner la clave de
//      la nube donde va la del nodo) dejaba a los camareros fuera sin decir por qué.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { firmar, secretoDelNodo, urlNube } from "./secreto.mjs";

const RAIZ = path.resolve(".");
const WEB = path.join(RAIZ, "apps", "web");
const PUERTO = Number(process.env.NODO_WEB_PUERTO ?? 3100);


const entorno = {
  ...process.env,
  PORT: String(PUERTO),
  HOSTNAME: "127.0.0.1",          // sólo el gateway le habla; a la red sale por el 54321

  // Estas NO llevan `NEXT_PUBLIC_` a propósito: se leen EN EL SERVIDOR. Si llevaran el
  // prefijo se incrustarían al compilar y estaríamos otra vez en una web por bar.
  //
  // Las usan las rutas de servidor (p. ej. `/api/entrar-operario`, que pide un vale al
  // auth del nodo). Lo que ve el NAVEGADOR se lo inyecta el gateway en el HTML al vuelo
  // — desde aquí no se puede: casi todas las pantallas son estáticas y Next las
  // prerenderiza al compilar, cuando estas variables ni existen.
  NODO_LOCAL: "1",
  NODO_CLAVE_ANON: firmar("anon"),
  NODO_CLAVE_SERVICIO: firmar("service_role"),
  NODO_URL_NUBE: urlNube(),
  NODO_URL_INTERNA: "http://127.0.0.1:54321",   // las rutas de servidor hablan por loopback
  // El canje de terminales (/api/dispositivos/canjear|renovar) firma los tokens
  // de dispositivo con EL SECRETO DE ESTE NODO: así el gateway y media pueden
  // verificarlos con `verificar()` (F5) sin secretos compartidos entre bares.
  // Sin esto, la pantalla de emparejado decía "Falta DEVICE_JWT_SECRET".
  DEVICE_JWT_SECRET: secretoDelNodo(),
};

// ── Arrancar Next ────────────────────────────────────────────────────────────
//
// En el bar va el build `standalone`: un servidor autocontenido, sin node_modules. En
// desarrollo puede no existir, y entonces se tira del Next de siempre.
const standalone = path.join(WEB, ".next", "standalone", "apps", "web", "server.js");
const hayStandalone = fs.existsSync(standalone);

const proc = hayStandalone
  ? spawn(process.execPath, [standalone], { cwd: path.dirname(standalone), env: entorno, stdio: "inherit" })
  : spawn("npx", ["next", "start", "-p", String(PUERTO), "-H", "127.0.0.1"], {
      cwd: WEB, env: entorno, stdio: "inherit", shell: true,
    });

console.log(
  `web: sirviendo la interfaz en http://127.0.0.1:${PUERTO} ` +
  `(${hayStandalone ? "standalone" : "next start"})`,
);

// Si Next se cae, este proceso se cae con él: el vigilante lo relevanta. Un servidor que
// sigue "vivo" con la web muerta es lo peor — los TPV verían una página en blanco y nadie
// sabría por qué.
proc.on("exit", (codigo) => {
  console.error(`web: Next ha terminado (código ${codigo})`);
  process.exit(codigo ?? 1);
});
