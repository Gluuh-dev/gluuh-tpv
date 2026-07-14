// EL SECRETO DE ESTE NODO, Y LAS CLAVES QUE SALEN DE ÉL.
//
// Cada bar tiene el suyo, aleatorio, generado por el instalador. Antes era uno fijo para
// todos… y estaba en el repositorio y en el manual: cualquiera que lo leyera podía firmar
// un token de administrador válido para CUALQUIER nodo al que llegara por red.
//
// De aquí salen las claves `anon` y `service_role`: en Supabase esas "API keys" no son
// claves opacas, sino JWT firmados con el mismo secreto que valida PostgREST, con el
// `role` dentro. Por eso el nodo puede fabricar las suyas.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RAIZ = path.resolve(".");

export function secretoDelNodo() {
  const env = path.join(RAIZ, ".nodo", "nodo.env");
  if (fs.existsSync(env)) {
    const m = /^NODO_JWT_SECRETO=(.*)$/m.exec(fs.readFileSync(env, "utf8"));
    if (m) return m[1].trim();
  }
  // De donde manda de verdad: lo que valida PostgREST.
  const conf = path.join(RAIZ, ".nodo", "postgrest.conf");
  if (fs.existsSync(conf)) {
    const m = /^jwt-secret\s*=\s*"(.*)"$/m.exec(fs.readFileSync(conf, "utf8"));
    if (m) return m[1];
  }
  throw new Error("No encuentro el secreto JWT del nodo (.nodo/nodo.env o postgrest.conf)");
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

/**
 * Una clave de las que usa el TPV. Diez años de vida a propósito: el TPV de un bar no
 * puede dejar de funcionar un domingo por la noche porque caducara una clave y no hubiera
 * nadie para renovarla.
 */
export function firmar(rol, secreto = secretoDelNodo()) {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64({ alg: "HS256", typ: "JWT" });
  const cue = b64({ role: rol, iss: "gluuh-nodo", iat: ahora, exp: ahora + 10 * 365 * 24 * 3600 });
  return `${cab}.${cue}.${crypto.createHmac("sha256", secreto).update(`${cab}.${cue}`).digest("base64url")}`;
}

/**
 * La URL REAL de Supabase. Hace falta aunque no haya internet: es la que se guarda en la
 * base de datos al subir una foto (la canónica). El dato que se sincroniza no puede
 * llevar dentro una dirección de la red local del bar. Ver `urlFoto` y `subirMedia`.
 */
export function urlNube() {
  const env = path.join(RAIZ, ".nodo", "sync.env");
  if (!fs.existsSync(env)) return "";
  const m = /^SUPABASE_URL=(.*)$/m.exec(fs.readFileSync(env, "utf8"));
  return m ? m[1].trim() : "";
}
