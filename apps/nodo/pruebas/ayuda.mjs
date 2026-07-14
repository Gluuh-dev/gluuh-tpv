// Lo común a las pruebas del nodo.
//
// Antes cada prueba creaba su bar con `auth.signUp` — la vía de GoTrue. El nodo ya no la
// ofrece, y es correcto: **un bar se PROVISIONA desde la nube, nadie se registra en el
// servidor de un bar**. Así que las pruebas crean su bar directamente en la base de
// datos, que es lo que hace el provisionador, y piden sesión a la auth del nodo.

import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

export const NODO = "http://127.0.0.1:54321";
export const BD = "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

// El secreto de ESTE nodo. Ya no hay uno fijo: el instalador genera uno aleatorio por bar
// (si no, la clave del manual abriría cualquier nodo — ver plan/12 · A5).
export const SECRETO = /^NODO_JWT_SECRETO=(.*)$/m
  .exec(fs.readFileSync(".nodo/nodo.env", "utf8"))[1].trim();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function firmar(rol) {
  const ahora = Math.floor(Date.now() / 1000);
  const c = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role: rol, iss: "gluuh-nodo", iat: ahora, exp: ahora + 3600 });
  return `${c}.${p}.${crypto.createHmac("sha256", SECRETO).update(`${c}.${p}`).digest("base64url")}`;
}

export const ANON = firmar("anon");
export const SERVICIO = firmar("service_role");

export async function conectar() {
  const bd = new pg.Client({ connectionString: BD });
  await bd.connect();
  return bd;
}

/**
 * Un bar de prueba: empresa + local + dueño con contraseña, y su sesión ya iniciada
 * contra la auth del nodo. Es lo que deja el provisionador, en pequeño.
 */
export async function barDePrueba(bd, nombre) {
  const marca = Math.floor(Math.random() * 999999);
  const email = `duenyo${marca}@prueba.local`;
  const clave = "Prueba1234!";

  const { rows: [t] } = await bd.query(
    "insert into public.tenant (nombre, plan, email_admin) values ($1, 'FREE', $2) returning id",
    [nombre, email],
  );
  const { rows: [l] } = await bd.query(
    `insert into public.location (tenant_id, nombre, cif, razon_social, territorio_fiscal, serie_factura)
          values ($1, $2, 'B00000000', $2, 'CANARIAS', 'F') returning id`,
    [t.id, nombre],
  );
  await bd.query(
    `insert into public.app_user (tenant_id, nombre, email, rol, activo)
          values ($1, 'Titular', $2, 'PROPIETARIO', true)`,
    [t.id, email],
  );
  await bd.query("select public.fijar_password_local($1, $2)", [email, clave]);

  const r = await fetch(`${NODO}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password: clave }),
  });
  if (!r.ok) throw new Error(`no se pudo iniciar sesión en el bar de prueba: HTTP ${r.status}`);
  const sesion = await r.json();

  return { tenantId: t.id, locationId: l.id, email, sesion };
}

/** Se lleva por delante el bar de prueba y todo lo suyo (las FK van en cascada). */
export async function borrarBar(bd, tenantId) {
  await bd.query("delete from public.tenant where id = $1", [tenantId]);
}

/** Una llamada al nodo con la sesión de un bar. */
export const conSesion = (sesion) => ({
  apikey: ANON,
  authorization: `Bearer ${sesion.access_token}`,
  "content-type": "application/json",
});
