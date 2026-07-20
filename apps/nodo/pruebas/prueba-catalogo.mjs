// ¿EL CATÁLOGO VIAJA EN LAS DOS DIRECCIONES? Y sobre todo: ¿SE ESTÁ QUIETO CUANDO DEBE?
//
// Lo que se prueba (contra la nube y el nodo de verdad, sin simular nada):
//
//   1. BAJA        — cambias un precio desde casa y el bar se entera.
//   2. SUBE        — cambias un precio en la barra sin línea y la nube se entera.
//   3. GANA EL BAR — si los dos tocan la misma fila, la versión más nueva manda.
//   4. BORRA       — retiras un producto en la nube y desaparece de la carta del bar.
//   5. QUIETO      — y el segundo pase NO MUEVE NADA.
//
// El 5 es el que de verdad importa. Sin él, la fecha de cada fila se va corriendo sola en
// cada pase, el bar se pasa el día bajando y subiendo la misma carta, y los TPV recargan
// la pantalla cada cinco minutos delante de los clientes. Es un fallo que no da ningún
// error: sólo hace que el programa parezca embrujado.
//
//   node apps/nodo/pruebas/prueba-catalogo.mjs

import { execFileSync } from "node:child_process";
import pg from "pg";
import { cabeceras, credenciales } from "../nube.mjs";

pg.types.setTypeParser(1184, (v) => v);
pg.types.setTypeParser(1114, (v) => v);

const NUBE = credenciales().url;
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const bd = new pg.Client({ connectionString: BD });
await bd.connect();

const cab = await cabeceras();
if (!cab) { console.error("Sin credenciales de la nube."); process.exit(1); }

let fallos = 0;
const ok = (b, txt) => { console.log(`  ${b ? "✓" : "✗"} ${txt}`); if (!b) fallos++; };

const nube = async (ruta, init) => {
  const r = await fetch(`${NUBE}/rest/v1/${ruta}`, {
    ...init,
    headers: { ...cab, ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 140)}`);
  return r.status === 204 ? null : r.json();
};

const sincronizar = () =>
  execFileSync("node", ["apps/nodo/sincronizar.mjs"], { encoding: "utf8" });

// El bar contra el que se prueba. Antes era `select id from tenant limit 1`: sin
// ORDER BY y sin filtro, cogía UNO CUALQUIERA — y si el nodo tiene el tenant
// PLANTILLA (el que la nube clona en cada empresa nueva), esta prueba se ponía a
// cambiar precios y a borrar productos EN LA PLANTILLA DE PRODUCCIÓN.
// Ahora: se puede fijar con NODO_TENANT, y la plantilla queda excluida siempre.
const { rows: candidatos } = await bd.query(
  `select id, nombre, coalesce(es_plantilla,false) es_plantilla
     from public.tenant
    where ($1::uuid is null or id = $1::uuid)
    order by created_at`,
  [process.env.NODO_TENANT ?? null],
);
const elegido = candidatos.find((t) => !t.es_plantilla);
if (!elegido) {
  const porQue = candidatos.length
    ? "el único tenant de este nodo es la PLANTILLA, y no se toca: es la que la nube clona en cada empresa nueva"
    : "este nodo no tiene ningún bar";
  console.error(`\n⚠️  Prueba no ejecutada — ${porQue}.`);
  console.error("   Crea uno:  node scripts/sembrar-restaurante.mjs   (o fija NODO_TENANT=<uuid>)");
  await bd.end();
  process.exit(2);
}
const tenantId = elegido.id;
console.log(`\nBar ${tenantId.slice(0, 8)}… «${elegido.nombre}»\n`);

// Se parte de un pase limpio: así lo que se mueva después es SÓLO lo que provoque la
// prueba, y no la deuda que hubiera pendiente de antes.
sincronizar();

// ── 1. BAJA: el dueño cambia el precio desde casa ────────────────────────────
console.log("1. El dueño cambia un precio desde casa");

const [prod] = await nube(`product?select=id,nombre,precio&tenant_id=eq.${tenantId}&limit=1`);
const precioViejo = Number(prod.precio);
const precioNuevo = Number((precioViejo + 1.11).toFixed(2));

await nube(`product?id=eq.${prod.id}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", prefer: "return=minimal" },
  body: JSON.stringify({ precio: precioNuevo }),
});

