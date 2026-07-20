// EL NODO FIRMA SUS PROPIOS TOKENS. GoTrue se fue.
//
// Comprueba, contra el nodo de verdad, las cuatro cosas que importan:
//
//   1. El CAMARERO entra con su PIN (vale de un solo uso) → y la RLS le da SU bar.
//   2. El vale es de UN SOLO USO: el segundo intento con el mismo, rebotado.
//   3. El DUEÑO entra con email + contraseña SIN INTERNET  ← esto ANTES NO SE PODÍA:
//      su contraseña sólo existía en el GoTrue de la nube.
//   4. El refresh token ROTA: el viejo deja de valer en cuanto se usa.
//
//   node apps/nodo/pruebas/prueba-auth-sin-gotrue.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import { exigirNodoVivo, noConcluyente, barDePrueba, borrarBar } from "./ayuda.mjs";

// Si el nodo no atiende peticiones autenticadas, nada de lo de abajo concluye.
await exigirNodoVivo();

const NODO = "http://127.0.0.1:54321";
const bd = new pg.Client({ connectionString: "postgres://postgres:gluuh@127.0.0.1:55432/gluuh" });
await bd.connect();

// La clave de servicio de ESTE nodo (para pedir vales, como hace /api/entrar-operario).
const secreto = /^NODO_JWT_SECRETO=(.*)$/m.exec(fs.readFileSync(".nodo/nodo.env", "utf8"))[1].trim();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const firmar = (rol) => {
  const ahora = Math.floor(Date.now() / 1000);
  const c = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role: rol, iss: "gluuh-nodo", iat: ahora, exp: ahora + 3600 });
  return `${c}.${p}.${crypto.createHmac("sha256", secreto).update(`${c}.${p}`).digest("base64url")}`;
};
const SERVICIO = firmar("service_role");
const ANON = firmar("anon");

const post = (ruta, cuerpo, tok) =>
  fetch(`${NODO}${ruta}`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(cuerpo),
  });

let fallos = 0;
const comprobar = (bien, texto) => {
  console.log(`   ${bien ? "OK " : "MAL"}  ${texto}`);
  if (!bien) fallos++;
};

// ── El bar: SUYO, creado aquí ────────────────────────────────────────────────
//
// Antes cogía un operario CUALQUIERA del nodo (`... limit 1`) y un usuario con
// email CUALQUIERA. Dos problemas:
//   · salía el de la PLANTILLA, cuya carta está vacía, y «la RLS le enseña su
//     carta» fallaba por falta de datos — no por un fallo de verdad;
//   · y al dueño elegido se le SOBRESCRIBÍA LA CONTRASEÑA con la de la prueba.
//     Si tocaba el de un bar real, se quedaba sin poder entrar.
// Con su propio bar, la prueba es determinista y no toca datos de nadie.
const bar = await barDePrueba(bd, "Bar de la prueba de auth");
const { rows: [op] } = await bd.query(
  `insert into public.app_user (tenant_id, nombre, rol, activo, clave_hash)
   values ($1, 'Camarero de prueba', 'CAMARERO', true, crypt('no-se-usa', gen_salt('bf')))
   returning id, nombre, tenant_id`,
  [bar.tenantId],
);
// Un producto, para que «¿ve su carta?» compruebe algo de verdad.
await bd.query(
  `insert into public.product (tenant_id, nombre, precio, clase_fiscal, tipo_impositivo)
   values ($1, 'Caña de prueba', 2.00, 'GENERAL', public.resolver_iva('GENERAL', 'CANARIAS'))`,
  [bar.tenantId],
);

console.log(`Empleado de prueba: ${op.nombre}\n`);

// ── 1. El camarero entra (vale de un solo uso) ───────────────────────────────
console.log("1. El camarero entra con su PIN (el TPV ya lo validó y pide un vale)");
const rVale = await post("/auth/v1/vale", { app_user_id: op.id }, SERVICIO);
const { vale } = await rVale.json();
comprobar(rVale.ok && !!vale, "el nodo emite el vale");

const rEntrar = await post("/auth/v1/token?grant_type=password", { email: "x@codigo.gluuh.local", password: vale });
const sesion = await rEntrar.json();
comprobar(rEntrar.ok && !!sesion.access_token, "el vale se canjea por una sesión");

