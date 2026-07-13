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

// Las marcas de tiempo, en TEXTO tal como las da Postgres — no como Date de JS.
//
// Postgres guarda microsegundos; el Date de JavaScript sólo llega al milisegundo. Si
// dejamos que el driver convierta, la marca de agua se queda un pelo POR DETRÁS del
// último registro subido, y ese registro se vuelve a enviar en cada pase… para siempre.
// No duplicaba nada (el on_conflict lo impide), pero era tráfico regalado en un bar con
// una línea mala. En texto, la marca es exacta.
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
  { nombre: "payment", conflicto: "tenant_id,client_id", tiempo: "created_at" },
  { nombre: "invoice", conflicto: "id", tiempo: "created_at" },
  // Una caja se sube cuando se ha cerrado (cuadrada), no mientras está en marcha.
  { nombre: "cash_session", conflicto: "id", tiempo: "abierta_en", filtro: "cerrada_en is not null" },
  { nombre: "cash_move", conflicto: "id", tiempo: "created_at" },
];

const LOTE = 200;

const bd = new pg.Pool({ connectionString: BD });

// Las cabeceras se piden en CADA pase: el token del bar caduca en una hora y hay que
// renovarlo. Si vuelve null es que no hay línea (o no hay credenciales): no es un error.
let cab = null;

async function hayNube() {
  cab = await cabeceras();
  if (!cab) return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const r = await fetch(`${NUBE}/rest/v1/`, { headers: cab, signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
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
async function subirTabla({ nombre, conflicto, tiempo, filtro }) {
  const { rows: est } = await bd.query(
    "select hasta from public.nodo_sync_estado where tabla = $1",
    [nombre],
  );
  // La primera vez no hay marca: se sube todo desde el principio de los tiempos.
  const desde = est[0]?.hasta ?? "1970-01-01T00:00:00Z";

  let subidas = 0;
  let marca = desde;
  const donde = filtro ? `and (${filtro})` : "";

  for (;;) {
    const { rows } = await bd.query(
      `select * from public."${nombre}"
        where "${tiempo}" > $1 ${donde}
        order by "${tiempo}"
        limit ${LOTE}`,
      [marca],
    );
    if (rows.length === 0) break;

    const r = await fetch(`${NUBE}/rest/v1/${nombre}?on_conflict=${conflicto}`, {
      method: "POST",
      headers: { ...cab, prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);

    // La marca avanza SÓLO ahora, con la nube ya confirmando. Si esto no se alcanza,
    // el próximo pase reenvía el lote — y por el on_conflict no duplica nada.
    marca = rows[rows.length - 1][tiempo];
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
