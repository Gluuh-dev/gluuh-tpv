// ─────────────────────────────────────────────────────────────────────────────
//  CONTRA QUIÉN HABLAN LAS RUTAS DE API: ¿EL NODO DEL BAR, O LA NUBE?
//
//  Esto es el hermano de `config.ts` (que resuelve lo mismo en el NAVEGADOR). Aquí no vale
//  `window.__GLUUH__`: esto corre en el servidor. Lo dicen las variables de entorno que
//  `apps/nodo/web.mjs` le pone al proceso de Next al arrancarlo dentro del nodo.
//
//  ── POR QUÉ EXISTE, Y NO ES UNA REFACTORIZACIÓN BONITA ──────────────────────
//
//  Las rutas leían `NEXT_PUBLIC_SUPABASE_URL` —la dirección de LA NUBE, incrustada al
//  compilar—. Dentro del nodo, eso significaba:
//
//    · `/api/ticket` validaba la sesión CONTRA LA NUBE, con un token firmado por el NODO.
//      La nube lo rechaza (no es su firma) → 401 → «No se pudo calcular el ticket. No se ha
//      cobrado nada.»  **Un bar con nodo no podía cobrar desde el TPV.** Ni sin internet
//      (no llega), ni con él (lo rechazan).
//
//    · `/api/factura` pedía el local A LA NUBE → «Tenant no encontrado» → **VERIFACTU era
//      imposible en un nodo**. Justo el sitio donde la ley obliga a emitir.
//
//  No se había visto porque todas las pruebas del nodo escriben en la base directamente:
//  ninguna pasaba por el camino que recorre un camarero de verdad al darle a Cobrar.
//
//  Por eso hay UNA sola puerta. Si cada ruta lo resuelve a mano, la próxima que se escriba
//  volverá a hablar con la nube desde dentro del bar — y se descubrirá igual: cuando un
//  cliente no pueda pagar.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import type { GluuhContractDatabase, GluuhSupabaseClient } from "@gluuh/supabase";

/** ¿Corremos DENTRO del servidor de un bar? Lo pone `apps/nodo/web.mjs`. */
export const enNodo = (): boolean => process.env.NODO_LOCAL === "1";

/**
 * Dónde están los datos, y con qué clave pública se llega.
 *
 * En el nodo: por loopback contra su propio gateway. En la nube: Supabase.
 */
export function origenDeDatos(): { url: string; clave: string } {
  if (enNodo()) {
    return {
      url: process.env.NODO_URL_INTERNA ?? "http://127.0.0.1:54321",
      clave: process.env.NODO_CLAVE_ANON ?? "",
    };
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

/**
 * Un cliente que actúa COMO EL QUE LLAMA (con su Bearer).
 *
 * La RLS sigue mandando: pide un pedido de otra empresa y no existe para él. Es lo que hay
 * que usar en todo lo que toque datos de un bar — nunca la clave de servicio.
 */
export function comoElLlamante(token: string): GluuhSupabaseClient | null {
  const { url, clave } = origenDeDatos();
  if (!url || !clave) {
    console.error(
      "[api] SIN CONFIGURAR: no sé contra quién hablar. En la nube faltan los secretos de " +
      "runtime del Worker (NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY); en el nodo, las " +
      "variables que pone web.mjs. Los cobros van a fallar.",
    );
    return null;
  }
  return createClient<GluuhContractDatabase>(url, clave, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

/**
 * Un cliente que SALTA LA RLS. Sólo para lo que de verdad lo necesita (crear el usuario de
 * un operario, canjear un emparejado…).
 *
 * OJO: en el nodo es la clave de SU bar, no la maestra de la plataforma. El nodo NUNCA
 * lleva `SUPABASE_SECRET_KEY` — con ella, robar el mini-PC de un bar sería robar los datos
 * de todos los clientes. Ver `apps/nodo/nube.mjs`.
 */
export const claveDeServicio = (): string | undefined =>
  enNodo() ? process.env.NODO_CLAVE_SERVICIO : process.env.SUPABASE_SECRET_KEY;

export function comoElServicio(): GluuhSupabaseClient | null {
  const { url } = origenDeDatos();
  const secreto = claveDeServicio();
  if (!url || !secreto) return null;
  return createClient<GluuhContractDatabase>(url, secreto, { auth: { persistSession: false } });
}

/** ¿Quién llama? `null` si el token no vale. */
export async function quienLlama(req: Request): Promise<{ supa: GluuhSupabaseClient; userId: string } | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supa = comoElLlamante(token);
  if (!supa) return null;

  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return null;
  return { supa, userId: data.user.id };
}