// Sin token no hay claims que mirar: cortar con un motivo, no reventar con un
// TypeError que hace pensar que la prueba está rota cuando lo está el nodo.
if (!sesion.access_token) {
  noConcluyente(
    `el nodo no devolvió sesión al canjear el vale (HTTP ${rEntrar.status}): ${JSON.stringify(sesion).slice(0, 160)}`,
    "Revisa la auth del nodo y su secreto JWT.",
  );
}

const claims = JSON.parse(Buffer.from(sesion.access_token.split(".")[1], "base64url"));
comprobar(claims.tenant_id === op.tenant_id, `el token lleva SU bar (${claims.tenant_id?.slice(0, 8)}…)`);
comprobar(claims.role === "authenticated", "y el rol correcto");

// La RLS de verdad: con ese token, ¿ve la carta de su bar?
const rCarta = await fetch(`${NODO}/rest/v1/product?select=nombre&limit=5`, {
  headers: { apikey: ANON, authorization: `Bearer ${sesion.access_token}` },
});
const carta = await rCarta.json();
comprobar(Array.isArray(carta) && carta.length > 0, `la RLS le enseña su carta (${carta.length} productos)`);

// ── 2. El vale es de UN SOLO USO ─────────────────────────────────────────────
console.log("\n2. El mismo vale, otra vez (alguien lo ha visto pasar)");
const rOtraVez = await post("/auth/v1/token?grant_type=password", { email: "x@codigo.gluuh.local", password: vale });
comprobar(rOtraVez.status === 400, "RECHAZADO: un vale se usa una vez y ya");

// ── 3. El DUEÑO entra SIN INTERNET ───────────────────────────────────────────
console.log("\n3. El DUEÑO entra al panel del bar SIN INTERNET (antes: imposible)");
// El dueño DE ESTE bar (el que creó barDePrueba), no uno cualquiera del nodo:
// más abajo se le fija la contraseña, y hacerlo sobre el de un bar real lo dejaría
// sin poder entrar.
const { rows: [duenyo] } = await bd.query(
  "select id, email, nombre from public.app_user where tenant_id = $1 and email is not null limit 1",
  [bar.tenantId],
);
if (!duenyo) {
  comprobar(false, "no hay ningún usuario con email en el nodo");
} else {
  // El instalador siembra su contraseña local. Aquí se simula.
  await bd.query("select public.fijar_password_local($1, $2)", [duenyo.email, "SuContrasena123"]);

  const rDuenyo = await post("/auth/v1/token?grant_type=password", {
    email: duenyo.email,
    password: "SuContrasena123",
  });
  const s2 = await rDuenyo.json();
  comprobar(rDuenyo.ok && !!s2.access_token, `${duenyo.email} entra con su contraseña`);

  const rMala = await post("/auth/v1/token?grant_type=password", {
    email: duenyo.email,
    password: "la-que-no-es",
  });
  comprobar(rMala.status === 400, "y con la contraseña mal, RECHAZADO");
}

// ── 4. El refresh token ROTA ─────────────────────────────────────────────────
console.log("\n4. El token caduca en 1 h: se renueva con el refresco");
const rRenovar = await post("/auth/v1/token?grant_type=refresh_token", { refresh_token: sesion.refresh_token });
const s3 = await rRenovar.json();
comprobar(rRenovar.ok && !!s3.access_token, "el refresco da una sesión nueva");

const rViejo = await post("/auth/v1/token?grant_type=refresh_token", { refresh_token: sesion.refresh_token });
comprobar(rViejo.status === 400, "y el refresco VIEJO ya no vale (rota en cada uso)");

// ── Y GoTrue... ──────────────────────────────────────────────────────────────
console.log("\n5. ¿Queda algún GoTrue vivo?");
comprobar(!fs.existsSync(".nodo/gotrue.env"), "no hay gotrue.env");

console.log("\n" + "═".repeat(64));
console.log(fallos === 0
  ? "✅ El nodo firma sus propios tokens. Camarero y DUEÑO entran sin internet.\n   Sin GoTrue: sin fork de Go, sin 50 MB, sin las dos trampas."
  : `❌ ${fallos} comprobación(es) han fallado.`);
console.log("═".repeat(64));

// El bar de la prueba se lleva por delante su operario, su carta y su dueño (FK en cascada).
await borrarBar(bd, bar.tenantId);
await bd.end();
process.exit(fallos === 0 ? 0 : 1);
