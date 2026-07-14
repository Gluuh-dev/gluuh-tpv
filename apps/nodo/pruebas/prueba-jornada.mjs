// LAS CAÑAS DE LA 1:30 DE LA MADRUGADA.
//
// Un bar cierra el viernes a las 2. Las últimas cañas se cobran a la 1:30.
//
// Para el CALENDARIO esa venta es del sábado. Para el BAR es del viernes: la noche del
// viernes, la caja del viernes, el turno del viernes, y el encargado del viernes es quien
// responde de ella.
//
// Hasta la 0103, los informes cortaban `created_at` a `YYYY-MM-DD`. O sea que **el cierre
// de todos los fines de semana estaba mal** y el dueño cuadraba la caja a mano cada lunes
// sin entender por qué le bailaban cien euros.
//
// Se prueba:
//
//   1. La jornada se abre SOLA con la primera venta (nadie tiene que acordarse).
//   2. Dos camareros a la vez NO abren dos jornadas (o la noche se parte en dos y no cuadra
//      ningún informe).
//   3. El Z sale bien: cobrado, por método, impuestos, invitaciones aparte.
//   4. Al cerrar, las MESAS ABIERTAS no se cobran ni se anulan solas — pero el Z lo dice.
//   5. Y la venta de después del cierre cae en la jornada SIGUIENTE, no en la que se acaba
//      de cerrar. ★ Es la prueba de que la 1:30 del sábado ya no descuadra nada.
//   6. Cerrar dos veces no reescribe un cierre ya declarado.
//
//   node apps/nodo/pruebas/prueba-jornada.mjs

import { conectar, barDePrueba, borrarBar } from "./ayuda.mjs";

let fallos = 0;
const ok = (b, txt) => { console.log(`  ${b ? "✓" : "✗"} ${txt}`); if (!b) fallos++; };
const eur = (n) => `${Number(n).toFixed(2)} €`;

const bd = await conectar();
const bar = await barDePrueba(bd, "Bar del viernes por la noche");

// Una venta cobrada, con su pago. Como la haría el TPV.
async function vender(total, metodo = "EFECTIVO", tipo = "VENTA") {
  const { rows: [o] } = await bd.query(
    `insert into public.sales_order (tenant_id, location_id, canal, estado, tipo_operacion, total, client_id)
          values ($1, $2, 'TPV', 'COBRADA', $3, $4, gen_random_uuid())
       returning id, jornada_id`,
    [bar.tenantId, bar.locationId, tipo, total],
  );
  if (tipo === "VENTA") {
    await bd.query(
      `insert into public.payment (tenant_id, order_id, metodo, importe, client_id)
            values ($1, $2, $3, $4, gen_random_uuid())`,
      [bar.tenantId, o.id, metodo, total],
    );
  }
  return o;
}

const abrirMesa = () => bd.query(
  `insert into public.sales_order (tenant_id, location_id, canal, estado, total, client_id)
        values ($1, $2, 'TPV', 'ABIERTA', 12.00, gen_random_uuid()) returning id, jornada_id`,
  [bar.tenantId, bar.locationId],
).then(({ rows: [o] }) => o);

const zDe = (j) => bd.query("select public.z_de_jornada($1) as z", [j]).then(({ rows: [r] }) => r.z);

