// SINCRONIZADOR NODO → NUBE.
//
// El bar funciona sin internet. Cuando hay línea, lo que ha pasado en la barra sube a
// Supabase: para que el dueño lo vea desde casa, y para que exista una copia fuera del
// mini-PC que hay debajo de la caja.
//
// DOS REGLAS QUE MANDAN SOBRE TODO LO DEMÁS:
//
//   1. UNA SOLA DIRECCIÓN para lo operativo y lo fiscal: nodo → nube. Lo que pasa en el
//      bar nace en el bar, y el bar tiene la razón. La nube NO puede reescribir una
//      venta. (El catálogo va al revés; eso no se toca aquí.)
//
//   2. REENVIAR NO PUEDE DUPLICAR. Si se corta a mitad, el siguiente pase repite ese
//      trozo. Por eso cada fila operativa lleva `client_id` (un UUID que pone el TPV) y
//      todo sube con `on_conflict=client_id`: la misma venta dos veces sigue siendo una
//      venta. Un cobro duplicado en la contabilidad de un cliente es inaceptable.
//
// Nunca borra nada del nodo. Sincronizar es copiar, no vaciar.
//
//   node apps/nodo/sincronizar.mjs

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { cabeceras, credenciales } from "./nube.mjs";
import {
  NO_BAJAR, NO_SUBIR_COLUMNAS, clavePk, fechasLocales, leerEsquema, meterFilas,
} from "./espejo.mjs";

// Las marcas de tiempo, en TEXTO tal como las da Postgres — no como Date de JS.
//
// Postgres guarda microsegundos; el Date de JavaScript sólo llega al milisegundo. Si
// dejamos que el driver convierta, la marca de agua se queda un pelo POR DETRÁS del
// último registro subido, y ese registro se vuelve a enviar en cada pase… para siempre.
// No duplicaba nada (el on_conflict lo impide), pero era tráfico regalado en un bar con
// una línea mala. En texto, la marca es exacta.
//
// (`espejo.mjs` hace lo mismo al importarse. Se deja aquí también, explícito: de esto
// depende que no se reenvíe la misma venta cada cinco minutos, y no puede quedar colgando
// del efecto de un import.)
pg.types.setTypeParser(1184, (v) => v); // timestamptz
pg.types.setTypeParser(1114, (v) => v); // timestamp

// ── Identidad ante la nube ───────────────────────────────────────────────────
//
// El nodo NO lleva la clave maestra de la plataforma. Se identifica como SU bar y la RLS
// lo acota a él. La diferencia es enorme: con la clave maestra, robar el mini-PC de un
// bar sería robar los datos de TODOS los clientes. Ver nube.mjs.
const NUBE = credenciales().url;
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const MEDIA = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");

if (!NUBE) {
  console.error("Falta SUPABASE_URL en .nodo/sync.env: este nodo no sube nada a la nube.");
  process.exit(1);
}

// SÓLO SE SUBEN LAS CUENTAS CERRADAS. No es una limitación: es la decisión.
//
// Una cuenta ABIERTA cambia de líneas continuamente —el TPV las reemplaza borrando e
// insertando (RPC `reemplazar_lineas`)—, y este sincronizador **no sabe propagar
// borrados**: una línea que se quita en el nodo viviría para siempre en la nube, y el
// dueño vería desde casa un ticket con cosas que nadie se comió.
//
// Un ticket CERRADO, en cambio, ya no cambia nunca. Subiendo sólo esos, el problema del
// borrado desaparece de raíz en vez de parchearse. Y lo que el dueño quiere ver desde
// casa son las ventas hechas, no lo que hay a medias en la mesa 4.
//
// El orden tampoco es decorativo: una línea no puede llegar antes que su pedido, ni un
// pago antes que la venta que paga.
const ABIERTAS = "estado = 'ABIERTA'";

