// SEIS COBROS A LA VEZ. ¿SE ROMPE LA CADENA DE VERIFACTU?
//
// El sábado a las 21:40 hay cuatro TPV cobrando a la vez. Los cuatro piden número de
// factura. Los cuatro leen «la última es la 99» y los cuatro van a por la 100.
//
// Lo que NO puede pasar, en orden de gravedad:
//
//   1. Dos facturas con el MISMO NÚMERO. Es un delito contable, no un bug.
//   2. Que la CADENA DE HUELLAS SE BIFURQUE: dos facturas distintas encadenadas sobre la
//      misma anterior. VERIFACTU es una cadena; si se abre en dos, la AEAT rechaza el
//      envío y el bar no puede declarar. Y no se arregla luego: hay que anularlo todo.
//   3. Que un cobro FALLE en la cara del camarero, con el cliente delante.
//
// Contra 1 está la base de datos: `UNIQUE (tenant_id, serie, numero)`. Esa restricción es
// LA garantía, y por eso no se toca.
//
// Contra 2 y 3 está `/api/factura`: el que choca **vuelve a leer** —ve la factura que
// acaba de entrar, con su huella— y encadena la suya DETRÁS. Antes reintentaba una sola
// vez; con cuatro TPV a la vez, eso no basta.
//
// Esto lo dispara todo A LA VEZ, de verdad (Promise.all contra el nodo), y luego mira la
// cadena eslabón a eslabón.
//
//   node apps/nodo/pruebas/prueba-facturas-a-la-vez.mjs

import { NODO, conectar, barDePrueba, borrarBar, conSesion } from "./ayuda.mjs";

const CUANTAS = 6;

let fallos = 0;
const ok = (b, txt) => { console.log(`  ${b ? "✓" : "✗"} ${txt}`); if (!b) fallos++; };

const bd = await conectar();
const bar = await barDePrueba(bd, "Bar del sábado a las 21:40");
const cab = conSesion(bar.sesion);

try {
  // ── Seis cuentas listas para cobrar, cada una con su caña ─────────────────
  const ordenes = [];
  for (let i = 0; i < CUANTAS; i++) {
    const { rows: [o] } = await bd.query(
      `insert into public.sales_order (tenant_id, location_id, canal, estado, total, client_id)
            values ($1, $2, 'TPV', 'COBRADA', 2.00, gen_random_uuid()) returning id`,
      [bar.tenantId, bar.locationId],
    );
    await bd.query(
      `insert into public.order_line (tenant_id, order_id, nombre, cantidad, precio_unitario, tipo_impositivo)
            values ($1, $2, $3, 1, 2.00, 7)`,
      [bar.tenantId, o.id, `Caña ${i + 1}`],
    );
    ordenes.push(o.id);
  }

  console.log(`\n${CUANTAS} camareros le dan a COBRAR en el mismo instante…\n`);

  // ── Y TODOS A LA VEZ ──────────────────────────────────────────────────────
  // `Promise.all` sin await entre medias: las seis peticiones salen juntas y compiten por
  // el mismo número. Si se lanzaran en fila, no habría carrera y esto no probaría nada.
  const respuestas = await Promise.all(ordenes.map((orderId) =>
    fetch(`${NODO}/api/factura`, {
      method: "POST",
      headers: cab,
      body: JSON.stringify({ orderId }),
    }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message })),
  ));

  const buenas = respuestas.filter((r) => r.ok);
  ok(buenas.length === CUANTAS,
     `las ${CUANTAS} facturas se emiten (${buenas.length}/${CUANTAS}) — ningún cobro falla`);
  for (const mala of respuestas.filter((r) => !r.ok)) {
    console.log(`      falló: ${String(mala.error).slice(0, 90)}`);
  }

  // ── ¿Qué ha quedado en la base? ───────────────────────────────────────────
  const { rows: facturas } = await bd.query(
    `select numero, num_serie_factura, huella, huella_anterior
       from public.invoice where tenant_id = $1 order by numero`,
    [bar.tenantId],
  );

  console.log("");
  for (const f of facturas) {
    console.log(`  ${String(f.numero).padStart(3)}  ${f.num_serie_factura.padEnd(14)} ` +
                `${f.huella.slice(0, 12)}…  ←  ${(f.huella_anterior ?? "(primera)").slice(0, 12)}`);
  }
  console.log("");

  // 1 · Los números, correlativos y sin repetir.
  // `Number(...)`: `invoice.numero` es un entero grande y el driver lo da como TEXTO (para
  // no perder precisión). Sin convertirlo, se comparan "1" con 1 y no cuadra nunca.
  const numeros = facturas.map((f) => Number(f.numero));
  const esperados = Array.from({ length: facturas.length }, (_, i) => i + 1);
  ok(JSON.stringify(numeros) === JSON.stringify(esperados),
     `numeración correlativa y sin huecos: ${numeros.join(", ")}`);
  ok(new Set(numeros).size === numeros.length, "ningún número repetido");

  // 2 · ★ LA CADENA. Cada factura tiene que colgar EXACTAMENTE de la anterior.
  let cadenaOk = true;
  for (let i = 0; i < facturas.length; i++) {
    const esperada = i === 0 ? null : facturas[i - 1].huella;
    const tiene = facturas[i].huella_anterior || null;
    if (tiene !== esperada) {
      cadenaOk = false;
      console.log(`      la ${facturas[i].numero} cuelga de ${String(tiene).slice(0, 12)} ` +
                  `y debería colgar de ${String(esperada).slice(0, 12)}`);
    }
  }
  ok(cadenaOk, "★ la cadena de huellas NO SE BIFURCA: cada una cuelga de la anterior");

  // 3 · Y ninguna huella repetida (dos facturas idénticas encadenadas igual).
  const huellas = facturas.map((f) => f.huella);
  ok(new Set(huellas).size === huellas.length, "ninguna huella repetida");

  console.log(fallos === 0
    ? "\nSeis cobros simultáneos: seis facturas, correlativas, en una sola cadena.\nLa AEAT puede recibir esto.\n"
    : `\n${fallos} fallo(s). ESTO NO SE PUEDE ENVIAR A HACIENDA.\n`);
} finally {
  await borrarBar(bd, bar.tenantId);
  await bd.end();
}

process.exit(fallos === 0 ? 0 : 1);