sincronizar();
const { rows: [enElBar] } = await bd.query("select precio from public.product where id = $1", [prod.id]);
ok(Number(enElBar.precio) === precioNuevo,
   `"${prod.nombre}" ${precioViejo} → ${precioNuevo} y el bar lo tiene: ${enElBar.precio}`);

// ── 2. QUIETO: el segundo pase no mueve nada ────────────────────────────────
console.log("\n2. Y el pase siguiente NO mueve nada (el ping-pong)");

const salida = sincronizar();
const linea = salida.split("\n").find((l) => l.includes("catálogo")) ?? "";
ok(/0 bajada\(s\), 0 subida\(s\), 0 borrada\(s\)/.test(linea),
   `nada que hacer:  ${linea.trim()}`);

// ── 3. SUBE: y ahora el dueño lo cambia EN LA BARRA, sin internet ───────────
console.log("\n3. El dueño lo cambia en la barra (sin línea)");

const precioDeBarra = Number((precioViejo + 2.22).toFixed(2));
await bd.query("update public.product set precio = $2 where id = $1", [prod.id, precioDeBarra]);

sincronizar();
const [enLaNube] = await nube(`product?select=precio&id=eq.${prod.id}`);
ok(Number(enLaNube.precio) === precioDeBarra,
   `${precioNuevo} → ${precioDeBarra} en la barra, y la nube lo tiene: ${enLaNube.precio}`);

// ── 4. BORRA: el dueño retira un producto ───────────────────────────────────
console.log("\n4. El dueño retira un producto de la carta");

const creado = await nube("product", {
  method: "POST",
  headers: { "content-type": "application/json", prefer: "return=representation" },
  body: JSON.stringify({
    tenant_id: tenantId, nombre: "PRUEBA — bórrame", precio: 1, disponible: true,
  }),
});
const id = creado[0].id;

sincronizar();
const { rowCount: llego } = await bd.query("select 1 from public.product where id = $1", [id]);
ok(llego === 1, "el producto nuevo llega al bar");

await nube(`product?id=eq.${id}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
sincronizar();
const { rowCount: sigue } = await bd.query("select 1 from public.product where id = $1", [id]);
ok(sigue === 0, "y al borrarlo en la nube, desaparece de la carta del bar");

// ── 5. LO QUE NACE EN EL BAR NO SE BORRA SOLO ───────────────────────────────
//
// El cerrojo 3 de `propagarBorrados`. Sin él, el producto que el dueño crea en la barra
// sin internet **se borraría solo** en el primer pase con línea: no está en la nube, luego
// "lo han borrado". Es el fallo más traicionero de todo el sincronizador — el dueño ve
// desaparecer lo que acaba de escribir y no hay ni un error en ningún log.
console.log("\n5. Lo que el dueño crea EN EL BAR no se borra solo");

const { rows: [local] } = await bd.query(
  `insert into public.product (tenant_id, nombre, precio, disponible)
        values ($1, 'PRUEBA — nacido en el bar', 3.50, true) returning id`,
  [tenantId],
);

sincronizar();
const { rowCount: vive } = await bd.query("select 1 from public.product where id = $1", [local.id]);
ok(vive === 1, "sigue en el bar");
const enNube = await nube(`product?select=id&id=eq.${local.id}`);
ok(enNube.length === 1, "y ha subido a la nube");

// ── Limpieza ────────────────────────────────────────────────────────────────
await nube(`product?id=eq.${local.id}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
await nube(`product?id=eq.${prod.id}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", prefer: "return=minimal" },
  body: JSON.stringify({ precio: precioViejo }),
});
sincronizar();

console.log(fallos === 0
  ? "\nEl catálogo viaja en las dos direcciones, borra lo que hay que borrar, y se está quieto.\n"
  : `\n${fallos} fallo(s).\n`);

await bd.end();
process.exit(fallos === 0 ? 0 : 1);
