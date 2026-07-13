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
import { estado } from "./estado.mjs";

const PUERTO = Number(process.env.NODO_PUERTO ?? 54321);

// A dónde va cada prefijo. El prefijo se QUITA antes de reenviar: PostgREST espera
// /category, no /rest/v1/category.
const RUTAS = [
  { prefijo: "/rest/v1", destino: { host: "127.0.0.1", port: 55433 } },
  { prefijo: "/auth/v1", destino: { host: "127.0.0.1", port: 55434 } },
  { prefijo: "/realtime/v1", destino: { host: "127.0.0.1", port: 55435 }, flujo: true },
  { prefijo: "/storage/v1", destino: { host: "127.0.0.1", port: 55436 } },
];

const servidor = http.createServer(async (req, res) => {
  // El panel del servidor: qué hay levantado, qué lleva creado, cuánto ocupa.
  if (req.url.startsWith("/nodo/estado")) {
    try {
      const datos = await estado();
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
      res.end(JSON.stringify(datos));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  const ruta = RUTAS.find((r) => req.url.startsWith(r.prefijo));

  if (!ruta) {
    // Un 501 explícito, no un 404: que se vea que es el nodo el que no sirve eso
    // todavía, y no que el dato no exista.
    res.writeHead(501, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `El nodo aún no sirve ${req.url}` }));
    return;
  }

  const destino = http.request(
    {
      ...ruta.destino,
      method: req.method,
      path: req.url.slice(ruta.prefijo.length) || "/",
      headers: { ...req.headers, host: `${ruta.destino.host}:${ruta.destino.port}` },
    },
    (r) => {
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
