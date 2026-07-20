// Puerta de entrada del NODO LOCAL — el "Kong" de andar por casa.
//
// POR QUÉ EXISTE: `supabase-js` recibe UNA sola URL y de ahí deriva todo:
//   `${url}/auth/v1/…`  `${url}/rest/v1/…`  `${url}/realtime/v1/…`  `${url}/storage/v1/…`
// No se le pueden dar puertos distintos por servicio. Pero en el nodo, GoTrue y
// PostgREST son dos procesos en dos puertos. Sin esta pieza, el TPV no puede hablar
// con el nodo sin tocar sus 617 llamadas.
//
// Así que hacemos lo mismo que Supabase (que usa Kong): un único puerto que reparte.
// Sin dependencias: sólo `node:http`. Cuanto menos haya aquí, menos hay que mantener
// dentro de un servicio de Windows que no puede caerse.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { estado } from "./estado.mjs";
import { firmar, verificar, urlNube } from "./secreto.mjs";

const PUERTO = Number(process.env.NODO_PUERTO ?? 54321);
const RAIZ = path.resolve(".");

// ── ¿La petición viene del PROPIO ordenador del servidor? ────────────────────
//
// Reiniciar el nodo o buscar actualizaciones son cosas que hace el técnico o el dueño
// DELANTE del mini-PC (por el acceso directo del escritorio, que abre localhost). NO desde
// un TPV de la barra: un camarero no reinicia el servidor a mitad de servicio, ni por error
// ni por gracia. Así que estas acciones sólo se aceptan desde 127.0.0.1.
function esLocal(req) {
  const ip = req.socket.remoteAddress ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

// Lanza un script del nodo y SE DESENTIENDE (`detached` + `unref`): la acción devuelve
// "recibido" al instante y el trabajo sigue aunque se cierre el navegador. Un reinicio que
// dependiera de que la pestaña siga abierta sería un reinicio que a veces no pasa.
function lanzarSuelto(comando, args) {
  const hijo = spawn(comando, args, {
    cwd: RAIZ,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  hijo.unref();
}

const ACCIONES = {
  // Relanza lo que esté caído. NO para nada primero: parar incluye a este mismo gateway, y
  // se cortaría la respuesta a media frase. Esto sólo levanta lo que falte.
  reiniciar: () => lanzarSuelto("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", path.join(RAIZ, "supabase", "nodo", "arrancar-nodo.ps1"),
  ]),
  // Mira si hay versión nueva y, si la hay, se actualiza (con copia de seguridad y vuelta
  // atrás si algo sale mal: eso ya lo hace actualizar.mjs).
  actualizar: () => lanzarSuelto(process.execPath, [path.join(RAIZ, "apps", "nodo", "actualizar.mjs")]),
};

// A dónde va cada prefijo. El prefijo se QUITA antes de reenviar: PostgREST espera
// /category, no /rest/v1/category.
const RUTAS = [
  { prefijo: "/rest/v1", destino: { host: "127.0.0.1", port: 55433 } },
  // :55434 ya no es GoTrue: es NUESTRO firmador de tokens (apps/nodo/auth.mjs). El
  // prefijo NO se quita aquí — auth.mjs lo espera, porque `supabase-js` habla de
  // /auth/v1/token y de /auth/v1/user.
  { prefijo: "/auth/v1", destino: { host: "127.0.0.1", port: 55434 }, conservarPrefijo: true },
  { prefijo: "/realtime/v1", destino: { host: "127.0.0.1", port: 55435 }, flujo: true },
  { prefijo: "/storage/v1", destino: { host: "127.0.0.1", port: 55436 } },
];

// El RESTO de peticiones son la web: el nodo la sirve él mismo (Next, en el 3100).
//
// Que la web y los datos salgan del MISMO ORIGEN es lo que hace que un TPV no tenga NADA
// que configurar: abre `http://<ip-del-nodo>:54321` y ya. Antes había que poner cuatro
// variables en un `.env.local` en cada máquina, y equivocarse en una —poner la clave de
// la nube donde va la del nodo— dejaba a los camareros fuera sin decir por qué.
const WEB = { host: "127.0.0.1", port: Number(process.env.NODO_WEB_PUERTO ?? 3100) };

// ─────────────────────────────────────────────────────────────────────────────
//  LA CONFIGURACIÓN DEL BAR, INYECTADA EN EL HTML AL VUELO
//
//  Primero lo intenté en el `layout.tsx` de Next: leer la variable en el servidor y meter
//  el `<script>`. Limpio y evidente… y NO FUNCIONA. Casi todas las pantallas (incluido
//  `/tpv`) son ESTÁTICAS: Next las prerenderiza **al compilar**, cuando esa variable ni
//  existe. El script salía vacío y el TPV se quedaba sin configuración — sirviendo la web
//  perfectamente, y sin un error en ningún log.
//
//  Aquí sí: el gateway ve pasar cada respuesta y le mete el script en el `<head>`. Da
//  igual que la página sea estática o dinámica, y la web se compila UNA vez para todos
//  los bares.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG_DEL_BAR = {
  nodo: true,
  url: "",                       // vacío = el MISMO origen (nada que teclear en el TPV)
  clave: firmar("anon"),         // la clave pública de ESTE bar, derivada de su secreto
  urlNube: urlNube(),
};

// `JSON.stringify` del JSON: el navegador recibe una CADENA y la parsea. Así un valor con
// `</script>` dentro no puede cerrar la etiqueta e inyectar HTML.
const SCRIPT_CONFIG =
  `<script>window.__GLUUH__=JSON.parse(${JSON.stringify(JSON.stringify(CONFIG_DEL_BAR))})</script>`;

// ── ¿La petición trae un token firmado por ESTE nodo? (F5, plans/023) ────────
// Vale cualquier token del bar (los emite auth.mjs / firmar()): la barrera es
// "eres de esta instalación", no un rol concreto. Un portátil ajeno enchufado a
// la LAN no tiene ninguno.
function conTokenDelNodo(req) {
  const cab = req.headers.authorization ?? "";
  return verificar(cab.replace(/^Bearer\s+/i, "")) !== null;
}

/** La versión instalada, para el health público (sin tocar la BD). */
function versionNodo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, "apps", "nodo", "version.json"), "utf8")).version ?? "?";
  } catch { return "?"; }
}

