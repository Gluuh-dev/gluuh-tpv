// Prueba adversarial de identidad (F1; doc 20 §11). Contra el Postgres del nodo
// 127.0.0.1:55432/gluuh — ÚNICO destino autorizado (REGLA Nº 1).
//
// ANTES de aplicar 0111–0114 esta prueba DEBE FALLAR (demuestra el problema:
// fail-open y tenant por LIMIT 1). Después, debe pasar entera.
//
//   node apps/nodo/pruebas/prueba-identidad-fail-closed.mjs
import pg from "pg";
import { randomUUID } from "node:crypto";

const c = new pg.Client({
  host: "127.0.0.1", port: 55432, database: "gluuh",
  user: process.env.PGUSER ?? "postgres", password: process.env.PGPASSWORD,
});
await c.connect();
const { rows: [donde] } = await c.query("select current_database() db, inet_server_port() p");
if (donde.db !== "gluuh" || Number(donde.p) !== 55432) {
  console.error(`Destino inesperado ${donde.db}:${donde.p}; abortando.`);
  process.exit(2);
}

let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? "  ✔" : "  ✘"} ${nombre}`);
  if (!cond) fallos++;
};

// Función auxiliar: ejecutar una consulta simulando una petición PostgREST de un
// usuario autenticado (claims en la GUC que leen auth.uid()/current_tenant_id()).
async function comoUsuario(authUid, sql, sessionId = null) {
  await c.query("begin");
  try {
    const claims = { sub: authUid, role: "authenticated", ...(sessionId ? { session_id: sessionId } : {}) };
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await c.query("select set_config('role', 'authenticated', true)");
    const r = await c.query(sql);
    return r.rows;
  } finally {
    await c.query("rollback");
  }
}

// ── fixtures desechables (se limpian al final) ────────────────────────────────
const marca = randomUUID().slice(0, 8);
const authA = randomUUID();
const { rows: [tA] } = await c.query("insert into public.tenant (nombre) values ($1) returning id", [`PRUEBA A ${marca}`]);
const { rows: [tB] } = await c.query("insert into public.tenant (nombre) values ($1) returning id", [`PRUEBA B ${marca}`]);

try {
  console.log("1) tenant ambiguo → NULL (hoy: LIMIT 1 arbitrario)");
  // La misma cuenta auth con membresía en A y en B. Con la unicidad global vieja
  // el segundo insert FALLA — eso también es el bug (multiempresa imposible).
  await c.query(
    "insert into public.app_user (tenant_id, nombre, rol, activo, auth_user_id) values ($1,'Duplicada','ENCARGADO',true,$2)",
    [tA.id, authA],
  );
  let multiempresa = true;
  try {
    await c.query(
      "insert into public.app_user (tenant_id, nombre, rol, activo, auth_user_id) values ($1,'Duplicada','ENCARGADO',true,$2)",
      [tB.id, authA],
    );
  } catch (e) {
    multiempresa = false;
    console.log(`     (la unicidad global impide la segunda membresía: ${e.message.slice(0, 60)})`);
  }
  ok("una cuenta puede pertenecer a dos empresas (contract 1.5 retira la unicidad global)", multiempresa);
  if (multiempresa) {
    const filas = await comoUsuario(authA, "select public.current_tenant_id() t");
    ok("con dos membresías y sin contexto, current_tenant_id() es NULL", filas[0].t === null);
  }

  console.log("2) fail-closed: usuario sin perfil no puede acciones sensibles (hoy: todo permitido)");
  const authSin = randomUUID();
  await c.query(
    "insert into public.app_user (tenant_id, nombre, rol, activo, auth_user_id) values ($1,'Sin Perfil','CAMARERO',true,$2)",
    [tA.id, authSin],
  );
  const permiso = await comoUsuario(authSin, "select public.operario_permite('descuento') p");
  ok("operario_permite('descuento') = false para camarero sin perfil", permiso[0].p === false);
  const permisoInventado = await comoUsuario(authSin, "select public.operario_permite('permiso_inexistente') p");
  ok("clave ausente = denegado", permisoInventado[0].p === false);

  console.log("3) RPC privilegiadas acotadas por tenant (0114)");
  const { rows: [locB] } = await c.query(
    "insert into public.location (tenant_id, nombre) values ($1,'Local B') returning id", [tB.id],
  );
  let cruzo = false;
  try {
    // Un usuario del tenant A intenta abrir jornada en un local del tenant B.
    await comoUsuario(authSin, `select public.jornada_abierta('${locB.id}') j`);
    cruzo = true;
  } catch { /* denegado: correcto */ }
  ok("tenant A no puede abrir jornada del tenant B", !cruzo);

  console.log("4) heartbeat no manipula dispositivos ajenos (0114)");
  const { rows: [devB] } = await c.query(
    "insert into public.device (tenant_id, location_id, tipo, modulo, nombre) values ($1,$2,'TPV','TPV','TPV ajeno') returning id",
    [tB.id, locB.id],
  );
  let latioAjeno = false;
  try {
    await comoUsuario(authSin, `select public.device_heartbeat('${devB.id}', 'hack')`);
    const { rows: [d] } = await c.query("select ultima_conexion from public.device where id = $1", [devB.id]);
    latioAjeno = d.ultima_conexion !== null;
  } catch { /* denegado: correcto */ }
  ok("usuario de A no marca en línea un TPV de B", !latioAjeno);
} finally {
  await c.query("delete from public.tenant where id in ($1,$2)", [tA.id, tB.id]);
  await c.end();
}

console.log(fallos === 0 ? "\nTODO VERDE" : `\n${fallos} FALLO(S) — esperado ANTES de aplicar 0111–0114`);
process.exit(fallos === 0 ? 0 : 1);
