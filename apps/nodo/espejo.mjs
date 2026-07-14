// EL ESPEJO: traer filas de la nube al nodo, en el orden correcto y con el tipo correcto.
//
// Lo usan dos:
//   · `provisionar.mjs`  — al instalar: se lo trae TODO.
//   · `sincronizar.mjs`  — cada pase: sólo lo que ha cambiado, y borra lo que ya no está.
//
// Estaba duplicado en el primero; aquí vive una sola vez.

import pg from "pg";

// Marcas de tiempo en TEXTO, no como Date de JS: Postgres guarda microsegundos y el Date
// sólo llega al milisegundo. Con la conversión, la marca de agua se queda un pelo por
// detrás y se reenvía lo mismo en cada pase, para siempre.
pg.types.setTypeParser(1184, (v) => v);
pg.types.setTypeParser(1114, (v) => v);

// ── Lo que NO baja de la nube ────────────────────────────────────────────────
//
// Lo operativo y lo fiscal NACE EN EL BAR. Si lo bajáramos, la nube podría pisar una
// venta — y la regla es que en eso manda el nodo. Las `nodo_*` son la libreta interna
// del nodo y ni siquiera existen en la nube.
export const NO_BAJAR = new Set([
  "sales_order", "order_line", "order_event", "payment", "invoice", "invoice_tax_line",
  "tax_line", "verifactu_record", "ticketbai_record", "cash_session", "cash_move",
  "print_job", "shift", "stock_move", "online_order", "reservation",
  "nodo_migracion", "nodo_sync_estado", "nodo_media_pendiente", "nodo_release", "nodo_sesion",
  "platform_admin", "pago_gluuh", "contact_request",
]);
// `order_event` (quién anuló qué línea, y por qué) es OPERATIVO, no catálogo: nace en el
// bar. Como no estaba aquí, se habría tratado como carta y se habría intentado subir
// eventos de mesas todavía abiertas — cuyo pedido aún no existe en la nube. Clave foránea
// rechazada, y el catálogo entero sin sincronizar por culpa de una mesa a medias.

/** Cómo es el esquema: orden, claves primarias, columnas y tipos. Se pregunta a la BD. */
export async function leerEsquema(bd) {
  // ── El ORDEN: un producto no puede bajar antes que su categoría ─────────────
  // Se deduce de las claves foráneas, no de una lista a mano que se quedaría vieja en
  // cuanto alguien añada una tabla.
  const { rows: fks } = await bd.query(`
    select c.conrelid::regclass::text as hijo, c.confrelid::regclass::text as padre
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'f' and n.nspname = 'public'
       and c.conrelid <> c.confrelid          -- las autorreferencias no ordenan nada
  `);
  const { rows: tablas } = await bd.query(
    "select tablename from pg_tables where schemaname = 'public'",
  );

  const limpio = (s) => s.replace(/^public\./, "");
  const depende = new Map(tablas.map((t) => [t.tablename, new Set()]));
  for (const f of fks) {
    const hijo = limpio(f.hijo);
    const padre = limpio(f.padre);
    if (depende.has(hijo) && depende.has(padre)) depende.get(hijo).add(padre);
  }

  const orden = [];
  const visto = new Set();
  const visitar = (t, pila = new Set()) => {
    if (visto.has(t) || pila.has(t)) return;   // ciclo: se corta y ya
    pila.add(t);
    for (const p of depende.get(t) ?? []) visitar(p, pila);
    pila.delete(t);
    visto.add(t);
    orden.push(t);
  };
  for (const t of depende.keys()) visitar(t);

  // ── Las CLAVES PRIMARIAS de verdad, no "id" a lo bruto ─────────────────────
  // `tenant_branding` va por `tenant_id`, y las tablas de unión tienen clave compuesta.
  // Exigiendo `id` se saltaban en silencio: el bar se quedaba sin logo ni colores.
  const { rows: pks } = await bd.query(`
    select t.relname as tabla, a.attname as columna
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
     where i.indisprimary and n.nspname = 'public'
  `);
  const pkDe = new Map();
  for (const p of pks) {
    if (!pkDe.has(p.tabla)) pkDe.set(p.tabla, []);
    pkDe.get(p.tabla).push(p.columna);
  }

  const { rows: cols } = await bd.query(`
    select table_name, column_name, data_type
      from information_schema.columns where table_schema = 'public'
  `);
  const columnasDe = new Map();
  const tipoDe = new Map();
  for (const c of cols) {
    if (!columnasDe.has(c.table_name)) columnasDe.set(c.table_name, new Set());
    columnasDe.get(c.table_name).add(c.column_name);
    tipoDe.set(`${c.table_name}.${c.column_name}`, c.data_type);
  }

  return { orden, pkDe, columnasDe, tipoDe };
}

