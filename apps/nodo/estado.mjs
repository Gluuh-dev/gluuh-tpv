// ESTADO DEL NODO — lo que verás al abrir el panel del servidor.
//
// "Poder abrirlo y ver qué lleva creado, cuánto ocupa, última actualización."
//
// Lo sirve el gateway en /nodo/estado. No lleva autenticación a propósito: sólo dice
// si los servicios están vivos y cuántas filas hay — nada de datos del negocio, y sólo
// se llega desde la red del bar. Lo que sí NO se expone jamás: secretos, ni claves, ni
// una sola fila de una venta. (De hecho aquí no sale ni un total suelto: sólo recuentos,
// estado y un agregado de la caja del día.)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { derivaDelReloj } from "./reloj.mjs";

const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const MEDIA = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");
const COPIAS = path.resolve(process.env.NODO_COPIAS ?? ".nodo/copias");
const VERSION_FICHERO = path.resolve("apps/nodo/version.json");

// Un dispositivo que no da señal en este rato se considera desconectado. La comandera
// hace ping al vincularse y en cada comanda; 3 min sin nada = se ha salido del wifi.
const DESCONECTADO_MS = 3 * 60 * 1000;

/** La versión instalada. Se enseña en el panel para saber qué tiene el bar. */
function versionInstalada() {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FICHERO, "utf8")).version ?? "?";
  } catch {
    return "?";
  }
}

const bd = new pg.Pool({ connectionString: BD, max: 3 });

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

// Los puertos que el servidor abre al arrancar. El panel los enseña tal cual: es lo que
// las comanderas, pantallas e impresoras tienen configurado. Cambiar uno aquí sin cambiarlo
// en el gateway sería mentir en el panel.
const SERVICIOS = [
  { clave: "datos", nombre: "Datos", puerto: 55433, sonda: "http://127.0.0.1:55433/" },
  { clave: "auth", nombre: "Usuarios", puerto: 55434, sonda: "http://127.0.0.1:55434/health" },
  { clave: "realtime", nombre: "Avisos en vivo", puerto: 55435, sonda: "http://127.0.0.1:55435/cambios" },
  { clave: "imagenes", nombre: "Imágenes de la carta", puerto: 55436, sonda: "http://127.0.0.1:55436/object/public/media/_" },
  { clave: "web", nombre: "Panel y TPV", puerto: 3100, sonda: "http://127.0.0.1:3100/" },
];

/** Estado de cada servicio, con su puerto, para la tabla de Servicios. */
async function servicios() {
  const vivos = await Promise.all(SERVICIOS.map((s) => vivo(s.sonda)));
  const lista = SERVICIOS.map((s, i) => ({ clave: s.clave, nombre: s.nombre, puerto: s.puerto, up: vivos[i] }));
  // El gateway (puerto 54321) está vivo por definición: si no, no estarías leyendo esto.
  lista.push({ clave: "gateway", nombre: "Puerta de la barra", puerto: 54321, up: true });
  return lista;
}

/** Uso del equipo: procesador, memoria, disco y desde cuándo está encendido. Todo real, del SO. */
async function sistema() {
  // Procesador: dos fotos de los tiempos de CPU separadas 120 ms; el % es cuánto NO estuvo ociosa.
  const foto = () => {
    let idle = 0, total = 0;
    for (const c of os.cpus()) {
      for (const t of Object.values(c.times)) total += t;
      idle += c.times.idle;
    }
    return { idle, total };
  };
  const a = foto();
  await new Promise((r) => setTimeout(r, 120));
  const b = foto();
  const dt = b.total - a.total;
  const cpu = dt > 0 ? Math.round((1 - (b.idle - a.idle) / dt) * 100) : 0;

  let disco = { libre: 0, total: 0 };
  try {
    const s = fs.statfsSync(path.resolve(".nodo"));
    disco = { libre: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    // Algún SO viejo sin statfs: lo dejamos en 0 y el panel oculta el disco. Mejor nada que mentir.
  }

  return {
    cpu,
    ramUsada: os.totalmem() - os.freemem(),
    ramTotal: os.totalmem(),
    discoLibre: disco.libre,
    discoTotal: disco.total,
    encendidoSeg: Math.round(os.uptime()),
    equipo: os.hostname(),
  };
}

/** IP y MAC de este equipo dentro del bar — lo que hay que apuntar en el router. */
function red() {
  let ip = null, mac = null;
  const ifaces = os.networkInterfaces();
  for (const nombre of Object.keys(ifaces)) {
    for (const i of ifaces[nombre] ?? []) {
      if (i.family === "IPv4" && !i.internal) {
        ip = ip ?? i.address;
        if (!mac && i.mac && i.mac !== "00:00:00:00:00:00") mac = i.mac;
      }
    }
  }
  return { ip, mac, equipo: os.hostname() };
}

/** La última copia de seguridad. Un backup que nadie mira es un backup que no existe. */
function ultimaCopia() {
  if (!fs.existsSync(COPIAS)) return { hay: 0, ultima: null, ocupa: 0, carpeta: COPIAS, lista: [] };
  const ficheros = fs.readdirSync(COPIAS)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ nombre: f, st: fs.statSync(path.join(COPIAS, f)) }))
    .sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
  return {
    hay: ficheros.length,
    ultima: ficheros[0]?.st.mtime.toISOString() ?? null,
    ocupa: ficheros.reduce((n, c) => n + c.st.size, 0),
    carpeta: COPIAS,
    // Las 5 últimas, para la tabla "Últimas copias".
    lista: ficheros.slice(0, 5).map((f) => ({ cuando: f.st.mtime.toISOString(), ocupa: f.st.size })),
  };
}

