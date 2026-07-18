import type { Rol } from "../../lib/nav";

// Un trabajador que puede identificarse en el terminal (para elegir "quién eres"
// antes del PIN, o para el login por acción dentro del TPV).
export interface Usuario {
  id: string;
  nombre: string;
  rol: Rol;
  /** Color del avatar (opcional; por defecto el morado de marca). */
  color?: string;
}

export function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
