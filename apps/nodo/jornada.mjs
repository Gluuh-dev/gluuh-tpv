// EL CIERRE DE RESPALDO: si nadie cerró el día, lo cierra el nodo.
//
// Lo normal es que el encargado le dé a "Cerrar día" al terminar la noche: cuenta la caja,
// ve el Z y cierra. Pero los encargados se olvidan, y las noches largas existen.
//
// Si a la hora configurada (por defecto las 06:00) sigue habiendo una jornada abierta, la
// cierra el nodo y la marca como `AUTOMATICO` **con el arqueo pendiente** — porque nadie ha
// contado la caja. Al día siguiente hay que avisar: un descuadre que no se ve al día
// siguiente ya no se reconstruye.
//
// LO QUE NO HACE, Y ES LA DECISIÓN:
//
//   Si quedan mesas abiertas, **no las cobra ni las anula**. Las deja como están, y su venta
//   contará en la jornada en la que se cobre de verdad. La jornada se cierra con lo COBRADO;
//   lo pendiente no se inventa.
//
//   Con VERIFACTU delante, fabricar cobros o anulaciones de ventas que nadie ha confirmado
//   es firmar ante Hacienda algo que no ha pasado. El Z deja constancia ("quedaron 2 mesas
//   abiertas") y ya está.
//
//   node apps/nodo/jornada.mjs           cierra si toca (lo llama el vigilante)
//   node apps/nodo/jornada.mjs --forzar  cierra ahora, sea la hora que sea
//   node apps/nodo/jornada.mjs --estado  qué jornada hay abierta y cómo va

import pg from "pg";

pg.types.setTypeParser(1184, (v) => v);

const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const bd = new pg.Client({ connectionString: BD });
await bd.connect();

/** La hora del cierre de respaldo, por local. Se configura en `setting`; por defecto, 6. */
async function horaDeRespaldo(locationId) {
  const { rows } = await bd.query(
    "select valor from public.setting where clave = 'jornada_cierre_hora' limit 1",
  ).catch(() => ({ rows: [] }));

  const h = Number(rows[0]?.valor ?? process.env.NODO_JORNADA_HORA ?? 6);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 6;
}

const { rows: abiertas } = await bd.query(`
  select j.id, j.numero, j.location_id, j.abierta_en, l.nombre
    from public.jornada j
    join public.location l on l.id = j.location_id
   where j.cerrada_en is null
`);

if (process.argv.includes("--estado")) {
  for (const j of abiertas) {
    const { rows: [{ z }] } = await bd.query("select public.z_de_jornada($1) as z", [j.id]);
    console.log(JSON.stringify({ local: j.nombre, jornada: j.numero, abierta_en: j.abierta_en, z }, null, 2));
  }
  if (abiertas.length === 0) console.log("No hay ninguna jornada abierta.");
  await bd.end();
  process.exit(0);
}

const forzar = process.argv.includes("--forzar");
const ahora = new Date();

for (const j of abiertas) {
  const hora = await horaDeRespaldo(j.location_id);

  if (!forzar) {
    if (ahora.getHours() !== hora) continue;

    // Y NO SE CIERRA UNA JORNADA RECIÉN ABIERTA. Si el bar abre a las 6 de la mañana (una
    // cafetería de barrio), la primera venta abriría la jornada y este cierre se la llevaría
    // por delante a los diez minutos: el bar empezaría cada día con la caja cerrada.
    const horasAbierta = (ahora - new Date(j.abierta_en)) / 3_600_000;
    if (horasAbierta < 4) {
      console.log(`Jornada ${j.numero} de ${j.nombre}: abierta hace ${horasAbierta.toFixed(1)} h. No se toca.`);
      continue;
    }
  }

  const { rows: [{ z }] } = await bd.query(
    "select public.cerrar_jornada($1, null, 'AUTOMATICO') as z", [j.id],
  );

  console.log(
    `Jornada ${j.numero} de ${j.nombre} CERRADA (automático).\n` +
    `  ${z.tickets} ticket(s) · ${Number(z.total).toFixed(2)} €` +
    (Number(z.abiertas) > 0 ? `\n  ⚠ quedaron ${z.abiertas} mesa(s) abierta(s): NO se han cobrado ni anulado.` : "") +
    `\n  ⚠ ARQUEO PENDIENTE: nadie contó la caja. Hay que avisar al abrir.`,
  );
}

if (abiertas.length === 0) console.log("No hay ninguna jornada abierta.");

await bd.end();
