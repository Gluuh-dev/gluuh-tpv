// DOS CAMAREROS, LA MISMA MESA, A LA VEZ.
//
// El viernes a las 22:00, la mesa 5:
//
//   Ana la abre en el TPV de la barra.   Ve 2 cañas.
//   Berto la abre en el comandero.       Ve 2 cañas.
//   Ana añade una TORTILLA y guarda.
//   Berto añade un VINO y guarda.
//
// Hasta la migración 0102, Berto mandaba SU foto de la mesa (2 cañas + vino) y **la
// tortilla desaparecía**. Sin un error, sin un aviso. El cliente se la comía, no la pagaba,
// y el arqueo de la noche no cuadraba por 8 €. Nadie sabría nunca por qué.
//
// Esto comprueba las tres cosas:
//
//   1. Que el guardado de Berto SE RECHAZA (código GLU01), en vez de pisar a Ana.
//   2. Que la tortilla SIGUE AHÍ.
//   3. Que cuando Berto recarga, ve la mesa de verdad y ya puede guardar.
//
// Y la 4, que es la que separa esto de un candado tonto: dos guardados del MISMO camarero,
// uno detrás de otro, tienen que ir los dos. Si el TPV chocara consigo mismo, el bar no
// podría cobrar.
//
//   node apps/nodo/pruebas/prueba-dos-camareros.mjs

import pg from "pg";
import { NODO, conectar, barDePrueba, borrarBar, conSesion } from "./ayuda.mjs";

pg.types.setTypeParser(1184, (v) => v);

let fallos = 0;
const ok = (b, txt) => { console.log(`  ${b ? "✓" : "✗"} ${txt}`); if (!b) fallos++; };

const bd = await conectar();
const bar = await barDePrueba(bd, "Bar de los dos camareros");
const cab = conSesion(bar.sesion);

// El TPV llama al RPC por HTTP, como en el bar de verdad — no por SQL. Así se prueba
// también que PostgREST propaga el código de error (si no, el TPV no sabría distinguir un
// choque de un fallo de red, y reintentaría… volviendo a pisar).
const guardar = async (orderId, lineas, version) => {
  const r = await fetch(`${NODO}/rest/v1/rpc/guardar_cuenta`, {
    method: "POST",
    headers: cab,
    body: JSON.stringify({
      p_order_id: orderId,
      p_lineas: lineas,
      p_cuenta: { estado: "ABIERTA", total: lineas.reduce((n, l) => n + l.precio_unitario * l.cantidad, 0) },
      p_version: version,
    }),
  });
  const cuerpo = await r.json();
  return r.ok ? { version: cuerpo } : { error: cuerpo };
};

const linea = (nombre, precio) => ({
  product_id: null, nombre, cantidad: 1, precio_unitario: precio,
  tipo_impositivo: 7, notas: null, estacion: null, user_id: null,
  modificadores: { key: nombre }, pase: null,
});

const lineasDe = (orderId) =>
  bd.query("select nombre from public.order_line where order_id = $1 order by nombre", [orderId])
    .then(({ rows }) => rows.map((r) => r.nombre));

try {
  // ── La mesa, con sus dos cañas ────────────────────────────────────────────
  const { rows: [orden] } = await bd.query(
    `insert into public.sales_order (tenant_id, location_id, canal, estado, total, client_id)
          values ($1, $2, 'TPV', 'ABIERTA', 3.00, gen_random_uuid())
       returning id, updated_at`,
    [bar.tenantId, bar.locationId],
  );
  const CANAS = [linea("Caña", 1.5), linea("Caña", 1.5)];
  await guardar(orden.id, CANAS, null);

  // Los dos abren la mesa. Los dos se llevan LA MISMA versión.
  const { rows: [v0] } = await bd.query(
    "select updated_at from public.sales_order where id = $1", [orden.id],
  );
  const versionDeAna = v0.updated_at;
  const versionDeBerto = v0.updated_at;
  console.log(`\nLa mesa 5 tiene ${(await lineasDe(orden.id)).length} cañas. Ana y Berto la abren los dos.\n`);

  // ── 1. Ana añade una tortilla ─────────────────────────────────────────────
  console.log("1. Ana añade una TORTILLA y guarda");
  const deAna = await guardar(orden.id, [...CANAS, linea("Tortilla", 8)], versionDeAna);
  ok(!deAna.error, "el guardado de Ana entra");
  ok((await lineasDe(orden.id)).includes("Tortilla"), "la tortilla está en la mesa");

  // ── 2. Berto guarda con SU foto, que ya es vieja ───────────────────────────
  console.log("\n2. Berto añade un VINO y guarda — pero su foto de la mesa ya es vieja");
  const deBerto = await guardar(orden.id, [...CANAS, linea("Vino", 3)], versionDeBerto);

  ok(deBerto.error?.code === "GLU01",
     `se RECHAZA con GLU01 (llegó: ${deBerto.error?.code ?? "¡entró!"})`);

  const despues = await lineasDe(orden.id);
  ok(despues.includes("Tortilla"), "★ LA TORTILLA SIGUE AHÍ (antes desaparecía)");
  ok(!despues.includes("Vino"), "y el vino de Berto NO se ha colado a medias");

  // ── 3. Berto recarga y ahora sí ───────────────────────────────────────────
  console.log("\n3. Berto recarga la mesa y vuelve a guardar");
  const { rows: [v1] } = await bd.query(
    "select updated_at from public.sales_order where id = $1", [orden.id],
  );
  const otra = await guardar(orden.id, [...CANAS, linea("Tortilla", 8), linea("Vino", 3)], v1.updated_at);
  ok(!otra.error, "ahora su guardado entra");

  const final = await lineasDe(orden.id);
  ok(final.includes("Tortilla") && final.includes("Vino"),
     `y la mesa tiene las dos cosas: ${final.join(", ")}`);

  // ── 4. Y un TPV no puede chocar CONSIGO MISMO ─────────────────────────────
  //
  // Si guardar dos veces seguidas desde el mismo TPV diera conflicto, el bar no podría
  // cobrar: el camarero pica, envía a cocina, y al ir a cobrar el TPV le diría que otro ha
  // tocado la mesa. Sería un candado que no deja trabajar a nadie.
  console.log("\n4. Y el mismo camarero puede guardar dos veces seguidas");
  const uno = await guardar(orden.id, [linea("Café", 1.2)], otra.version);
  const dos = await guardar(orden.id, [linea("Café", 1.2), linea("Copa", 6)], uno.version);
  ok(!uno.error && !dos.error, "los dos guardados entran (la versión que devuelve el RPC sirve)");

  console.log(fallos === 0
    ? "\nDos camareros ya no se pisan. Y uno solo puede seguir trabajando.\n"
    : `\n${fallos} fallo(s).\n`);
} finally {
  await borrarBar(bd, bar.tenantId);
  await bd.end();
}

process.exit(fallos === 0 ? 0 : 1);
