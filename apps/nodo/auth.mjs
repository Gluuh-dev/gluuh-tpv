// LA AUTENTICACIÓN DEL NODO. Sustituye a GoTrue.
//
// ─────────────────────────────────────────────────────────────────────────────
//  QUÉ HACÍA GOTRUE AQUÍ, DE VERDAD
//
//  Nada de autenticar. El PIN del camarero ya lo validábamos NOSOTROS contra
//  `app_user.clave_hash` (bcrypt, RPC `verificar_clave_operario`). Lo único que hacía
//  GoTrue era FIRMAR un JWT — y para conseguir esa firma montábamos una pantomima:
//  crearle un usuario falso con una contraseña aleatoria y hacer login con él.
//
//  Ese notario nos costaba un fork de Go parcheado a mano (SO_REUSEPORT no existe en
//  Windows) que habría que recompilar con cada aviso de seguridad de Supabase, para
//  siempre; 50 MB en el instalador; un proceso más que vigilar; y las dos trampas del
//  orden de instalación que tanto costaron encontrar.
//
//  Aquí se firma el token directamente. **Mismo secreto, mismo formato, mismos claims**:
//  PostgREST no nota la diferencia y la RLS no se toca.
//
//  Y en la NUBE no cambia nada: allí GoTrue es el de Supabase y lo mantienen ellos.
// ─────────────────────────────────────────────────────────────────────────────
//
//  LO QUE NO INVENTAMOS (que es casi todo):
//   · el hash de contraseñas → bcrypt, en Postgres (pgcrypto). No sale de la BD.
//   · la autorización        → la RLS, intacta.
//   · el formato del token   → JWT HS256, el de siempre.
//  Lo que sí escribimos: comprobar una clave, firmar, y rotar el refresco.
//
//  LAS CUATRO RUTAS QUE `supabase-js` LLAMA DE VERDAD (medido en el código):
//    POST /token?grant_type=password        entrar
//    POST /token?grant_type=refresh_token   renovar (el token dura 1 h)
//    GET  /user                             ¿quién soy?
//    POST /logout                           salir
//  (`getSession` es del navegador: lee su almacén local y no llama a nadie.)

import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";
import { secretoDelNodo } from "./secreto.mjs";

const PUERTO = Number(process.env.NODO_AUTH_PUERTO ?? 55434);
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

const DURACION = 3600;                    // el access token vive 1 h
const TICKET_SEGUNDOS = 120;              // el vale de un solo uso, 2 min
const REFRESCO_DIAS = 30;

// El secreto de ESTE nodo: el mismo con el que PostgREST valida. Si no cuadraran, no
// entraría nadie.
const SECRETO = secretoDelNodo();

const bd = new pg.Pool({ connectionString: BD });

// ── JWT ──────────────────────────────────────────────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function firmar(claims) {
  const cab = b64({ alg: "HS256", typ: "JWT" });
  const cuerpo = b64(claims);
  const firma = crypto.createHmac("sha256", SECRETO).update(`${cab}.${cuerpo}`).digest("base64url");
  return `${cab}.${cuerpo}.${firma}`;
}

/** Verifica firma Y caducidad. `timingSafeEqual` para no filtrar la firma a base de medir. */
function comprobar(token) {
  const p = String(token ?? "").split(".");
  if (p.length !== 3) return null;
  const esperada = crypto.createHmac("sha256", SECRETO).update(`${p[0]}.${p[1]}`).digest("base64url");
  const a = Buffer.from(p[2]);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(p[1], "base64url").toString("utf8"));
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

// Los tickets y los refrescos se guardan HASHEADOS: quien tenga un volcado de la base de
// datos no puede robar una sesión con él.
const huella = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ── Emitir una sesión ────────────────────────────────────────────────────────
async function emitirSesion(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const refresco = crypto.randomBytes(32).toString("base64url");

  // El usuario del JWT. `auth.uid()` lee `sub`, y de ahí cuelga `current_tenant_id()` y
  // TODA la RLS multi-tenant. Se usa el propio id del empleado — en el nodo no hay otra
  // tabla de usuarios que valga.
  const sub = usuario.id;

  await bd.query(
    `insert into public.nodo_sesion (app_user_id, refresco, expira_at)
          values ($1, $2, now() + interval '${REFRESCO_DIAS} days')`,
    [usuario.id, huella(refresco)],
  );

  const access = firmar({
    sub,
    aud: "authenticated",
    role: "authenticated",
    email: usuario.email ?? null,
    // Los mismos claims que ponía el hook 0011. `current_tenant_id()` los lee de aquí:
    // sin `tenant_id`, la RLS no resuelve el bar y el TPV se queda a oscuras.
    tenant_id: usuario.tenant_id,
    user_rol: usuario.rol ?? null,
    is_platform_admin: false,   // en un nodo no hay administradores de plataforma
    iat: ahora,
    exp: ahora + DURACION,
  });

  return {
    access_token: access,
    token_type: "bearer",
    expires_in: DURACION,
    expires_at: ahora + DURACION,
    refresh_token: refresco,
    user: {
      id: sub,
      aud: "authenticated",
      role: "authenticated",
      email: usuario.email ?? "",
      app_metadata: { provider: "nodo" },
      user_metadata: { nombre: usuario.nombre, tenant_id: usuario.tenant_id },
      created_at: new Date().toISOString(),
    },
  };
}

