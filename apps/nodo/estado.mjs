// ESTADO DEL NODO — lo que verás al abrir el panel del servidor.
//
// "Poder abrirlo y ver qué lleva creado, cuánto ocupa, última actualización."
//
// Lo sirve el gateway en /nodo/estado. No lleva autenticación a propósito: sólo dice
// si los servicios están vivos y cuántas filas hay — nada de datos del negocio, y sólo
// se llega desde la red del bar. Lo que sí NO se expone jamás: secretos, ni claves, ni
// una sola fila de una venta.

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const MEDIA = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");

const bd = new pg.Pool({ connectionString: BD, max: 2 });

/** Cuánto ocupa una carpeta, en bytes. */
function tamano(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? tamano(p) : fs.statSync(p).size;
  }
  return total;
}

/** ¿Responde un servicio del nodo? */
async function vivo(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2000);
    await fetch(url, { signal: c.signal });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

export async function estado() {
  const [servicios, datos] = await Promise.all([
    Promise.all([
      vivo("http://127.0.0.1:55433/").then((v) => ["datos", v]),
      vivo("http://127.0.0.1:55434/health").then((v) => ["auth", v]),
      vivo("http://127.0.0.1:55435/cambios").then((v) => ["realtime", v]),
      vivo("http://127.0.0.1:55436/object/public/media/_").then(() => ["imagenes", true]),
    ]),
    bd.query(`
      select
        (select count(*) from public.product)                                   as productos,
        (select count(*) from public.category)                                  as categorias,
        (select count(*) from public.restaurant_table)                          as mesas,
        (select count(*) from public.sales_order)                               as pedidos,
        (select count(*) from public.sales_order where estado = 'ABIERTA')      as pedidos_abiertos,
        (select count(*) from public.app_user)                                  as usuarios,
        (select count(*) from public.nodo_media_pendiente where subida_at is null) as imagenes_por_subir,
        (select max(created_at) from public.sales_order)                        as ultima_venta,
        (select max(ultimo_pase) from public.nodo_sync_estado)                  as ultima_sync,
        (select count(*) from public.nodo_sync_estado where ultimo_error is not null) as sync_con_error,
        (select count(*) from public.sales_order
          where estado <> 'ABIERTA'
            and updated_at > coalesce(
              (select hasta from public.nodo_sync_estado where tabla = 'sales_order'),
              '-infinity'))                                                     as ventas_por_subir,
        pg_database_size(current_database())                                    as bytes_bd
    `),
  ]);

  const d = datos.rows[0];
  return {
    servicios: Object.fromEntries(servicios),
    // Lo que el dueño quiere ver de un vistazo: qué hay creado y si algo está a medias.
    contenido: {
      productos: Number(d.productos),
      categorias: Number(d.categorias),
      mesas: Number(d.mesas),
      usuarios: Number(d.usuarios),
      pedidos: Number(d.pedidos),
      pedidosAbiertos: Number(d.pedidos_abiertos),
    },
    ocupa: {
      baseDatos: Number(d.bytes_bd),
      imagenes: tamano(MEDIA),
    },
    sincronizacion: {
      // > 0 aquí significa: esto sólo existe en el disco de esta barra. Si el mini-PC
      // se muere ahora, se pierde. Es LO PRIMERO que hay que mirar.
      imagenesPorSubir: Number(d.imagenes_por_subir),
      ventasPorSubir: Number(d.ventas_por_subir),
      conError: Number(d.sync_con_error),
      ultimaSync: d.ultima_sync,
      ultimaVenta: d.ultima_venta,
    },
    ahora: new Date().toISOString(),
  };
}
