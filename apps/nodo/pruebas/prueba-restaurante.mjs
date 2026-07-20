// UNA MESA DE RESTAURANTE, DE LA COMANDA A LA FACTURA — con carta REAL e IGIC.
//
// Las demás pruebas del nodo usan datos mínimos inventados (una "Caña" al 7 % a
// pelo). Esta usa el catálogo de verdad del «Restaurante de pruebas» (canario) y
// comprueba lo que de verdad se factura:
//
//   1. La comanda sale de la CARTA (product_id real), no de nombres sueltos.
//   2. Cada línea hereda el impuesto DEL PRODUCTO — IGIC 7 % / 3 %, no IVA 21/10.
//   3. La comanda se reparte por ESTACIÓN (lo de cocina a cocina, lo de barra a barra).
//   4. La factura cuadra: base + cuota = total, y el desglose coincide con las líneas.
//   5. La huella encadena con la anterior.
//   6. Dividir la cuenta en dos partes suma exactamente el total (sin perder céntimos).
//
//   node apps/nodo/pruebas/prueba-restaurante.mjs
import { NODO, conectar, conSesion, ANON, noConcluyente } from "./ayuda.mjs";

const RESTAURANTE = "Restaurante de pruebas";
const r2 = (n) => Math.round(n * 100) / 100;

let fallos = 0;
const ok = (b, txt) => { console.log(`  ${b ? "✓" : "✗"} ${txt}`); if (!b) fallos++; };

const bd = await conectar();

// ── El banco de pruebas tiene que existir ────────────────────────────────────
const { rows: [rest] } = await bd.query(
  "select id from public.tenant where nombre = $1", [RESTAURANTE]);
if (!rest) {
  await bd.end();
  noConcluyente(
    `no existe «${RESTAURANTE}» en este nodo`,
    'Créalo:  DIRECT_URL="postgres://postgres:gluuh@127.0.0.1:55432/gluuh" node scripts/sembrar-restaurante.mjs',
  );
}
const tid = rest.id;
const { rows: [loc] } = await bd.query(
  "select id, territorio_fiscal from public.location where tenant_id = $1 limit 1", [tid]);

// ── Sesión del titular (para poder pedir la factura al gateway) ──────────────
const { rows: [duenyo] } = await bd.query(
  "select email from public.app_user where tenant_id = $1 and rol = 'PROPIETARIO' limit 1", [tid]);