export async function estado() {
  const [servs, sist, conteos, cats, disp, mods, cli, reg, reloj] = await Promise.all([
    servicios(),
    sistema(),
    bd.query(`
      select
        (select count(*) from public.product)                                   as productos,
        (select count(*) from public.category)                                  as categorias,
        (select count(*) from public.restaurant_table)                          as mesas,
        (select count(*) from public.app_user)                                  as usuarios,
        (select count(*) from public.sales_order)                               as pedidos,
        (select count(*) from public.sales_order where estado = 'ABIERTA')      as pedidos_abiertos,
        (select count(distinct table_id) from public.sales_order
           where estado = 'ABIERTA' and table_id is not null)                   as mesas_abiertas,
        (select count(*) from public.sales_order
           where estado <> 'ABIERTA' and created_at::date = current_date)       as pedidos_hoy,
        (select coalesce(sum(total),0) from public.sales_order
           where estado <> 'ABIERTA' and created_at::date = current_date)       as caja_hoy,
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
    // Categorías con su recuento de productos y cuántos llevan foto. Solo consulta, no toca nada.
    bd.query(`
      select c.nombre, c.estacion,
             count(p.id) as productos,
             count(p.foto_url) filter (where p.foto_url is not null and p.foto_url <> '') as con_foto
      from public.category c
      left join public.product p on p.category_id = c.id
      group by c.id, c.nombre, c.estacion, c.orden
      order by c.orden nulls last, c.nombre
    `),
    // Dispositivos vinculados y cuándo dieron señal por última vez → conectado / sin conexión.
    bd.query(`
      select nombre, tipo, estacion, version, ultima_conexion
      from public.device
      where vinculado_at is not null
      order by tipo, nombre
    `),
    bd.query(`select modulo, activo from public.tenant_module order by modulo`),
    // Cliente y licencia. Un solo local por nodo; cogemos el primero.
    bd.query(`
      select
        t.nombre as tenant_nombre, t.plan, t.cif as tenant_cif,
        t.licencia_hasta, t.licencia_modulos, t.licencia_limites,
        l.razon_social, l.nombre_comercial, l.cif, l.direccion,
        l.poblacion, l.provincia, l.codigo_postal, l.territorio_fiscal,
        l.serie_factura, l.contacto, l.telefono, l.email,
        (select max(canjeado_at) from public.licencia) as alta
      from public.tenant t
      left join public.location l on l.tenant_id = t.id
      order by t.created_at
      limit 1
    `),
    // Registro: el estado de sincronización de cada tabla es nuestro "log" honesto —
    // qué se sincronizó, cuándo, y si algo falló. No inventamos eventos que no guardamos.
    bd.query(`
      select tabla, ultimo_pase, ultimo_error
      from public.nodo_sync_estado
      order by (ultimo_error is not null) desc, ultimo_pase desc nulls last
      limit 30
    `),
    derivaDelReloj(),
  ]);

  const d = conteos.rows[0];
  const ahora = Date.now();
  const dispositivos = disp.rows.map((r) => ({
    nombre: r.nombre,
    tipo: r.tipo,
    estacion: r.estacion,
    version: r.version,
    ultimaConexion: r.ultima_conexion ? new Date(r.ultima_conexion).toISOString() : null,
    conectado: r.ultima_conexion ? ahora - new Date(r.ultima_conexion).getTime() < DESCONECTADO_MS : false,
  }));

  return {
    servicios: servs,
    sistema: sist,
    red: red(),
    // Lo que el dueño quiere ver de un vistazo: qué hay creado y si algo está a medias.
    contenido: {
      productos: Number(d.productos),
      categorias: Number(d.categorias),
      mesas: Number(d.mesas),
      usuarios: Number(d.usuarios),
      pedidos: Number(d.pedidos),
      pedidosAbiertos: Number(d.pedidos_abiertos),
    },
    // Hoy en el bar. `caja` es el único total, agregado del día — no expone ninguna venta suelta.
    hoy: {
      pedidos: Number(d.pedidos_hoy),
      mesasAbiertas: Number(d.mesas_abiertas),
      mesasLibres: Number(d.mesas) - Number(d.mesas_abiertas),
      caja: Number(d.caja_hoy),
    },
    categorias: cats.rows.map((r) => ({
      nombre: r.nombre,
      estacion: r.estacion,
      productos: Number(r.productos),
      conFoto: Number(r.con_foto),
    })),
    dispositivos,
    modulos: mods.rows.map((r) => ({ modulo: r.modulo, activo: r.activo })),
    cliente: cli.rows[0] ?? null,
    registro: reg.rows.map((r) => ({
      tabla: r.tabla,
      cuando: r.ultimo_pase ? new Date(r.ultimo_pase).toISOString() : null,
      error: r.ultimo_error,
    })),
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
    // La copia del bar. La nube tiene lo cerrado; esto tiene TODO, incluidas las mesas que
    // ahora mismo están abiertas. Se enseña porque un backup que nadie mira no existe: se
    // descubre que llevaba tres meses fallando el día que hace falta.
    copia: ultimaCopia(),
    // Este ordenador es el que le pone la hora a cada FACTURA. Si va desviado, está
    // firmando facturas con una hora que no ocurrió.
    reloj,
    version: versionInstalada(),
    ahora: new Date().toISOString(),
  };
}
