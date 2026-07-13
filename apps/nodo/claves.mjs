// Genera las claves `anon` y `service_role` del NODO.
//
// En Supabase esas "API keys" no son claves opacas: son JWT firmados con el mismo
// secreto que valida PostgREST, con `role` dentro. Por eso el nodo puede fabricar
// las suyas: basta firmar con su GOTRUE_JWT_SECRET / jwt-secret.
//
//   node apps/nodo/claves.mjs "<secreto>"

import { createHmac } from "node:crypto";

const secreto = process.argv[2] ?? process.env.NODO_JWT_SECRET;
if (!secreto) {
  console.error("Uso: node apps/nodo/claves.mjs <secreto-jwt-del-nodo>");
  process.exit(1);
}

const b64 = (o) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");

function firmar(payload) {
  const cabecera = b64({ alg: "HS256", typ: "JWT" });
  const cuerpo = b64(payload);
  const firma = createHmac("sha256", secreto).update(`${cabecera}.${cuerpo}`).digest("base64url");
  return `${cabecera}.${cuerpo}.${firma}`;
}

// 10 años: el nodo de un bar no puede quedarse sin servicio porque caduque una clave
// un domingo por la noche y no haya nadie para renovarla.
const ahora = Math.floor(Date.now() / 1000);
const diez = ahora + 10 * 365 * 24 * 3600;

for (const rol of ["anon", "service_role"]) {
  console.log(`\n${rol.toUpperCase()}:`);
  console.log(firmar({ role: rol, iss: "gluuh-nodo", iat: ahora, exp: diez }));
}
console.log("");
