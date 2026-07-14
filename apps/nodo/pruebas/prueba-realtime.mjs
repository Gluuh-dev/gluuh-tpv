// "Imaginate que en el comandero pico algo en una mesa y debe aparecer en todos los TPV."
// Esto es exactamente eso: un TPV escuchando, el comandero picando, y el aviso llegando.
import { createHmac } from "node:crypto";

const URL = "http://127.0.0.1:54321";
const SECRETO = "clave-jwt-de-desarrollo-del-nodo-gluuh-min-32-chars";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ahora = Math.floor(Date.now() / 1000);
const cab = b64({ alg: "HS256", typ: "JWT" });
const cue = b64({ role: "anon", iss: "gluuh-nodo", iat: ahora, exp: ahora + 3600 });
const ANON = `${cab}.${cue}.${createHmac("sha256", SECRETO).update(`${cab}.${cue}`).digest("base64url")}`;

const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(URL, ANON, { auth: { persistSession: false } });

// Un bar con su mesa
const email = `rt${Math.floor(Math.random() * 999999)}@prueba.local`;
await sb.auth.signUp({
  email, password: "Prueba1234!",
  options: { data: { empresa_nombre: "Bar del Realtime" } },
});

// ── TPV nº 2: se queda escuchando (esto es lo que hace escucharCambios) ──────
const recibidos = [];
const resp = await fetch(`${URL}/realtime/v1/cambios`, { headers: { Accept: "text/event-stream" } });
const lector = resp.body.getReader();
const dec = new TextDecoder();

(async () => {
  let resto = "";
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const lineas = resto.split("\n");
    resto = lineas.pop();
    for (const l of lineas) {
      if (l.startsWith("data: ")) recibidos.push(JSON.parse(l.slice(6)));
    }
  }
})();

await new Promise((r) => setTimeout(r, 400));
console.log("TPV nº2: escuchando…\n");

// ── El comandero pica ────────────────────────────────────────────────────────
console.log("COMANDERO: abre la mesa 5 y pica una caña");
const paso = async (que, p) => {
  const { data, error } = await p;
  if (error) { console.error(`  fallo en ${que}: ${error.message}`); process.exit(1); }
  return data;
};

// El local ya lo creo el alta (trigger handle_new_user, migracion 0078).
const local = await paso("local", sb.from("location").select("id").limit(1).single());
const sala = await paso("sala", sb.from("room").insert({ nombre: "Salon", location_id: local.id }).select().single());
const mesa = await paso("mesa", sb.from("restaurant_table").insert({ nombre: "Mesa 5", room_id: sala.id }).select().single());
const pedido = await paso("pedido", sb.from("sales_order").insert({ table_id: mesa.id, location_id: local.id, estado: "ABIERTA", total: 0, client_id: crypto.randomUUID() }).select().single());
await paso("linea", sb.from("order_line").insert({ order_id: pedido.id, nombre: "Cana", cantidad: 1, precio_unitario: 2.5, tipo_impositivo: 7 }).select().single());

// Dar tiempo a que el aviso viaje
await new Promise((r) => setTimeout(r, 900));

console.log("\n── lo que ha VISTO el TPV nº2, sin preguntar a nadie ──");
for (const c of recibidos) {
  const desc = c.fila?.nombre ?? c.fila?.estado ?? c.fila?.id?.slice(0, 8);
  console.log(`  ${c.evento.padEnd(6)} ${c.tabla.padEnd(18)} ${desc ?? ""}`);
}

const tablas = new Set(recibidos.map((c) => c.tabla));
const ok = tablas.has("restaurant_table") && tablas.has("sales_order") && tablas.has("order_line");
console.log(ok
  ? "\n✅ El TPV nº2 se enteró de la mesa, del pedido y de la línea. SIN INTERNET."
  : "\n❌ No llegaron todos los avisos.");
process.exit(ok ? 0 : 1);