const TABLAS = [
  {
    nombre: "sales_order",
    // El único índice es COMPUESTO: (tenant_id, client_id). Con `client_id` a secas,
    // PostgREST responde «no unique or exclusion constraint matching».
    conflicto: "tenant_id,client_id",
    tiempo: "updated_at",
    filtro: `not (${ABIERTAS})`,
  },
  {
    nombre: "order_line",
    conflicto: "id",   // el id lo genera el nodo: reenviarlo es idempotente igual
    tiempo: "created_at",
    filtro: `order_id in (select id from public.sales_order where not (${ABIERTAS}))`,
  },
  {
    // QUIÉN ANULÓ QUÉ, Y POR QUÉ. Es lo primero que mira un dueño cuando la caja no le
    // cuadra, y no llegaba a la nube: se quedaba encerrado en el mini-PC del bar — justo
    // donde no puede mirarlo. Va con el mismo filtro que las líneas: su pedido tiene que
    // haber subido antes, o la clave foránea lo rechaza.
    nombre: "order_event",
    conflicto: "id",
    tiempo: "created_at",
    filtro: `order_id in (select id from public.sales_order where not (${ABIERTAS}))`,
  },
  { nombre: "payment", conflicto: "tenant_id,client_id", tiempo: "created_at" },
  { nombre: "invoice", conflicto: "id", tiempo: "created_at" },

  // ── LO FISCAL. Sin esto, la nube NO PUEDE ENVIAR A LA AEAT ──────────────────
  //
  // La decisión es que el nodo genera la factura sin internet y la NUBE la remite a
  // Hacienda (docs/plan/11 §7). Para eso la nube necesita, además de la factura:
  //   · el desglose de impuestos (base y cuota por tipo)  → invoice_tax_line
  //   · el registro de la cadena de huellas               → verifactu_record
  //
  // Faltaban las dos. Nadie lo habría notado hasta activar VERIFACTU en un cliente
  // real: la nube habría recibido facturas mudas y no habría podido declarar nada.
  {
    nombre: "invoice_tax_line",
    conflicto: "id",
    // OJO: esta tabla NO TIENE created_at ni updated_at (id, tenant_id, invoice_id,
    // tipo, base, cuota — y ya). No hay columna de tiempo por la que llevar la marca
    // de agua, así que se marca por la fecha de SU FACTURA. Por eso lleva un `origen`
    // con join en vez de la tabla a secas.
    origen: 'public.invoice_tax_line l join public.invoice i on i.id = l.invoice_id',
    columnas: "l.*",
    tiempo: "i.created_at",
  },
  {
    nombre: "verifactu_record",
    conflicto: "id",
    tiempo: "created_at",
    // `device_id` apunta a `device`, que hoy NO se sincroniza. Mientras /api/factura no
    // lo rellene (hoy lo deja a null) no hay problema; el día que lo rellene, hay que
    // subir `device` ANTES que esto o la clave foránea rechazará el registro.
  },

  // Una caja se sube cuando se ha cerrado (cuadrada), no mientras está en marcha.
  { nombre: "cash_session", conflicto: "id", tiempo: "abierta_en", filtro: "cerrada_en is not null" },
  { nombre: "cash_move", conflicto: "id", tiempo: "created_at" },
];

const LOTE = 200;

// Cuántas filas se piden de una tabla de la nube para compararla con la del bar. Si una
// tabla llegara a este tope, la lista podría venir CORTADA — y lo que faltara parecería
// borrado. Cuando pasa, no se borra nada y se dice por el log (`propagarBorrados`).
const TOPE = 5000;

const bd = new pg.Pool({ connectionString: BD });

// Las cabeceras se piden en CADA pase: el token del bar caduca en una hora y hay que
// renovarlo. Si vuelve null es que no hay línea (o no hay credenciales): no es un error.
let cab = null;

// ── QUÉ COLUMNAS ENTIENDE LA NUBE ────────────────────────────────────────────
//
// Un nodo puede ir POR DELANTE de la nube: se publica una versión, el bar se actualiza, y
// la migración de la nube todavía no está. Entonces el nodo sube sus filas con `select *`,
// mete una columna que allí no existe, y PostgREST devuelve un 400:
//
//     «Could not find the 'jornada_id' column of 'sales_order' in the schema cache»
//
// Y ese bar **deja de subir sus ventas**. El dinero se queda encerrado en el mini-PC de la
// barra hasta que alguien se dé cuenta.
//
// La regla sigue siendo «la nube se migra ANTES que los nodos» — pero un error de orden no
// puede costarle a un bar sus ventas. Así que se le pregunta a la nube qué columnas tiene
// (la raíz de PostgREST devuelve su esquema) y se le manda sólo eso. La columna nueva
// empieza a viajar sola el día que la nube la tenga.
let columnasDeLaNube = new Map();

