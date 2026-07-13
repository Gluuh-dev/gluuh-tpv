// CÓMO SE IDENTIFICA EL NODO ANTE LA NUBE.
//
// ─────────────────────────────────────────────────────────────────────────────
//  POR QUÉ ESTO EXISTE (y por qué no vale la clave secreta de Supabase)
// ─────────────────────────────────────────────────────────────────────────────
//
//  La `SUPABASE_SECRET_KEY` **salta toda la RLS de la plataforma**: con ella se lee y se
//  escribe en los datos de CUALQUIER bar. Está bien en nuestra máquina; es inaceptable
//  en el mini-PC de un cliente.
//
//  Si el instalador la copiara en cada bar, un solo ordenador robado —o un empleado
//  curioso— tendría la llave maestra de TODOS los clientes. Y en un mini-PC debajo de
//  una barra, con la puerta abierta y la wifi del local, eso pasa.
//
//  Así que el nodo se identifica **como su bar**: inicia sesión en la nube con una cuenta
//  normal, la RLS lo acota a su `tenant`, y no puede tocar nada de nadie más. Guarda sólo
//  el `refresh_token` (que además va rotando), nunca una contraseña ni una clave maestra.
//
//  Dos modos, y el fichero de credenciales decide cuál:
//
//    · SUPABASE_SECRET_KEY   → nuestra máquina de desarrollo. Cómodo, sin RLS.
//    · SUPABASE_REFRESH_TOKEN → un bar de verdad. Con RLS. Es lo que instala el
//                               instalador, y lo único que debería salir de aquí.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";

const ENV = path.resolve(".nodo/sync.env");

export function credenciales() {
  const env = {};
  if (fs.existsSync(ENV)) {
    for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
      if (m) env[m[1]] = m[2];
    }
  }
  return {
    url: process.env.SUPABASE_URL ?? env.SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY,
    secreta: process.env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SECRET_KEY,
    refresco: process.env.SUPABASE_REFRESH_TOKEN ?? env.SUPABASE_REFRESH_TOKEN,
    tenant: process.env.NODO_TENANT ?? env.NODO_TENANT,
  };
}

/** Guarda el refresh_token nuevo. GoTrue los ROTA: si no se guarda, el nodo se queda fuera. */
function guardarRefresco(nuevo) {
  const texto = fs.readFileSync(ENV, "utf8");
  fs.writeFileSync(
    ENV,
    /^SUPABASE_REFRESH_TOKEN=.*$/m.test(texto)
      ? texto.replace(/^SUPABASE_REFRESH_TOKEN=.*$/m, `SUPABASE_REFRESH_TOKEN=${nuevo}`)
      : `${texto.trimEnd()}\nSUPABASE_REFRESH_TOKEN=${nuevo}\n`,
  );
}

/**
 * Las cabeceras con las que el nodo habla con la nube.
 *
 * Devuelve `null` si no hay credenciales o si la nube no contesta — y eso NO es un error:
 * un bar sin internet un martes sigue vendiendo. Ya subirá.
 */
export async function cabeceras() {
  const c = credenciales();
  if (!c.url) return null;

  // Modo desarrollo: la clave maestra. Nunca en casa de un cliente.
  if (c.secreta) {
    return { apikey: c.secreta, authorization: `Bearer ${c.secreta}`, "content-type": "application/json" };
  }

  // Modo bar: la cuenta del propio bar. La RLS lo acota a su tenant.
  if (!c.refresco || !c.anon) return null;

  try {
    const r = await fetch(`${c.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: c.anon, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: c.refresco }),
    });
    if (!r.ok) return null;
    const s = await r.json();

    // GoTrue ROTA el refresh_token en cada uso: si no guardamos el nuevo, el nodo pierde
    // el acceso a la nube en la siguiente vuelta y nadie sabría por qué.
    if (s.refresh_token && s.refresh_token !== c.refresco) guardarRefresco(s.refresh_token);

    return {
      apikey: c.anon,
      authorization: `Bearer ${s.access_token}`,
      "content-type": "application/json",
    };
  } catch {
    return null;   // sin línea. El bar sigue.
  }
}
