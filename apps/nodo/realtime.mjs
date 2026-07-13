// REALTIME DEL NODO — el comandero pica en una mesa y sale en todos los TPV.
//
// El Realtime de Supabase está escrito en Elixir y no corre nativo en Windows, así que
// el nodo trae el suyo con lo que Postgres ya tiene: LISTEN/NOTIFY.
//
// POR QUÉ SSE Y NO WEBSOCKET:
//   · El flujo es de UNA sola dirección: el nodo avisa, el TPV escucha. Un WebSocket
//     (bidireccional, con su handshake y sus frames) es pagar por lo que no se usa.
//   · `EventSource` **se reconecta solo**. En una barra se va el wifi, se reinicia el
//     router, se suspende la tablet… y el TPV tiene que volver solo, sin que nadie mire.
//     Con WebSocket habría que escribir a mano ese bucle de reconexión — justo el código
//     que falla a las tres de la mañana de un sábado.
//   · Viaja por HTTP normal: pasa por el mismo gateway, sin tratos especiales.
//
// Escucha UN canal de Postgres (`gluuh_cambios`) y lo reparte a todos los TPV conectados.

import http from "node:http";
import pg from "pg";

const PUERTO = Number(process.env.NODO_REALTIME_PUERTO ?? 55435);
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

/** Los TPV conectados ahora mismo. */
const clientes = new Set();

// ── Postgres: escuchar los avisos ────────────────────────────────────────────
const escucha = new pg.Client({ connectionString: BD });

escucha.on("notification", (msg) => {
  if (msg.channel !== "gluuh_cambios" || !msg.payload) return;
  const dato = `data: ${msg.payload}\n\n`;
  for (const res of clientes) res.write(dato);
});

// Si se cae la conexión con Postgres, el realtime queda MUDO sin decir nada: los TPV
// seguirían "conectados" y nunca verían una comanda. Preferimos morir y que el servicio
// nos levante otra vez.
escucha.on("error", (e) => {
  console.error("realtime: se perdió Postgres —", e.message);
  process.exit(1);
});

await escucha.connect();
await escucha.query("listen gluuh_cambios");
console.log("realtime: escuchando cambios de Postgres");

// ── HTTP: el canal SSE ───────────────────────────────────────────────────────
const servidor = http.createServer((req, res) => {
  if (!req.url.startsWith("/cambios")) {
    res.writeHead(404).end();
    return;
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    // Sin esto, un proxy por medio se guarda los eventos en un búfer y los suelta
    // todos juntos más tarde: el TPV se enteraría de la comanda cuando ya no importa.
    "x-accel-buffering": "no",
  });
  res.write(": conectado\n\n");

  clientes.add(res);
  req.on("close", () => clientes.delete(res));
});

// Latido: si no viaja nada durante minutos (un bar tranquilo a las 5 de la tarde),
// algún router corta la conexión por inactividad. Dos puntos cada 25 s la mantienen viva.
setInterval(() => {
  for (const res of clientes) res.write(": latido\n\n");
}, 25_000).unref();

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`realtime: SSE en http://127.0.0.1:${PUERTO}/cambios`);
});
