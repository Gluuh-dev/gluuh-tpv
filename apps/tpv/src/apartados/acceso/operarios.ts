import type { Rol } from "../../lib/nav";
import type { Usuario } from "./tipos";
import { rpc } from "../../lib/nodo";

// ============================================================================
// Trabajadores REALES del nodo para la puerta de credencial. Mismo contrato que
// el TPV Next: RPC `listar_operarios()` (0024) lista el equipo con PIN, y
// `validar_pin(p_pin)` (0007, backoff 0054) identifica — el PIN dice quién
// eres, elegir usuario antes es solo UX. Ambas exigen la SESIÓN DE DISPOSITIVO
// del terminal (`/auth/v1/dispositivo`, F4.3).
//
// La SPA aún NO tiene emparejado: sin sesión guardada devolvemos null SIN tocar
// la red, y el Inicio enseña el equipo demo MARCADO como ejemplo (nada de datos
// fingidos como reales). Cuando llegue el emparejado: guardar la sesión (ver
// `lib/nodo`) y pasar a `validar_pin_terminal` (0117) con el device_id, que
// añade el bloqueo de PIN POR TERMINAL.
//
// El transporte (origen, token, timeouts) vive en `lib/nodo`: era esto mismo
// copiado, y dos copias del contrato de sesión acaban divergiendo.
// ============================================================================

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
