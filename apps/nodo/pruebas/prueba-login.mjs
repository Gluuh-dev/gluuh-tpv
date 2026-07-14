// ¿Puede un camarero entrar al TPV del nodo?
//
// Reproduce EXACTAMENTE lo que hace /api/entrar-operario contra el nodo:
//   1. crea (o actualiza) la cuenta sintética del operario en GoTrue, con la clave de
//      servicio del NODO (no la de la nube: son mundos distintos)
//   2. inicia sesión con ella
//   3. y con ese token pide datos: la RLS tiene que resolver el tenant
import { createHmac } from "node:crypto";

const NODO = "http://127.0.0.1:54321";
const SECRETO = "clave-jwt-de-desarrollo-del-nodo-gluuh-min-32-chars";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const firmar = (rol) => {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64({ alg: "HS256", typ: "JWT" });
  const cue = b64({ role: rol, iss: "gluuh-nodo", iat: ahora, exp: ahora + 3600 });
  return `${cab}.${cue}.${createHmac("sha256", SECRETO).update(`${cab}.${cue}`).digest("base64url")}`;
};

const SERVICIO = firmar("service_role");
const ANON = firmar("anon");

// El email sintético del operario (así los fabrica el TPV: nunca un correo real)
const email = `operario.prueba@codigo.gluuh.local`;
const pass = "clave-de-sesion-larga-y-aleatoria";

console.log("1. Crear la cuenta del operario en el GoTrue del NODO…");
const crear = await fetch(`${NODO}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SERVICIO, authorization: `Bearer ${SERVICIO}`, "content-type": "application/json" },
  body: JSON.stringify({ email, password: pass, email_confirm: true }),
});
const usuario = await crear.json();
if (!crear.ok && crear.status !== 422) {
  console.error(`   FALLA (HTTP ${crear.status}):`, JSON.stringify(usuario).slice(0, 200));
  process.exit(1);
}
console.log(`   ${crear.status === 422 ? "ya existía" : "creada"}: ${usuario.email ?? email}`);

console.log("2. El TPV inicia sesión con esa cuenta…");
const entrar = await fetch(`${NODO}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({ email, password: pass }),
});
const sesion = await entrar.json();
if (!entrar.ok) {
  console.error(`   FALLA (HTTP ${entrar.status}):`, JSON.stringify(sesion).slice(0, 200));
  process.exit(1);
}
console.log("   dentro. token recibido.");

console.log("3. Con ese token, pedir la carta (aquí manda la RLS)…");
const carta = await fetch(`${NODO}/rest/v1/product?select=nombre&limit=3`, {
  headers: { apikey: ANON, authorization: `Bearer ${sesion.access_token}` },
});
const prods = await carta.json();
console.log(`   productos visibles: ${Array.isArray(prods) ? prods.length : 0}`);

// El operario de prueba NO está en app_user, así que no tiene tenant: la RLS debe
// devolverle CERO. Eso no es un fallo — es la prueba de que la RLS está viva.
console.log(
  Array.isArray(prods) && prods.length === 0
    ? "\n✅ Login OK contra el nodo. Y la RLS hace su trabajo: sin bar asignado, no ve NADA."
    : `\n⚠️ Ve ${prods.length} productos sin estar asignado a ningún bar — revisar RLS.`,
);
