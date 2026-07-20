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
 * Corta la prueba dejando claro que NO ha comprobado nada. Sale con código 2
 * (≠ 1, que es un fallo de verdad) para que un script sepa distinguirlos.
 */
export function noConcluyente(motivo, pista) {
  console.log("\n" + "═".repeat(64));
  console.log("⚠️  PRUEBA NO CONCLUYENTE — no ha llegado a comprobar nada.");
  console.log(`   ${motivo}`);
  if (pista) for (const l of pista.split("\n")) console.log(`   ${l}`);
  console.log("═".repeat(64));
  process.exit(2);
}

/**
 * Exige que el nodo responda a peticiones AUTENTICADAS antes de dar por válida
 * ninguna prueba que vaya por HTTP.
 *
 * Por qué existe: si PostgREST rechaza la sesión, TODAS las lecturas devuelven 0
 * filas — y una prueba de aislamiento interpreta ese 0 como «no veo lo del otro»
 * y canta ✅, o como «no veo lo mío» y canta ❌ FUGA. Las dos conclusiones son
 * mentira: no ha podido leer. Un test de seguridad que miente es peor que ninguno.
 */
export async function exigirNodoVivo() {
  let r;
  try {
    r = await fetch(`${NODO}/rest/v1/tenant?select=id&limit=1`, {
      headers: { apikey: SERVICIO, authorization: `Bearer ${SERVICIO}` },
    });
  } catch (e) {
    noConcluyente(
      `no se puede hablar con el nodo (${NODO}): ${e.message}`,
      "¿Está arrancado?  .\\supabase\\nodo\\arrancar-nodo.ps1",
    );
    return;
  }
  if (r.status === 401 || r.status === 403) {
    const cuerpo = await r.text().catch(() => "");
    const jwt = /PGRST301|decode the JWT|wrong key/i.test(cuerpo);
    noConcluyente(
      `el nodo RECHAZA la sesión (HTTP ${r.status})${jwt ? " — no puede decodificar el JWT" : ""}`,
      jwt
        ? "PostgREST corre con un secreto JWT DISTINTO del de .nodo/nodo.env.\n"
          + "Pasa tras reinstalar: quedan servicios ELEVADOS con el secreto viejo.\n"
          + "Arréglalo reiniciando Windows (mueren solos) o relanzando arrancar-nodo.ps1."
        : cuerpo.slice(0, 200),
    );
    return;
  }
  if (!r.ok) {
    noConcluyente(`el nodo responde HTTP ${r.status} a una lectura de servicio`, "Revisa los servicios del nodo.");
  }
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

  // ENLAZAR la ficha de empleado con el usuario de auth recién creado.
  //
  // Sin esto el `app_user` queda con `auth_user_id` NULL, y entonces
  // `operario_permite()` NO ENCUENTRA a quien pregunta: como es fail-closed (0113),
  // devuelve false y la RLS deniega hasta escribir en SU PROPIO bar (403 en el
  // `category_ins_cat`). Las pruebas parecían destapar un fallo de permisos cuando
  // lo que fallaba era el andamiaje: un empleado de verdad SIEMPRE está enlazado.
  const sub = JSON.parse(Buffer.from(sesion.access_token.split(".")[1], "base64url")).sub;
  await bd.query("update public.app_user set auth_user_id = $2 where tenant_id = $1", [t.id, sub]);

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