const servidor = http.createServer(async (req, res) => {
  // Health MÍNIMO y público: vivo + versión. Es todo lo que un terminal necesita
  // para descubrir el nodo. Nada de recuentos ni de rutas de disco (F5).
  if (req.url.startsWith("/nodo/health")) {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ ok: true, nodo: true, version: versionNodo() }));
    return;
  }

  // El panel del servidor: qué hay levantado, qué lleva creado, cuánto ocupa.
  // DETALLADO ⇒ ya no es anónimo (F5, plans/023): o estás EN el servidor
  // (consola local / app de escritorio) o traes un token de esta instalación.
  // Una LAN comprometida no hace reconocimiento del nodo gratis.
  if (req.url.startsWith("/nodo/estado")) {
    if (!esLocal(req) && !conTokenDelNodo(req)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Identifícate: el estado detallado no es público. Usa /nodo/health para el latido." }));
      return;
    }
    try {
      const datos = await estado();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(datos));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Acciones del panel del servidor: reiniciar, buscar actualización. Sólo desde el propio
  // ordenador (el acceso directo del escritorio), nunca desde un TPV de la barra.
  // Además (F5): solo POST y con Origin propio — una web maliciosa abierta EN el
  // servidor no puede disparar un reinicio por CSRF (su Origin la delata).
  if (req.url.startsWith("/nodo/accion/")) {
    const que = req.url.split("/nodo/accion/")[1]?.split("?")[0];
    if (!esLocal(req)) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Sólo desde el ordenador del servidor." }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "content-type": "application/json", allow: "POST" });
      res.end(JSON.stringify({ error: "Las acciones van por POST." }));
      return;
    }
    const origen = req.headers.origin;
    const propio = !origen
      || origen.startsWith("http://localhost") || origen.startsWith("http://127.0.0.1")
      || origen === `http://${req.headers.host}`;
    if (!propio) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Origen no permitido." }));
      return;
    }
    const accion = ACCIONES[que];
    if (!accion) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "acción desconocida" }));
      return;
    }
    try { accion(); } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, accion: que }));
    return;
  }

  // La configuración de ESTE nodo. La app la lee al arrancar en vez de llevarla
  // incrustada al compilar — por eso una sola compilación vale para todos los bares.
  // (La app servida por el nodo la recibe ya inyectada en el HTML; esto es para quien
  // la necesite desde fuera: la app de escritorio, un diagnóstico, un técnico.)
  if (req.url.startsWith("/nodo/config")) {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(CONFIG_DEL_BAR));
    return;
  }

  // Lo que no es una API del nodo, es la WEB. La sirve el propio nodo (Next, en el 3100).
  const esWeb = !RUTAS.some((r) => req.url.startsWith(r.prefijo));
  const ruta = RUTAS.find((r) => req.url.startsWith(r.prefijo)) ?? { destino: WEB, conservarPrefijo: true, prefijo: "" };

  const cabeceras = { ...req.headers, host: `${ruta.destino.host}:${ruta.destino.port}` };

  // A la web se le pide SIN COMPRIMIR: si viniera en gzip no podríamos abrir el HTML para
  // meterle la configuración del bar. Es tráfico por la red local del local, no por
  // internet: comprimirlo no aporta nada y complicaría esto.
  if (esWeb) cabeceras["accept-encoding"] = "identity";

  const destino = http.request(
    {
      ...ruta.destino,
      method: req.method,
      // El prefijo se QUITA antes de reenviar (PostgREST espera /category, no
      // /rest/v1/category), salvo donde el destino lo espera entero.
      path: (ruta.conservarPrefijo ? req.url : req.url.slice(ruta.prefijo.length)) || "/",
      headers: cabeceras,
    },
    (r) => {
      // ── El HTML de la web: se le mete la configuración de ESTE bar ───────────
      const esHtml = (r.headers["content-type"] ?? "").includes("text/html");
      if (esWeb && esHtml) {
        const trozos = [];
        r.on("data", (t) => trozos.push(t));
        r.on("end", () => {
          const html = Buffer.concat(trozos).toString("utf8");
          // Antes de nada, para que `config()` lo tenga listo cuando arranque la app.
          const conConfig = html.includes("<head>")
            ? html.replace("<head>", `<head>${SCRIPT_CONFIG}`)
            : SCRIPT_CONFIG + html;

          const cab = { ...r.headers };
          // La longitud ha cambiado (y ya no hay compresión que declarar).
          delete cab["content-length"];
          delete cab["content-encoding"];
          res.writeHead(r.statusCode ?? 200, {
            ...cab,
            "content-length": Buffer.byteLength(conConfig),
          });
          res.end(conConfig);
        });
        return;
      }

      res.writeHead(r.statusCode ?? 502, r.headers);
      // El realtime es un flujo que no termina (SSE): hay que soltar cada evento en
      // cuanto llega. Sin esto, Node agrupa la salida y el aviso de una comanda podría
      // quedarse en el búfer hasta que llegara el siguiente — que es no tener realtime.
      if (ruta.flujo) {
        res.flushHeaders();
        r.on("data", (trozo) => res.write(trozo));
        r.on("end", () => res.end());
        return;
      }
      r.pipe(res);
    },
  );

  // Si un servicio del nodo se cae, el TPV debe enterarse — no quedarse colgado.
  destino.on("error", (e) => {
    // OJO: si las cabeceras YA SE ENVIARON, `writeHead` lanza ERR_HTTP_HEADERS_SENT.
    // Y al lanzarse DENTRO de un manejador de eventos, nadie la recoge: excepción no
    // capturada → **se cae el gateway entero**, y con él se queda sin nodo TODO el bar.
    //
    // Pasa de verdad y es fácil: el realtime (SSE) es un flujo largo; basta con que se
    // corte a mitad —el servicio se reinicia, se va la wifi un segundo— para que este
    // manejador salte con la respuesta ya empezada. Un hipo de un servicio tiraba el
    // proxy de todos.
    //
    // Con la respuesta ya empezada no se puede mandar un 502: sólo cortar limpiamente.
    if (res.headersSent) {
      console.error(`[gateway] ${ruta.prefijo} se cortó a mitad de la respuesta: ${e.message}`);
      res.destroy();
      return;
    }
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Servicio del nodo caído (${ruta.prefijo}): ${e.message}` }));
  });

  req.pipe(destino);
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  // 0.0.0.0: los demás TPV de la barra entran por la IP del nodo, no por localhost.
  console.log(`Nodo escuchando en http://0.0.0.0:${PUERTO}`);
  for (const r of RUTAS) console.log(`  ${r.prefijo}\t→ :${r.destino.port}`);
});