async function hayNube() {
  cab = await cabeceras();
  if (!cab) return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(`${NUBE}/rest/v1/`, { headers: cab, signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return false;

    const esquema = await r.json().catch(() => null);
    columnasDeLaNube = new Map(
      Object.entries(esquema?.definitions ?? {}).map(
        ([tabla, def]) => [tabla, new Set(Object.keys(def?.properties ?? {}))],
      ),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Quita de una fila lo que la nube no sabe qué es.
 *
 * Si no se pudo leer el esquema, **va todo** (fallar abierto, no cerrado): más vale que un
 * lote lo rechace la nube y se reintente, a que el nodo empiece a comerse columnas de verdad
 * —el `total` de una venta— porque no supo leer una respuesta.
 */
function loQueLaNubeEntiende(tabla, fila) {
  const suyas = columnasDeLaNube.get(tabla);
  if (!suyas?.size) return fila;

  const limpia = {};
  for (const [k, v] of Object.entries(fila)) {
    if (suyas.has(k)) limpia[k] = v;
  }
  return limpia;
}

// ── 1. Las imágenes que sólo existen en este ordenador ───────────────────────
async function subirImagenes() {
  const { rows } = await bd.query(
    "select ruta from public.nodo_media_pendiente where subida_at is null order by creada_at limit 100",
  );
  let ok = 0;

  for (const { ruta } of rows) {
    const fichero = path.resolve(MEDIA, ruta);
    if (!fs.existsSync(fichero)) {
      // La fila está pero el fichero no: alguien lo borró a mano. No sirve de nada
      // reintentarlo eternamente — se anota y se saca de la cola.
      await bd.query(
        "update public.nodo_media_pendiente set subida_at = now(), ultimo_error = 'el fichero ya no está' where ruta = $1",
        [ruta],
      );
      continue;
    }

    try {
      const r = await fetch(`${NUBE}/storage/v1/object/media/${ruta}`, {
        method: "POST",
        headers: { ...cab, "x-upsert": "true", "content-type": "application/octet-stream" },
        body: fs.readFileSync(fichero),
      });
      if (!r.ok && r.status !== 409) throw new Error(`HTTP ${r.status} ${await r.text()}`);

      await bd.query("update public.nodo_media_pendiente set subida_at = now() where ruta = $1", [ruta]);
      ok++;
    } catch (e) {
      await bd.query(
        "update public.nodo_media_pendiente set intentos = intentos + 1, ultimo_error = $2 where ruta = $1",
        [ruta, e.message.slice(0, 300)],
      );
    }
  }
  return { subidas: ok, quedaban: rows.length };
}

// ── 2. Las ventas y lo fiscal ────────────────────────────────────────────────
async function subirTabla({ nombre, conflicto, tiempo, filtro, origen, columnas }) {
  const { rows: est } = await bd.query(
    "select hasta from public.nodo_sync_estado where tabla = $1",
    [nombre],
  );
  // La primera vez no hay marca: se sube todo desde el principio de los tiempos.
  const desde = est[0]?.hasta ?? "1970-01-01T00:00:00Z";

  let subidas = 0;
  let marca = desde;
  const donde = filtro ? `and (${filtro})` : "";
  const de = origen ?? `public."${nombre}"`;
  const que = columnas ?? "*";

  for (;;) {
    // `as _marca`: la columna de tiempo se pide con un alias fijo porque puede venir de
    // OTRA tabla (invoice_tax_line se ordena por la fecha de su factura) y entonces no
    // está en la fila que se sube. Con el alias, la marca de agua siempre se lee igual.
    const { rows } = await bd.query(
      `select ${que}, ${tiempo} as _marca
         from ${de}
        where ${tiempo} > $1 ${donde}
        order by ${tiempo}
        limit ${LOTE}`,
      [marca],
    );
    if (rows.length === 0) break;

    // `_marca` es nuestra, no de la tabla: si se envía, PostgREST rechaza el lote entero
    // («column _marca does not exist»). Se quita antes de salir por el cable — y de paso, lo
    // que la nube todavía no sabe qué es (un nodo puede ir por delante de ella).
    const aSubir = rows.map((r) => {
      const fila = { ...r };
      delete fila._marca;
      return loQueLaNubeEntiende(nombre, fila);
    });

    const r = await fetch(`${NUBE}/rest/v1/${nombre}?on_conflict=${conflicto}`, {
      method: "POST",
      headers: { ...cab, prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(aSubir),
    });
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);

    // La marca avanza SÓLO ahora, con la nube ya confirmando. Si esto no se alcanza,
    // el próximo pase reenvía el lote — y por el on_conflict no duplica nada.
    marca = rows[rows.length - 1]._marca;
    subidas += rows.length;

    await bd.query(
      `insert into public.nodo_sync_estado (tabla, hasta, ultimo_pase, filas_subidas)
            values ($1, $2, now(), $3)
       on conflict (tabla) do update
            set hasta = excluded.hasta,
                ultimo_pase = now(),
                filas_subidas = public.nodo_sync_estado.filas_subidas + excluded.filas_subidas,
                ultimo_error = null`,
      [nombre, marca, rows.length],
    );

    if (rows.length < LOTE) break;
  }

  // La tabla ha ido bien: se borra el error de la vez anterior AUNQUE no hubiera nada
  // que subir. Sin esto, un fallo viejo se queda pegado para siempre y el panel le
  // diría al dueño «avisa al soporte» con todo funcionando. Una alarma que miente se
  // acaba ignorando, y entonces no sirve el día que sea de verdad.
  await bd.query(
    `insert into public.nodo_sync_estado (tabla, ultimo_pase) values ($1, now())
     on conflict (tabla) do update set ultimo_pase = now(), ultimo_error = null`,
    [nombre],
  );
  return subidas;
}

// ── 3. EL CATÁLOGO, EN LAS DOS DIRECCIONES ───────────────────────────────────
//
// Hasta ahora el nodo se bajaba el bar al instalarse y **no volvía a mirar nunca**. El
// dueño cambiaba un precio desde casa y el TPV seguía cobrando el viejo. Para siempre.
//
// El catálogo no es como las ventas. Una venta nace en el bar y sube, y punto. Un precio
// se puede tocar en los dos sitios: desde casa con internet, o en la propia barra sin él.
// Así que **gana el más reciente** (`updated_at`), en las dos direcciones.
//
// Aquí se ve por qué hizo falta la migración 0101: la mayoría de estas tablas NO TENÍAN
// `updated_at`. Sin saber cuándo se tocó una fila no se puede saber quién gana, y esto
// era literalmente imposible de construir.

async function elBarDeEsteNodo() {
  const c = credenciales().tenant;
  if (c) return c;
  const { rows: [t] } = await bd.query("select id from public.tenant limit 1");
  return t?.id;
}

const marcaDeAgua = (clave) =>
  bd.query("select hasta from public.nodo_sync_estado where tabla = $1", [clave])
    .then(({ rows }) => rows[0]?.hasta ?? "1970-01-01T00:00:00Z");

const anotarMarca = (clave, hasta) =>
  bd.query(
    `insert into public.nodo_sync_estado (tabla, hasta, ultimo_pase) values ($1, $2, now())
     on conflict (tabla) do update set hasta = excluded.hasta, ultimo_pase = now()`,
    [clave, hasta],
  );

/**
 * DOS FECHAS QUE SON LA MISMA PERO NO SE PARECEN EN NADA.
 *
 *   Postgres  →  "2026-07-14 10:48:34.098381+02"     (espacio, y la hora del bar)
 *   PostgREST →  "2026-07-14T08:48:34.098381+00:00"  (una T, y UTC)
 *
 * Es el MISMO instante. Pero comparados como texto con `<`, el espacio (0x20) es menor que
 * la 'T' (0x54), así que **la fila del bar siempre parecía más vieja que la de la nube**,
 * pasara lo que pasara. Consecuencia: el bar no podía subir un cambio de carta NUNCA, y se
 * bajaba de la nube cosas que ya tenía.
 *
 * Y no habría dado ni un error: simplemente, el precio que el dueño cambia en la barra no
 * llegaría jamás a la nube y él no sabría por qué.
 *
 * Se comparan como instantes. (Al milisegundo: los microsegundos hacen falta para la marca
 * de agua —para no reenviar lo mismo eternamente—, pero no para decidir quién editó
 * después. Dos ediciones en el mismo milisegundo desde dos sitios distintos no existen.)
 */
function instante(t) {
  if (!t) return 0;
  const s = String(t).replace(" ", "T");
  // `+02` a secas no es ISO válido para JavaScript, que quiere `+02:00`. Se completa.
  const ms = Date.parse(/[+-]\d{2}$/.test(s) ? `${s}:00` : s);
  if (Number.isNaN(ms)) throw new Error(`fecha ininteligible: ${t}`);
  return ms;
}

/** Las tablas del catálogo: las que saben cuándo se tocaron. */
const tablasDeCatalogo = (esquema) =>
  esquema.orden.filter((tabla) => {
    if (NO_BAJAR.has(tabla)) return false;
    const columnas = esquema.columnasDe.get(tabla);
    if (!columnas?.has("updated_at") || !esquema.pkDe.get(tabla)?.length) return false;
    return columnas.has("tenant_id") || tabla === "tenant";
  });

async function sincronizarCatalogo(tenantId, esquema) {
  const cuenta = { bajadas: 0, subidas: 0, borradas: 0, fallos: [] };

  for (const tabla of tablasDeCatalogo(esquema)) {
    try {
      const n = await sincronizarTablaDeCatalogo(tenantId, esquema, tabla);
      cuenta.bajadas += n.bajadas;
      cuenta.subidas += n.subidas;
      cuenta.borradas += n.borradas;
    } catch (e) {
      // Una tabla que falla no puede dejar sin sincronizar a las demás. Si la nube no
      // deja escribir en `licencia`, que no se quede la carta sin bajar por eso.
      cuenta.fallos.push(`${tabla}: ${e.message.slice(0, 90)}`);
    }
  }

  return cuenta;
}

async function sincronizarTablaDeCatalogo(tenantId, esquema, tabla) {
  const cuenta = { bajadas: 0, subidas: 0, borradas: 0 };
  const pk = esquema.pkDe.get(tabla);
  const filtro = tabla === "tenant" ? `id=eq.${tenantId}` : `tenant_id=eq.${tenantId}`;

  // ── LAS DOS FOTOS: qué hay a cada lado y de cuándo ──────────────────────────
  //
  // Se compara el bar con LA NUBE DE VERDAD, no con una marca de agua. Y esa es la
  // corrección que hace que esto funcione:
  //
  //   Una fila recién BAJADA de la nube queda, aquí, con fecha nueva. Una marca de agua
  //   local no sabe distinguir «esto lo he cambiado yo» de «esto me lo acaban de dar», así
  //   que en el pase siguiente la daría por cambiada en el bar y **la volvería a subir**.
  //   Y la nube, al recibirla, la marcaría otra vez… Un bar bajando y subiendo su propia
  //   carta cada cinco minutos, con los TPV repintándose solos delante de los clientes.
  //
  // Comparando fecha contra fecha eso no puede pasar: si las dos son iguales, no hay nada
  // que hacer. Cuesta una petición más por tabla — y esa petición hace falta igualmente
  // para saber qué se ha borrado.
  const mias = await fechasLocales(bd, esquema, tabla, tenantId);

  const suyas = await fetch(
    `${NUBE}/rest/v1/${tabla}?select=${pk.join(",")},updated_at&${filtro}&limit=${TOPE}`,
    { headers: cab },
  ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!suyas) return cuenta;   // sin línea: ya se hará en el pase siguiente

  const enLaNube = new Map(suyas.map((f) => [clavePk(pk, f), f.updated_at]));

  // ── BAJA: lo que la nube tiene más nuevo ────────────────────────────────────
  //
  // El delta (por `updated_at`) sirve para pedir SÓLO las filas cambiadas con todas sus
  // columnas. La foto de arriba dice qué cambió; ésta trae el contenido.
  const desdeBaja = await marcaDeAgua(`baja:${tabla}`);
  const deLaNube = await fetch(
    `${NUBE}/rest/v1/${tabla}?select=*&${filtro}&updated_at=gt.${encodeURIComponent(desdeBaja)}&limit=1000`,
    { headers: cab },
  ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!deLaNube) return cuenta;

  const aBajar = deLaNube.filter((f) => {
    const mia = mias.get(clavePk(pk, f));
    return !mia || instante(mia.updated_at) < instante(f.updated_at);   // gana el reciente
  });

  if (aBajar.length) {
    // Con los triggers PUESTOS: `set_updated_at` respeta la fecha que trae la fila (0101),
    // así que la fecha no se corre — y el aviso de realtime salta solo, o sea que el TPV
    // repinta el precio nuevo sin que nadie recargue nada.
    await meterFilas(bd, esquema, tabla, aBajar);
    cuenta.bajadas = aBajar.length;
  }

  // ── SUBE: lo que el dueño ha cambiado EN LA BARRA, sin internet ─────────────
  //
  // La marca `sube:` sólo sirve para no releer el catálogo entero de la base cada cinco
  // minutos. Quién gana NO lo decide ella: lo decide la comparación con la nube.
  const desdeSube = await marcaDeAgua(`sube:${tabla}`);
  const delBar = tabla === "tenant" ? [] : (await bd.query(
    `select * from public."${tabla}" where tenant_id = $1 and updated_at > $2 order by updated_at`,
    [tenantId, desdeSube],
  )).rows;

  const aSubir = delBar.filter((f) => {
    const suya = enLaNube.get(clavePk(pk, f));
    // Misma fecha = ya están en sintonía (la fila bajó de la nube y no se ha tocado aquí).
    return !suya || instante(f.updated_at) > instante(suya);
  });
  const subidas = new Set(aSubir.map((f) => clavePk(pk, f)));

  if (aSubir.length) {
    const r = await fetch(`${NUBE}/rest/v1/${tabla}?on_conflict=${pk.join(",")}`, {
      method: "POST",
      headers: { ...cab, prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(aSubir.map((f) => loQueLaNubeEntiende(tabla, limpiarParaLaNube(f)))),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    cuenta.subidas = aSubir.length;
  }

  // Las marcas avanzan con TODO lo leído, no sólo con lo aplicado.
  //
  // ⚠ Y eso descansa en un invariante que hay que respetar si se toca esto: **cada fila de
  // `delBar` queda resuelta en este pase**. O sube, o ya estaba en sintonía, o la nube la
  // tiene más nueva y baja (y si baja es que está en el delta, porque su fecha es posterior
  // a la marca `baja:`). Si alguien añade un «esta fila me la salto», la marca pasará por
  // encima de ella y **ese cambio del bar no subirá jamás**. Sin error, sin rastro: el
  // dueño cambia un precio en la barra y no llega nunca a la nube.
  if (deLaNube.length) {
    const ultima = deLaNube.reduce((a, b) => (instante(a.updated_at) >= instante(b.updated_at) ? a : b));
    await anotarMarca(`baja:${tabla}`, ultima.updated_at);
  }
  if (delBar.length) {
    await anotarMarca(`sube:${tabla}`, delBar[delBar.length - 1].updated_at);
  }

  cuenta.borradas = await propagarBorrados(tabla, pk, mias, enLaNube, suyas.length, subidas);
  return cuenta;
}

/** El espejo no puede devolverle a la nube lo que aquí es distinto a propósito. */
function limpiarParaLaNube(fila) {
  const copia = { ...fila };
  for (const c of NO_SUBIR_COLUMNAS) delete copia[c];
  return copia;
}

/**
 * LO QUE EL DUEÑO BORRA EN LA NUBE, DESAPARECE DEL BAR.
 *
 * Ninguna tabla del catálogo tiene `deleted_at`: en la nube se borra de verdad. Así que un
 * delta por fecha **jamás vería una baja** — el producto retirado seguiría en la carta del
 * bar para siempre. Hay que comparar las claves: lo que ya no está allí, se quita aquí.
 *
 * Y esto es lo más peligroso de todo el sincronizador: **una lista mal leída borra el bar
 * entero**. Un token con el tenant equivocado, una respuesta cortada por el límite — y la
 * RLS devuelve `[]` con un 200 tan tranquila. De ahí los tres cerrojos.
 */
async function propagarBorrados(tabla, pk, mias, enLaNube, cuantasAllí, subidas) {
  // CERROJO 1 — la lista viene llena hasta el borde: puede estar CORTADA, y todo lo que
  // faltara se borraría aquí. No se toca nada, y se dice.
  if (cuantasAllí >= TOPE) {
    console.warn(`  ${tabla}: la nube devuelve ${TOPE}+ filas; no se propagan borrados.`);
    return 0;
  }

  // CERROJO 2 — la nube la da por VACÍA y aquí hay cosas. Casi seguro que es un fallo (un
  // token de otra empresa, la RLS callada) y no que el dueño haya borrado la carta entera
  // de golpe. Ante la duda no se borra: una carta vieja se arregla; una carta borrada, no.
  if (cuantasAllí === 0 && mias.size > 0) {
    console.warn(`  ${tabla}: la nube la da por VACÍA y aquí hay ${mias.size}. No se borra nada.`);
    return 0;
  }

  let borradas = 0;
  for (const [clave, fila] of mias) {
    if (enLaNube.has(clave)) continue;

    // CERROJO 3 — esta fila NACE EN EL BAR: la acabamos de subir en este mismo pase, y por
    // eso no salía en la foto de la nube (que es de antes). No está borrada: está llegando.
    //
    // Sin esto, el producto que el dueño crea en la barra sin internet **se borraría solo**
    // en el primer pase con línea. Lo vería desaparecer sin un solo error por ningún lado.
    if (subidas.has(clave)) continue;

    await bd.query(
      `delete from public."${tabla}" where ${pk.map((k, i) => `"${k}" = $${i + 1}`).join(" and ")}`,
      pk.map((k) => fila[k]),
    );
    borradas++;
  }
  return borradas;
}

// ── Pase completo ────────────────────────────────────────────────────────────
async function pase() {
  if (!(await hayNube())) {
    // Sin internet NO se falla: se calla y se vuelve luego. El bar sigue vendiendo, que
    // es lo único que no puede parar. Que no haya línea un martes no es una avería.
    console.log("Sin conexión con la nube. El bar sigue funcionando; ya subirá.");
    return;
  }

  console.log("Conectado con la nube. Subiendo lo del bar…\n");

  const img = await subirImagenes();
  console.log(`  imágenes  ${img.subidas}/${img.quedaban} subidas`);

  for (const t of TABLAS) {
    try {
      const n = await subirTabla(t);
      console.log(`  ${t.nombre.padEnd(14)} ${n} fila(s)`);
    } catch (e) {
      // Que falle una tabla no puede parar las demás: la venta importa más que el arqueo.
      console.error(`  ${t.nombre.padEnd(14)} FALLÓ — ${e.message}`);
      await bd.query(
        `insert into public.nodo_sync_estado (tabla, ultimo_pase, ultimo_error) values ($1, now(), $2)
         on conflict (tabla) do update set ultimo_pase = now(), ultimo_error = excluded.ultimo_error`,
        [t.nombre, e.message.slice(0, 300)],
      );
    }
  }

  // Y el catálogo, en las dos direcciones. VA DESPUÉS de las ventas a propósito: si la
  // línea es mala y sólo da para una cosa, que sea subir el dinero.
  const tenantId = await elBarDeEsteNodo();
  if (tenantId) {
    const c = await sincronizarCatalogo(tenantId, await leerEsquema(bd));
    console.log(
      `\n  catálogo       ${c.bajadas} bajada(s), ${c.subidas} subida(s), ${c.borradas} borrada(s)`,
    );
    for (const f of c.fallos) console.error(`                 FALLÓ ${f}`);

    await bd.query(
      `insert into public.nodo_sync_estado (tabla, ultimo_pase, ultimo_error)
            values ('catalogo', now(), $1)
       on conflict (tabla) do update
            set ultimo_pase = now(), ultimo_error = excluded.ultimo_error`,
      [c.fallos.length ? c.fallos.join(" · ").slice(0, 300) : null],
    );
  }

  console.log("\nListo.");
}

// `--bucle`: se queda de servicio, sincronizando cada pocos minutos. Sin él, un pase y
// fuera (útil para el instalador y para probar a mano).
if (process.argv.includes("--bucle")) {
  const CADA = Number(process.env.NODO_SYNC_MINUTOS ?? 5) * 60_000;
  console.log(`Sincronizador en marcha: un pase cada ${CADA / 60_000} min.\n`);
  for (;;) {
    try {
      await pase();
    } catch (e) {
      // Pase lo que pase, el bucle NO muere: mañana habrá línea y habrá que subir lo
      // de hoy. Un sincronizador que se rinde deja las ventas encerradas en el bar.
      console.error("pase fallido:", e.message);
    }
    await new Promise((r) => setTimeout(r, CADA));
  }
} else {
  await pase();
  await bd.end();
}
