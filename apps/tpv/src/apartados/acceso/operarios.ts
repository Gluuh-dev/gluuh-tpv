import type { Rol } from "../../lib/nav";
import type { Usuario } from "./tipos";

// ============================================================================
// Trabajadores REALES del nodo para la puerta de credencial. Mismo contrato que
// el TPV Next: RPC `listar_operarios()` (0024) lista el equipo con PIN, y
// `validar_pin(p_pin)` (0007, backoff 0054) identifica — el PIN dice quién
// eres, elegir usuario antes es solo UX. Ambas exigen la SESIÓN DE DISPOSITIVO
// del terminal (`/auth/v1/dispositivo`, F4.3).
//
// La SPA aún NO tiene emparejado: sin sesión guardada devolvemos null SIN tocar
// la red, y el Inicio enseña el equipo demo MARCADO como ejemplo (nada de datos
// fingidos como reales). Cuando llegue el emparejado: guardar la sesión en
// localStorage[SESION] y pasar a `validar_pin_terminal` (0117) con el
// device_id, que añade el bloqueo de PIN POR TERMINAL.
// ============================================================================

const SESION = "gluuh_sesion_dispositivo"; // { access_token, device_id? } — la escribe el emparejado (F4)

// Servida por el nodo, la SPA habla con su mismo origen (el gateway). En dev,
// el gateway local.
const BASE: string = import.meta.env.DEV ? (import.meta.env.VITE_NODO ?? "http://localhost:54321") : "";

function token(): string | null {
  try {
    const s = localStorage.getItem(SESION);
    return s ? ((JSON.parse(s) as { access_token?: string }).access_token ?? null) : null;
  } catch {
    return null;
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const t = token();
  if (!t) return null;
  try {
    const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

type OperarioBD = { id: string; nombre: string; rol: string };

// Roles de app_user → roles del hub. PROPIETARIO/ENCARGADO mandan; CAMARERO/
// COCINA operan. El rol "tecnico" NO sale de app_user: es la clave técnica de
// Gluuh (zona técnica), y llegará por su propio camino.
function aRol(rol: string): Rol {
  return rol === "PROPIETARIO" || rol === "ENCARGADO" ? "admin" : "operario";
}

const aUsuario = (o: OperarioBD): Usuario => ({ id: o.id, nombre: o.nombre, rol: aRol(o.rol) });

/** El equipo real del nodo, o null si no hay sesión/nodo (el caller enseña demo). */
export async function cargarOperarios(): Promise<Usuario[] | null> {
  const r = await rpc<OperarioBD[]>("listar_operarios", {});
  return r ? r.map(aUsuario) : null;
}

/** Identifica por PIN. null = incorrecto, bloqueado o sin nodo. */
export async function validarPin(pin: string): Promise<Usuario | null> {
  const r = await rpc<OperarioBD[]>("validar_pin", { p_pin: pin });
  const o = r?.[0];
  return o ? aUsuario(o) : null;
}
