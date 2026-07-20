// EMPAREJAR EL TPV NUEVO (apps/tpv) CON EL NODO, PARA PROBAR EN DEV.
//
// La SPA solo lee/escribe datos reales si tiene una SESIÓN DE DISPOSITIVO en
// localStorage. En un bar la pone el emparejado de verdad (F4). Para dev, este
// script hace lo mismo a mano: vincula un terminal al tenant de trabajo y firma
// su sesión con el secreto del nodo. Luego imprime el snippet para pegarlo en la
// consola del navegador donde corra el TPV.
//
//   node scripts/emparejar-tpv-dev.mjs                # Restaurante de pruebas
//   node scripts/emparejar-tpv-dev.mjs <tenant_uuid>  # otro tenant del nodo
//
// ⚠ Solo toca el Postgres del NODO (55432), como manda la REGLA Nº1. Crea (o
// reusa) UN device de pruebas; no borra nada.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RAIZ = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
const RESTAURANTE_PRUEBAS = "4c792677-c66b-4af8-bd3f-8c2e32031db8";
const tenant = process.argv[2] ?? RESTAURANTE_PRUEBAS;

// El MISMO secreto que valida PostgREST y firma el auth del nodo. Si la firma no
// cuadra con este, PostgREST responde 401 a todo (TRAMPAS §0).
function secretoDelNodo() {
  const env = path.join(RAIZ, ".nodo", "nodo.env");
  if (fs.existsSync(env)) {
    const m = /^NODO_JWT_SECRETO=(.*)$/m.exec(fs.readFileSync(env, "utf8"));
    if (m) return m[1].trim();
  }
  const conf = path.join(RAIZ, ".nodo", "postgrest.conf");
  if (fs.existsSync(conf)) {
    const m = /^jwt-secret\s*=\s*"(.*)"$/m.exec(fs.readFileSync(conf, "utf8"));
    if (m) return m[1];
  }
  throw new Error("No encuentro el secreto del nodo en .nodo/nodo.env ni .nodo/postgrest.conf");
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Mismos claims que `sesionDeDispositivo` en apps/nodo/auth.mjs: el terminal ES
// el sujeto, y `tenant_id` es lo que resuelve la RLS.
function firmarSesion(deviceId, tenantId, secreto) {
  const ahora = Math.floor(Date.now() / 1000);
  const claims = {
    sub: deviceId, aud: "authenticated", role: "authenticated",
    tenant_id: tenantId, device_id: deviceId, user_rol: null,
    is_platform_admin: false, iat: ahora, exp: ahora + 10 * 365 * 24 * 3600,
  };
  const cab = b64({ alg: "HS256", typ: "JWT" });
  const cue = b64(claims);
  const firma = crypto.createHmac("sha256", secreto).update(`${cab}.${cue}`).digest("base64url");
  return `${cab}.${cue}.${firma}`;
}

const c = new pg.Client(BD);
await c.connect();
try {
  const { rows: [t] } = await c.query("select id, nombre from public.tenant where id = $1", [tenant]);
  if (!t) throw new Error(`El tenant ${tenant} no existe en el nodo.`);

  // Un device de pruebas por tenant, reutilizable (idempotente): correr el
  // script dos veces no llena la BD de terminales fantasma.
  const nombre = "TPV Pruebas (dev)";
  const { rows: [existe] } = await c.query(
    "select id from public.device where tenant_id = $1 and nombre = $2", [tenant, nombre]);
  let deviceId = existe?.id;
  if (deviceId) {
    await c.query("update public.device set vinculado_at = now() where id = $1", [deviceId]);
  } else {
    // `location_id` es NOT NULL: se coge el local del propio tenant.
    const { rows: [loc] } = await c.query(
      "select id from public.location where tenant_id = $1 order by created_at limit 1", [tenant]);
    if (!loc) throw new Error(`El tenant ${tenant} no tiene ningún local (location).`);
    const { rows: [d] } = await c.query(
      `insert into public.device (tenant_id, location_id, nombre, tipo, modulo, vinculado_at)
       values ($1, $2, $3, 'TPV', 'TPV', now()) returning id`, [tenant, loc.id, nombre]);
    deviceId = d.id;
  }

  const token = firmarSesion(deviceId, tenant, secretoDelNodo());
  const sesion = JSON.stringify({ access_token: token, device_id: deviceId, device_nombre: nombre });

  console.log(`\n✅ Terminal vinculado a «${t.nombre}»\n`);
  console.log("Pega ESTO en la consola del navegador (F12) donde tengas abierto el TPV,");
  console.log("y recarga la página:\n");
  console.log(`localStorage.setItem(${JSON.stringify("gluuh_sesion_dispositivo")}, ${JSON.stringify(sesion)}); location.reload();\n`);
  console.log("Para volver a modo demo: localStorage.removeItem(\"gluuh_sesion_dispositivo\"); location.reload();\n");
} finally {
  await c.end();
}