const CLAVE = "Prueba1234!";
await bd.query("select public.fijar_password_local($1, $2)", [duenyo.email, CLAVE]);
const rSesion = await fetch(`${NODO}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({ email: duenyo.email, password: CLAVE }),
});
if (!rSesion.ok) {
  await bd.end();
  noConcluyente(`el nodo no da sesión al titular (HTTP ${rSesion.status})`, "Revisa la auth del nodo.");
}
const cab = conSesion(await rSesion.json());

let orderId;
try {
  console.log(`\n═══ ${RESTAURANTE} · territorio ${loc.territorio_fiscal} ═══`);

  // ── La comanda: lo que pide de verdad una mesa de dos ──────────────────────
  const PEDIDO = [
    ["Caña", 2],
    ["Paella valenciana (mín. 2)", 1],
    ["Botella Rioja crianza", 1],
    ["Café solo", 2],
    ["Tarta de queso", 1],
  ];

  console.log("\n1. Se abre la mesa 7 y se comanda de la carta");
  const { rows: [orden] } = await bd.query(
    `insert into public.sales_order (tenant_id, location_id, canal, estado, total, client_id)
     values ($1,$2,'TPV','ABIERTA',0, gen_random_uuid()) returning id`, [tid, loc.id]);
  orderId = orden.id;

  const lineas = [];
  for (const [nombre, uds] of PEDIDO) {
    const { rows: [p] } = await bd.query(
      "select id, nombre, precio, tipo_impositivo, clase_fiscal, estacion from public.product where tenant_id=$1 and nombre=$2",
      [tid, nombre]);
    if (!p) { ok(false, `la carta no tiene «${nombre}»`); continue; }
    // La línea copia el impuesto DEL PRODUCTO: es lo que hace el TPV al comandar.
    await bd.query(
      `insert into public.order_line (tenant_id, order_id, product_id, nombre, cantidad, precio_unitario, tipo_impositivo, estacion)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [tid, orderId, p.id, p.nombre, uds, p.precio, p.tipo_impositivo, p.estacion]);
    lineas.push({ ...p, uds, importe: r2(uds * Number(p.precio)) });
  }
  const total = r2(lineas.reduce((s, l) => s + l.importe, 0));
  await bd.query("update public.sales_order set total=$2, estado='COBRADA' where id=$1", [orderId, total]);
  console.log(`   ${lineas.length} líneas · total ${total.toFixed(2)} €`);
  ok(lineas.length === PEDIDO.length, "todas las líneas salen de la carta (product_id real)");
  ok(lineas.every((l) => l.id), "cada línea apunta a su producto");

  // ── 2. El impuesto es el del territorio, no uno inventado ─────────────────
  console.log("\n2. El impuesto de cada línea es el IGIC de su clase");
  const esperado = { GENERAL: 7, REDUCIDO: 3 };
  for (const l of lineas) {
    ok(Number(l.tipo_impositivo) === esperado[l.clase_fiscal],
      `${l.nombre}: ${l.clase_fiscal} → ${Number(l.tipo_impositivo)} % (IGIC)`);
  }

  // ── 3. La comanda se reparte por estación ─────────────────────────────────
  console.log("\n3. La comanda se reparte por estación");
  const { rows: porEstacion } = await bd.query(
    "select estacion, count(*)::int n from public.order_line where order_id=$1 group by estacion order by estacion", [orderId]);
  for (const e of porEstacion) console.log(`   ${e.estacion}: ${e.n} líneas`);
  ok(porEstacion.length >= 2, "hay comanda para más de una estación (cocina y barra)");
  ok(porEstacion.every((e) => e.estacion), "ninguna línea se queda sin estación (si no, no se imprime)");

  // ── 4. La factura ─────────────────────────────────────────────────────────
  console.log("\n4. Se cobra y se emite la factura");
  const resp = await fetch(`${NODO}/api/factura`, {
    method: "POST", headers: cab, body: JSON.stringify({ orderId }),
  }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }));
  if (!resp.ok) {
    ok(false, `la factura no se emite: ${String(resp.error).slice(0, 120)}`);
  } else {
    const { rows: [f] } = await bd.query(
      "select numero, num_serie_factura, base_total, cuota_total, importe_total, huella, huella_anterior, qr_url from public.invoice where order_id=$1", [orderId]);

    // Lo que DEBERÍA salir, calculado aparte: el precio lleva el impuesto dentro,
    // así que la base se saca "hacia atrás" (base = importe / (1 + %/100)).
    const baseEsp = r2(lineas.reduce((s, l) => s + l.importe / (1 + Number(l.tipo_impositivo) / 100), 0));
    const cuotaEsp = r2(total - baseEsp);

    console.log(`   ${f.num_serie_factura ?? f.numero} · base ${f.base_total} + cuota ${f.cuota_total} = ${f.importe_total} €`);
    ok(Number(f.importe_total) === total, `el total facturado es el de la mesa (${total.toFixed(2)} €)`);
    ok(Math.abs(Number(f.base_total) - baseEsp) <= 0.02, `la base cuadra con el desglose hacia atrás (${baseEsp.toFixed(2)} €)`);
    ok(Math.abs(Number(f.cuota_total) - cuotaEsp) <= 0.02, `la cuota de IGIC cuadra (${cuotaEsp.toFixed(2)} €)`);
    ok(r2(Number(f.base_total) + Number(f.cuota_total)) === Number(f.importe_total), "base + cuota = total (sin céntimos perdidos)");
    ok(!!f.huella, "la factura lleva huella");
    ok(!!f.qr_url, "y su QR");

    // ── 5. La cadena ────────────────────────────────────────────────────────
    console.log("\n5. La huella encadena");
    const { rows: previas } = await bd.query(
      "select numero, huella, huella_anterior from public.invoice where tenant_id=$1 order by numero", [tid]);
    if (previas.length > 1) {
      const ult = previas.at(-1), pen = previas.at(-2);
      ok(ult.huella_anterior === pen.huella, `la ${ult.numero} cuelga de la ${pen.numero}`);
    } else {
      ok(previas.length === 1, "es la primera factura del restaurante (no hay anterior de la que colgar)");
    }
    ok(new Set(previas.map((p) => p.huella)).size === previas.length, "ninguna huella repetida");
  }

  // ── 6. Dividir la cuenta ──────────────────────────────────────────────────
  console.log("\n6. La cuenta se divide en dos sin perder céntimos");
  await bd.query("delete from public.cuenta_parte where order_id=$1", [orderId]);
  // Reparto en CÉNTIMOS: el último se lleva el resto (si no, 0,01 € se evapora).
  const totalC = Math.round(total * 100), mitadC = Math.floor(totalC / 2);
  const partes = [mitadC / 100, (totalC - mitadC) / 100];
  for (const [i, importe] of partes.entries()) {
    await bd.query(
      `insert into public.cuenta_parte (tenant_id, order_id, indice, tipo, importe, cobrada)
       values ($1,$2,$3,'IGUAL',$4,false)`, [tid, orderId, i + 1, importe]);
  }
  const { rows: [suma] } = await bd.query(
    "select coalesce(sum(importe),0) s, count(*)::int n from public.cuenta_parte where order_id=$1", [orderId]);
  console.log(`   ${partes.map((p) => p.toFixed(2) + " €").join(" + ")} = ${Number(suma.s).toFixed(2)} €`);
  ok(suma.n === 2, "quedan dos partes");
  ok(r2(Number(suma.s)) === total, "las partes suman EXACTAMENTE el total de la mesa");

  console.log("\n" + "═".repeat(64));
  console.log(fallos === 0
    ? "✅ TODO VERDE — una mesa canaria, de la comanda a la factura, con el IGIC bien."
    : `❌ ${fallos} FALLO(S)`);
  console.log("═".repeat(64));
} finally {
  // Limpieza: las partes del reparto sí se van, pero UNA FACTURA EMITIDA NO SE
  // BORRA — borrarla dejaría a la siguiente colgando de una huella inexistente y
  // rompería la cadena que esta misma prueba comprueba. Si hubo factura, la mesa
  // se queda (como en un bar de verdad); si no la hubo, se recoge todo.
  if (orderId) {
    await bd.query("delete from public.cuenta_parte where order_id=$1", [orderId]);
    const { rows: [f] } = await bd.query("select 1 x from public.invoice where order_id=$1", [orderId]);
    if (!f) {
      await bd.query("delete from public.order_line where order_id=$1", [orderId]);
      await bd.query("delete from public.sales_order where id=$1", [orderId]);
    }
  }
  await bd.end();
}

process.exit(fallos === 0 ? 0 : 1);