// ── Entrar ───────────────────────────────────────────────────────────────────
async function entrar(cuerpo) {
  const email = String(cuerpo.email ?? "").trim();
  const clave = String(cuerpo.password ?? "");
  if (!clave) return null;

  // 1) VALE DE UN SOLO USO (el camarero).
  //
  // El TPV ya validó su PIN contra `app_user.clave_hash` en /api/entrar-operario y pidió
  // un vale. Aquí se canjea. Un solo uso y dos minutos de vida: si alguien lo ve pasar,
  // cuando lo intente ya no vale.
  const { rows: [vale] } = await bd.query(
    `update public.nodo_sesion s
        set usada_at = now(), ticket = null
      where s.ticket = $1
        and s.usada_at is null
        and s.creada_at > now() - interval '${TICKET_SEGUNDOS} seconds'
      returning s.app_user_id`,
    [huella(clave)],
  );

  if (vale) {
    const { rows: [u] } = await bd.query(
      "select id, tenant_id, nombre, email, rol from public.app_user where id = $1 and activo",
      [vale.app_user_id],
    );
    return u ? emitirSesion(u) : null;
  }

  // 2) EL DUEÑO, con su email y su contraseña.
  //
  // Esto es lo que ANTES NO SE PODÍA hacer sin internet: su contraseña sólo existía en el
  // GoTrue de la nube. Ahora también aquí (`app_user.password_hash`), y el bcrypt lo
  // comprueba Postgres, no nosotros.
  if (!email) return null;
  const { rows: [duenyo] } = await bd.query(
    "select * from public.verificar_password_local($1, $2)",
    [email, clave],
  );
  return duenyo ? emitirSesion(duenyo) : null;
}

// ── Entrar como DISPOSITIVO (el terminal, capa 1) ─────────────────────────────
//
// El TPV/comandera se identifica con SU usuario+contraseña (migración 0105), distinta del
// PIN del camarero. Esto NO abre sesión de datos ni es un `app_user`: solo dice QUÉ terminal
// es (para el enrutado de impresión, la estación, y —más adelante— el candado de superficie).
// Encima sigue yendo el PIN del camarero, que es quien abre la sesión de verdad.
//
// Devuelve un token de dispositivo largo (365 días): el terminal lo guarda ("recordar") y ya
// no vuelve a pedir la credencial hasta que se desvincule.
const DISPOSITIVO_DIAS = 365;
async function entrarDispositivo(cuerpo) {
  const usuario = String(cuerpo.usuario ?? "").trim();
  const clave = String(cuerpo.clave ?? cuerpo.password ?? "");
  if (!usuario || !clave) return null;

  // El bcrypt lo comprueba Postgres (verificar_clave_dispositivo), no nosotros.
  const { rows: [d] } = await bd.query(
    "select * from public.verificar_clave_dispositivo($1, $2)",
    [usuario, clave],
  );
  if (!d) return null;

  // Marca "en línea" desde ya (lo mismo que el heartbeat del panel).
  await bd.query("select public.device_heartbeat($1, null)", [d.device_id]).catch(() => {});

  const ahora = Math.floor(Date.now() / 1000);
  const token = firmar({
    sub: d.device_id,
    role: "device",
    device_id: d.device_id,
    tenant_id: d.tenant_id,
    modulo: d.modulo,
    tipo: d.tipo,
    estacion: d.estacion ?? null,
    iat: ahora,
    exp: ahora + DISPOSITIVO_DIAS * 24 * 3600,
  });
  return { ok: true, token, device_id: d.device_id, nombre: d.nombre, modulo: d.modulo, tipo: d.tipo, estacion: d.estacion ?? null };
}

// ── Renovar ──────────────────────────────────────────────────────────────────
async function renovar(cuerpo) {
  const refresco = String(cuerpo.refresh_token ?? "");
  if (!refresco) return null;

  // ROTA: el refresco viejo se anula al usarlo. Si alguien roba uno ya gastado, no vale
  // para nada. Y se comprueba que el empleado SIGA ACTIVO — a un camarero al que dan de
  // baja un viernes no se le puede quedar la sesión viva un mes.
  const { rows: [s] } = await bd.query(
    `delete from public.nodo_sesion
      where refresco = $1 and expira_at > now()
      returning app_user_id`,
    [huella(refresco)],
  );
  if (!s) return null;

  const { rows: [u] } = await bd.query(
    "select id, tenant_id, nombre, email, rol from public.app_user where id = $1 and activo",
    [s.app_user_id],
  );
  return u ? emitirSesion(u) : null;
}

