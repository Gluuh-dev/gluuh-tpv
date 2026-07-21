// ============================================================================
// EL CONTRATO CON EL NODO, en un solo sitio.
//
// La SPA la sirve el nodo, así que habla con su MISMO ORIGEN (el gateway), que
// expone PostgREST en `/rest/v1` y el auth en `/auth/v1`. En dev, el gateway
// local.
//
// La sesión es del DISPOSITIVO (F4.3, `/auth/v1/dispositivo`): la escribe el
// emparejado, que la SPA todavía no tiene. Sin sesión NO se toca la red y todo
// devuelve `null` — quien llama enseña sus datos demo MARCADOS como ejemplo.
// Nunca datos fingidos vendidos como reales.
// ============================================================================

const SESION = "gluuh_sesion_dispositivo"; // { access_token, device_id?, device_nombre? }

// DESTINO de los datos: el NODO (por defecto) o la NUBE (Supabase). Sirve para
// DISEÑAR conectado a datos reales mientras el nodo se termina, y cambiar sin
// tocar la app (ver `vite.config.ts`). En producción queda "nodo".
const DESTINO = (import.meta.env.VITE_DESTINO as string | undefined) || "nodo";

// BASE: nodo = MISMO ORIGEN (en dev el proxy de Vite reenvía `/rest` `/auth`
// `/storage` al gateway; en producción lo sirve el propio nodo, sin CORS). Nube =
// la URL de Supabase (cross-origin, con CORS + `apikey`). `VITE_NODO` sigue como
// override para apuntar a otro nodo a mano.
export const BASE: string =
  DESTINO === "nube"
    ? ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || "")
    : ((import.meta.env.VITE_NODO as string | undefined) || "");

// La anon key SOLO en modo nube: Supabase exige `apikey` además del Bearer.
const ANON = (import.meta.env.VITE_SUPABASE_ANON as string | undefined) || "";

interface Sesion { access_token?: string; device_id?: string; device_nombre?: string }

// La sesión: la de localStorage (emparejado real) o, SOLO en dev, la que firma e
// inyecta `vite.config.ts` (`VITE_DEV_SESION`) para no pegarla a mano cada vez.
// En build de producción `VITE_DEV_SESION` es "" (vacío): manda el emparejado.
function sesion(): Sesion | null {
  try {
    const s = localStorage.getItem(SESION);
    if (s) return JSON.parse(s) as Sesion;
  } catch { /* localStorage inaccesible */ }
  const dev = import.meta.env.VITE_DEV_SESION as string | undefined;
  if (dev) { try { return JSON.parse(dev) as Sesion; } catch { /* mal formado */ } }
  return null;
}

export function token(): string | null {
  return sesion()?.access_token ?? null;
}

/** ¿Hay terminal emparejado (o sesión de dev)? Si no, la pantalla va en demo. */
export const haySesion = (): boolean => token() !== null;

/** Datos del terminal (para la auditoría: quién hizo la acción). */
export function sesionDispositivo(): { device_id?: string; device_nombre?: string } {
  const s = sesion();
  return s ? { device_id: s.device_id, device_nombre: s.device_nombre } : {};
}

/**
 * El bar de este terminal, sacado del propio token (claim `tenant_id`).
 *
 * Hace falta porque `tenant_id` es NOT NULL y sin DEFAULT en todo el catálogo:
 * cada alta tiene que decir de qué bar es. No es un control de seguridad —
 * mentir aquí no sirve de nada, la RLS del nodo vuelve a comprobar el claim
 * contra la fila. Es solo evitar una llamada de más para saber algo que ya
 * viaja en el token.
 */
export function tenantId(): string | null {
  const t = token();
  const carga = t?.split(".")[1];
  if (!carga) return null;
  try {
    // JWT va en base64url: `-` y `_` no son alfabeto de atob.
    const json = atob(carga.replaceAll("-", "+").replaceAll("_", "/"));
    return (JSON.parse(json) as { tenant_id?: string }).tenant_id ?? null;
  } catch {
    return null;
  }
}

function cabeceras(t: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${t}`,
    // Supabase (modo nube) exige `apikey`; el nodo lo ignora, así que no estorba.
    ...(ANON ? { apikey: ANON } : {}),
    ...extra,
  };
}

/** Llama a una función de la BD. `null` = sin sesión, sin nodo o error. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const t = token();
  if (!t) return null;
  try {
    const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: cabeceras(t), body: JSON.stringify(args),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** GET de PostgREST. `null` = sin sesión o sin nodo (el caller decide el plan B). */
export async function leer<T>(consulta: string): Promise<T[] | null> {
  const t = token();
  if (!t) return null;
  try {
    const r = await fetch(`${BASE}/rest/v1/${consulta}`, {
      headers: cabeceras(t), signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T[];
  } catch {
    return null;
  }
}

/**
 * Escritura en PostgREST. A diferencia de las lecturas, **esto SÍ lanza**: al
 * guardar una ficha, tragarse el fallo dejaría al dueño mirando un «guardado»
 * que no ocurrió. Un error se ve; un `null` silencioso no.
 */
export async function escribir(
  ruta: string,
  metodo: "POST" | "PATCH" | "DELETE",
  cuerpo?: unknown,
): Promise<void> {
  const t = token();
  if (!t) throw new Error("Este terminal no está emparejado con el nodo: no puedo guardar.");
  const r = await fetch(`${BASE}/rest/v1/${ruta}`, {
    method: metodo,
    // `merge-duplicates` = upsert; `return=minimal` ahorra devolver la fila entera.
    headers: cabeceras(t, { prefer: "return=minimal,resolution=merge-duplicates" }),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`El nodo ha rechazado el guardado (HTTP ${r.status}): ${await r.text()}`);
}

/**
 * Sube una imagen al disco del nodo y devuelve su URL pública.
 *
 * Va al NODO, no a la nube: el dueño cambia una foto el martes que se ha caído
 * la línea y tiene que verla en el TPV al instante. El nodo la deja en cola y la
 * sube cuando vuelva internet (mismo camino que `subirMedia` en el panel).
 */
export async function subirImagen(ruta: string, datos: Blob): Promise<string> {
  const t = token();
  if (!t) throw new Error("Este terminal no está emparejado con el nodo: no puedo subir la foto.");
  const r = await fetch(`${BASE}/storage/v1/object/media/${ruta}`, {
    method: "POST",
    headers: { "content-type": datos.type || "application/octet-stream", authorization: `Bearer ${t}` },
    body: datos,
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`El nodo no ha podido guardar la imagen (HTTP ${r.status})`);
  return `${BASE}/storage/v1/object/public/media/${ruta}`;
}