/**
 * Adapta un valor del JSON de la nube al tipo REAL de la columna.
 *
 * Un `text[]` de Postgres (p. ej. `product.alergenos`) y un JSON que casualmente es una
 * lista **se ven idénticos desde JavaScript**. Si se serializa el array, Postgres
 * responde «malformed array literal». La única forma de distinguirlos es preguntarle al
 * esquema de qué tipo es la columna.
 */
export function valorPara(esquema, tabla, columna, v) {
  // Los `auth_user_id` de la nube apuntan a cuentas que en el nodo NO EXISTEN (tiene su
  // propia autenticación). Si se copiaran, al entrar un camarero se intentaría actualizar
  // una cuenta inexistente y NADIE PODRÍA ENTRAR AL TPV.
  if (columna === "auth_user_id") return null;

  if (v === null || v === undefined) return null;
  const t = esquema.tipoDe.get(`${tabla}.${columna}`);
  if (!t) return v;
  if (t === "ARRAY") return v;                                  // el driver ya sabe
  if (t === "json" || t === "jsonb") return JSON.stringify(v);
  return typeof v === "object" ? JSON.stringify(v) : v;
}

/**
 * Mete filas de la nube en el nodo.
 *
 * Se hace CON LOS TRIGGERS PUESTOS, y eso es una decisión:
 *
 *   · `set_updated_at` respeta la fecha que trae la fila (migración 0101). Sin ese
 *     arreglo, el trigger le pondría `now()` a cada fila recién bajada, quedaría más
 *     nueva que la de la nube, el nodo la volvería a subir, la nube le pondría `now()`
 *     otra vez… un **ping-pong infinito** con la fecha corriéndose sola.
 *
 *   · Y así el aviso de realtime **salta solo**: el TPV se entera del precio nuevo sin
 *     que nadie tenga que acordarse de avisarle a mano.
 */
export async function meterFilas(bd, esquema, tabla, filas) {
  if (filas.length === 0) return 0;

  const pk = esquema.pkDe.get(tabla);
  if (!pk?.length) return 0;

  const claves = Object.keys(filas[0]);
  const lista = claves.map((k) => `"${k}"`).join(", ");
  const huecos = claves.map((_, i) => `$${i + 1}`).join(", ");
  const conflicto = pk.map((k) => `"${k}"`).join(", ");
  const otras = claves.filter((k) => !pk.includes(k));
  // Una tabla de unión pura (todas sus columnas son la clave) no tiene nada que pisar, y
  // `do update set` sin columnas es un error de sintaxis.
  const alChocar = otras.length
    ? `do update set ${otras.map((k) => `"${k}" = excluded."${k}"`).join(", ")}`
    : "do nothing";

  for (const fila of filas) {
    await bd.query(
      `insert into public."${tabla}" (${lista}) values (${huecos})
       on conflict (${conflicto}) ${alChocar}`,
      claves.map((k) => valorPara(esquema, tabla, k, fila[k])),
    );
  }
  return filas.length;
}

// ── Columnas que el nodo tiene DISTINTAS A PROPÓSITO, y que JAMÁS suben ──────
//
//   · `auth_user_id` — el espejo lo pone a null (ver `valorPara`). Si subiera, dejaría a
//     null el de la nube: **el dueño no podría volver a entrar en el panel desde casa.**
//     Un bar sincronizando su carta habría cerrado la puerta de la nube a su propio dueño.
//   · `password_hash` — la contraseña LOCAL del dueño, la que le deja abrir el panel del
//     bar sin internet. Se queda en el bar.
export const NO_SUBIR_COLUMNAS = new Set(["auth_user_id", "password_hash"]);

/** La clave primaria de una fila, como texto. Vale para pk simple y para pk compuesta. */
export const clavePk = (pk, fila) => pk.map((k) => fila[k]).join("");

/**
 * Qué filas hay AQUÍ y cuándo se tocaron: `clave → updated_at`.
 *
 * Sirve para las dos mitades: decidir quién gana (el bar o la nube) y ver qué se ha
 * borrado. Se lee de una vez por tabla, no fila a fila.
 */
export async function fechasLocales(bd, esquema, tabla, tenantId) {
  const pk = esquema.pkDe.get(tabla);
  const columna = tabla === "tenant" ? "id" : "tenant_id";
  const { rows } = await bd.query(
    `select ${pk.map((k) => `"${k}"`).join(", ")}, updated_at
       from public."${tabla}" where ${columna} = $1`,
    [tenantId],
  );
  return new Map(rows.map((r) => [clavePk(pk, r), r]));
}
