// "Imaginate que en el comandero pico algo en una mesa y debe aparecer en todos los TPV."
//
// Esto es exactamente eso: un TPV escuchando, el comandero picando, y el aviso llegando.
// Sin internet: el nodo avisa con Postgres LISTEN/NOTIFY y lo reparte por SSE.
//
//   node apps/nodo/pruebas/prueba-realtime.mjs
import crypto from "node:crypto";
import { NODO, conectar, barDePrueba, borrarBar, conSesion } from "./ayuda.mjs";

const bd = await conectar();
let bar;

try {
  bar = await barDePrueba(bd, "Bar del Realtime");
  const cab = conSesion(bar.sesion);
  const rest = (ruta, opts = {}) => fetch(`${NODO}/rest/v1/${ruta}`, { headers: cab, ...opts });

  // ── TPV nº2: se queda escuchando (es lo que hace escucharCambios) ───────────
  const recibidos = [];
  const resp = await fetch(`${NODO}/realtime/v1/cambios`, { headers: { Accept: "text/event-stream" } });
  const lector = resp.body.getReader();
  const dec = new TextDecoder();

  (async () => {
    let resto = "";
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      resto += dec.decode(value, { stream: true });
      const lineas = resto.split("\n");
      resto = lineas.pop();
      for (const l of lineas) if (l.startsWith("data: ")) recibidos.push(JSON.parse(l.slice(6)));
    }
  })();

  await new Promise((r) => setTimeout(r, 400));
  console.log("TPV nº2: escuchando…\n");

  // ── El comandero pica ──────────────────────────────────────────────────────
  console.log("COMANDERO: abre la mesa 5 y pica una caña");

  const crear = async (tabla, fila) => {
    const r = await rest(tabla, { method: "POST", headers: { ...cab, Prefer: "return=representation" }, body: JSON.stringify(fila) });
    if (!r.ok) throw new Error(`${tabla}: ${await r.text()}`);
    return (await r.json())[0];
  };

  const sala = await crear("room", { nombre: "Salon", location_id: bar.locationId });
  const mesa = await crear("restaurant_table", { nombre: "Mesa 5", room_id: sala.id });
  const pedido = await crear("sales_order", {
    table_id: mesa.id, location_id: bar.locationId, estado: "ABIERTA", total: 0,
    client_id: crypto.randomUUID(),
  });
  await crear("order_line", {
    order_id: pedido.id, nombre: "Cana", cantidad: 1, precio_unitario: 2.5, tipo_impositivo: 7,
  });

  await new Promise((r) => setTimeout(r, 900));   // que el aviso viaje

  console.log("\n── lo que ha VISTO el TPV nº2, sin preguntar a nadie ──");
  for (const c of recibidos) {
    const desc = c.fila?.nombre ?? c.fila?.estado ?? "";
    console.log(`  ${c.evento.padEnd(6)} ${c.tabla.padEnd(18)} ${desc}`);
  }

  const tablas = new Set(recibidos.map((c) => c.tabla));
  const bien = ["restaurant_table", "sales_order", "order_line"].every((t) => tablas.has(t));

  console.log("\n" + "═".repeat(64));
  console.log(bien
    ? "✅ El TPV nº2 se enteró de la mesa, del pedido y de la línea. SIN INTERNET."
    : "❌ No llegaron todos los avisos.");
  console.log("═".repeat(64));
  process.exitCode = bien ? 0 : 1;
} finally {
  if (bar) await borrarBar(bd, bar.tenantId);
  await bd.end();
  process.exit(process.exitCode ?? 0);   // el SSE deja el proceso vivo
}
