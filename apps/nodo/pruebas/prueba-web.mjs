// UN TPV VIRGEN, SIN CONFIGURAR NADA.
//
// El nodo sirve la web Y los datos por el mismo puerto. Un TPV nuevo abre
// `http://<ip-del-nodo>:54321` y funciona: no hay `.env.local` que rellenar, ni IP que
// teclear, ni claves que copiar.
//
// Antes hacían falta CUATRO variables por terminal — y equivocarse en una (poner la clave
// de la nube donde va la del nodo) dejaba a los camareros fuera sin decir por qué.
//
// Esto comprueba, contra el nodo de verdad:
//   1. la web se sirve
//   2. el HTML trae la configuración del bar inyectada (una sola compilación para todos)
//   3. con esa configuración se entra y la RLS da los datos del bar
//   4. la interfaz llega ENTERA (CSS y JS): la trampa del standalone
//
//   node apps/nodo/pruebas/prueba-web.mjs
import pg from "pg";
import { NODO, SERVICIO } from "./ayuda.mjs";

let fallos = 0;
const comprobar = (bien, texto) => {
  console.log(`   ${bien ? "OK " : "MAL"}  ${texto}`);
  if (!bien) fallos++;
};

// ── 1. ¿Se sirve la web? ─────────────────────────────────────────────────────
console.log("1. Un TPV abre la dirección del servidor y ya");
const r = await fetch(`${NODO}/tpv`);
const html = await r.text();
comprobar(r.ok, `GET ${NODO}/tpv → HTTP ${r.status}`);

// ── 2. ¿Trae la configuración del bar? ───────────────────────────────────────
console.log("\n2. El HTML trae la configuración de ESTE bar, inyectada al vuelo");
const m = /window\.__GLUUH__=JSON\.parse\((".*?")\)/.exec(html);
comprobar(!!m, "el nodo inyecta window.__GLUUH__");

let cfg = null;
if (m) {
  cfg = JSON.parse(JSON.parse(m[1]));
  comprobar(cfg.nodo === true, "dice que estamos en un nodo");
  comprobar(!!cfg.clave, `trae la clave de este bar (${cfg.clave.slice(0, 12)}…)`);
  comprobar(cfg.url === "", "y la URL vacía: el MISMO origen (nada que teclear)");
}

// Y lo importante: esa clave NO está incrustada al compilar. Es de este nodo.
console.log("\n3. Esa clave es de ESTE nodo, no de la compilación");
const rConfig = await fetch(`${NODO}/nodo/config`);
const cfgHttp = await rConfig.json();
comprobar(cfgHttp.clave === cfg?.clave, "coincide con la que sirve /nodo/config");

// ── 4. Con esa clave, ¿se entra y la RLS da los datos? ───────────────────────
console.log("\n4. Con esa clave (la que usaría el navegador), ¿funciona el TPV?");
const bd = new pg.Client({ connectionString: "postgres://postgres:gluuh@127.0.0.1:55432/gluuh" });
await bd.connect();
const { rows: [op] } = await bd.query(
  "select id, nombre from public.app_user where email is null and clave_hash is not null limit 1",
);

// Un camarero entra: el TPV valida el PIN (aquí lo damos por hecho) y canjea un vale.
const rVale = await fetch(`${NODO}/auth/v1/vale`, {
  method: "POST",
  headers: { apikey: SERVICIO, authorization: `Bearer ${SERVICIO}`, "content-type": "application/json" },
  body: JSON.stringify({ app_user_id: op.id }),
});
const { vale } = await rVale.json();

const rSesion = await fetch(`${NODO}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: cfg.clave, "content-type": "application/json" },
  body: JSON.stringify({ email: "x@codigo.gluuh.local", password: vale }),
});
const sesion = await rSesion.json();
comprobar(rSesion.ok, `${op.nombre} entra usando la clave que sirvió el nodo`);

const rCarta = await fetch(`${NODO}/rest/v1/product?select=nombre&limit=5`, {
  headers: { apikey: cfg.clave, authorization: `Bearer ${sesion.access_token}` },
});
const carta = await rCarta.json();
comprobar(Array.isArray(carta) && carta.length > 0, `y ve su carta (${carta.length} productos)`);
await bd.end();

// ── 5. La trampa del standalone: ¿llega el CSS y el JS? ──────────────────────
console.log("\n5. ¿Llega la interfaz ENTERA? (Next NO copia `static` al standalone)");
const assets = [...html.matchAll(/\/_next\/static\/[^"']+/g)].map((x) => x[0]);
comprobar(assets.length > 0, `el HTML pide ${assets.length} ficheros de /_next/static`);

let servidos = 0;
for (const a of assets.slice(0, 5)) {
  const ra = await fetch(`${NODO}${a}`);
  if (ra.ok) servidos++;
}
comprobar(servidos === Math.min(5, assets.length),
  `y el nodo los sirve (${servidos}/${Math.min(5, assets.length)} comprobados) — sin esto: página en blanco`);

console.log("\n" + "═".repeat(66));
console.log(fallos === 0
  ? "✅ Un TPV virgen abre la dirección del bar y FUNCIONA.\n   Cero ficheros de configuración en la terminal."
  : `❌ ${fallos} comprobación(es) han fallado.`);
console.log("═".repeat(66));
process.exit(fallos === 0 ? 0 : 1);