try {
  // ── 1. La jornada se abre sola ────────────────────────────────────────────
  console.log("\n1. Abre el bar: la primera venta abre la jornada, sin que nadie la abra");

  const primera = await vender(3.0);
  ok(!!primera.jornada_id, "la venta nace ya con su jornada");

  const { rows: [j1] } = await bd.query(
    "select id, numero from public.jornada where location_id = $1 and cerrada_en is null",
    [bar.locationId],
  );
  ok(j1?.id === primera.jornada_id, `y es la jornada nº ${j1?.numero}`);

  // ── 2. Dos camareros a la vez no abren dos jornadas ───────────────────────
  console.log("\n2. Seis ventas EN EL MISMO INSTANTE: ¿se abren seis jornadas?");

  await Promise.all(Array.from({ length: 6 }, () => vender(2.0)));
  const { rows: [{ n: cuantas }] } = await bd.query(
    "select count(*)::int as n from public.jornada where location_id = $1", [bar.locationId],
  );
  ok(cuantas === 1, `sigue habiendo UNA jornada (hay ${cuantas})`);

  // ── 3. La noche ───────────────────────────────────────────────────────────
  console.log("\n3. La noche del viernes");

  await vender(20.0, "TARJETA");
  await vender(15.5, "TARJETA");
  await vender(4.0, "EFECTIVO", "INVITACION");   // una ronda a la casa: NO es venta
  const mesa = await abrirMesa();   // se quedan cenando, no han pagado

  const z = await zDe(j1.id);
  console.log(`     ${z.tickets} tickets · ${eur(z.total)} · medio ${eur(z.ticket_medio)}`);
  for (const p of z.por_metodo) console.log(`     ${p.metodo.padEnd(10)} ${eur(p.importe)}`);

  ok(Number(z.total) === 3 + 2 * 6 + 20 + 15.5, `cobrado: ${eur(z.total)} (la invitación NO suma)`);
  ok(Number(z.invitaciones) === 4, `y la invitación se ve aparte: ${eur(z.invitaciones)}`);
  ok(Number(z.abiertas) === 1, "una mesa sigue abierta (están cenando)");

  const tarjeta = z.por_metodo.find((p) => p.metodo === "TARJETA");
  ok(Number(tarjeta?.importe) === 35.5, `desglosado por método: TARJETA ${eur(tarjeta?.importe)}`);

  // ── 4. Cierre: la mesa abierta NO se toca ─────────────────────────────────
  console.log("\n4. El encargado cierra el día — y quedan mesas abiertas");

  // El encargado cuenta el cajón: hay 5 € menos de los que dice el sistema.
  const efectivoEsperado = 3 + 2 * 6;   // lo cobrado en EFECTIVO
  const zCierre = await bd.query(
    "select public.cerrar_jornada($1, null, 'MANUAL', $2) as z",
    [j1.id, efectivoEsperado - 5],
  ).then(({ rows: [r] }) => r.z);

  ok(Number(zCierre.abiertas) === 1, "el Z deja constancia: quedó 1 mesa abierta");

  const { rows: [arqueo] } = await bd.query(
    "select efectivo_contado, descuadre from public.jornada where id = $1", [j1.id],
  );
  ok(Number(arqueo.descuadre) === -5,
     `★ y el DESCUADRE queda escrito: faltan ${eur(Math.abs(arqueo.descuadre))} en el cajón`);

  const { rows: [sigueAbierta] } = await bd.query(
    "select estado from public.sales_order where id = $1", [mesa.id],
  );
  ok(sigueAbierta.estado === "ABIERTA",
     "★ y la mesa SIGUE ABIERTA: no se cobra ni se anula sola (con VERIFACTU delante, eso sería firmar algo que no pasó)");

  const { rows: [cerrada] } = await bd.query(
    "select cerrada_en, tipo_cierre, arqueo_pendiente, mesas_abiertas from public.jornada where id = $1",
    [j1.id],
  );
  ok(!!cerrada.cerrada_en && cerrada.tipo_cierre === "MANUAL", "la jornada queda cerrada (MANUAL)");
  ok(cerrada.arqueo_pendiente === false, "y con la caja contada (cierre manual = hubo arqueo)");

  // ── 5. ★ LAS CAÑAS DE LA 1:30 ─────────────────────────────────────────────
  console.log("\n5. ★ Se cobra la mesa que quedó abierta — pero ya en la jornada siguiente");

  const tarde = await vender(9.0);
  ok(tarde.jornada_id !== j1.id, "la venta NO cae en la jornada que ya se cerró");

  const { rows: [j2] } = await bd.query(
    "select id, numero from public.jornada where location_id = $1 and cerrada_en is null",
    [bar.locationId],
  );
  ok(j2?.id === tarde.jornada_id, `cae en la jornada nº ${j2?.numero}, que se ha abierto sola`);

  const zViejo = await bd.query("select z from public.jornada where id = $1", [j1.id])
    .then(({ rows: [r] }) => r.z);
  ok(Number(zViejo.total) === Number(zCierre.total),
     "★ y el Z del viernes NO SE MUEVE: lo que se declaró, se declaró");

  // ── 6. Cerrar dos veces ───────────────────────────────────────────────────
  console.log("\n6. Y no se puede cerrar dos veces");

  const otraVez = await bd.query("select public.cerrar_jornada($1) as z", [j1.id])
    .then(() => null)
    .catch((e) => e);
  ok(otraVez?.code === "GLU04",
     `se rechaza (${otraVez?.code ?? "¡se dejó!"}) — si no, se reescribiría un cierre ya declarado`);

  // ── 7. El cierre automático dice que la caja está sin contar ──────────────
  console.log("\n7. Y si lo cierra el reloj a las 6, la caja queda SIN CONTAR y se dice");

  await bd.query("select public.cerrar_jornada($1, null, 'AUTOMATICO')", [j2.id]);
  const { rows: [auto] } = await bd.query(
    "select tipo_cierre, arqueo_pendiente from public.jornada where id = $1", [j2.id],
  );
  ok(auto.tipo_cierre === "AUTOMATICO" && auto.arqueo_pendiente === true,
     "queda marcada con ARQUEO PENDIENTE (al abrir mañana, hay que avisar)");

  console.log(fallos === 0
    ? "\nLa jornada es el día del bar. Las cañas de la 1:30 ya cuentan donde tienen que contar.\n"
    : `\n${fallos} fallo(s).\n`);
} finally {
  await borrarBar(bd, bar.tenantId);
  await bd.end();
}

process.exit(fallos === 0 ? 0 : 1);