// ── El servidor ──────────────────────────────────────────────────────────────
const leerCuerpo = async (req) => {
  const trozos = [];
  for await (const t of req) trozos.push(t);
  try {
    return JSON.parse(Buffer.concat(trozos).toString("utf8") || "{}");
  } catch {
    return {};
  }
};

const json = (res, codigo, dato) => {
  res.writeHead(codigo, { "content-type": "application/json" });
  res.end(JSON.stringify(dato));
};

// GoTrue devuelve esto ante credenciales malas, y `supabase-js` lo traduce a un error
// legible. Se imita para que la app no note el cambio.
const malas = (res) =>
  json(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://nodo");
  const ruta = url.pathname.replace(/^\/auth\/v1/, "");

  try {
    if (ruta === "/health" || ruta === "/") return json(res, 200, { name: "nodo-auth", version: "1" });

    if (ruta === "/token" && req.method === "POST") {
      const cuerpo = await leerCuerpo(req);
      const tipo = url.searchParams.get("grant_type");
      const sesion = tipo === "refresh_token" ? await renovar(cuerpo) : await entrar(cuerpo);
      return sesion ? json(res, 200, sesion) : malas(res);
    }

    // Login del TERMINAL (usuario+contraseña del dispositivo). Distinto de /token, que es
    // para empleados. Sin autenticación previa: la credencial del terminal ES la puerta.
    if (ruta === "/dispositivo" && req.method === "POST") {
      const cuerpo = await leerCuerpo(req);
      const r = await entrarDispositivo(cuerpo);
      return r ? json(res, 200, r) : json(res, 401, { error: "Usuario o contraseña del terminal incorrectos" });
    }

    if (ruta === "/user" && req.method === "GET") {
      const claims = comprobar((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
      if (!claims) return json(res, 401, { message: "invalid token" });
      const { rows: [u] } = await bd.query(
        "select id, tenant_id, nombre, email, rol from public.app_user where id = $1 and activo",
        [claims.sub],
      );
      if (!u) return json(res, 401, { message: "invalid token" });
      return json(res, 200, {
        id: u.id,
        aud: "authenticated",
        role: "authenticated",
        email: u.email ?? "",
        app_metadata: { provider: "nodo" },
        user_metadata: { nombre: u.nombre, tenant_id: u.tenant_id },
      });
    }

    // ── El VALE (sustituye a `admin.createUser` de GoTrue) ───────────────────
    //
    // Lo pide `/api/entrar-operario` DESPUÉS de haber validado el PIN del camarero contra
    // `app_user.clave_hash`. Devuelve un vale de un solo uso que el navegador canjea por
    // una sesión. Es la pieza que elimina la pantomima del usuario falso.
    //
    // Sólo con la clave de servicio: si cualquiera pudiera pedir un vale para un empleado,
    // entraría al TPV sin saber ningún PIN. Esta ruta ES la puerta trasera, y por eso está
    // cerrada con llave.
    if (ruta === "/vale" && req.method === "POST") {
      const claims = comprobar((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
      if (claims?.role !== "service_role") return json(res, 401, { message: "no autorizado" });

      const { app_user_id } = await leerCuerpo(req);
      const { rows: [u] } = await bd.query(
        "select id from public.app_user where id = $1 and activo",
        [app_user_id],
      );
      if (!u) return json(res, 404, { message: "empleado no encontrado o dado de baja" });

      const vale = crypto.randomBytes(24).toString("base64url");
      await bd.query(
        "insert into public.nodo_sesion (app_user_id, ticket) values ($1, $2)",
        [u.id, huella(vale)],
      );
      return json(res, 200, { vale });
    }

    if (ruta === "/logout" && req.method === "POST") {
      const claims = comprobar((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
      // Se borran TODAS las sesiones de ese usuario: si cierra sesión porque cree que
      // alguien le ha visto la clave, no le vale de nada que quede un refresco vivo.
      if (claims?.sub) {
        await bd.query("delete from public.nodo_sesion where app_user_id = $1", [claims.sub]);
      }
      res.writeHead(204).end();
      return;
    }

    json(res, 404, { message: `El nodo no sirve ${req.url}` });
  } catch (e) {
    console.error("auth:", e.message);
    json(res, 500, { message: "error interno" });
  }
});

// Limpieza: sesiones caducadas y vales sin canjear. Sin esto la tabla crece para siempre,
// y en un bar que lleve años abierto eso son cientos de miles de filas muertas.
setInterval(() => {
  bd.query("delete from public.nodo_sesion where expira_at < now()").catch(() => {});
}, 3_600_000).unref();

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`auth: firmando tokens en http://127.0.0.1:${PUERTO} (sin GoTrue)`);
});
