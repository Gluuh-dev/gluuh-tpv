import { createContext, useContext } from "react";
import type { Accion } from "./permisos";

// Contexto de la sesión DENTRO del TPV: deja que cualquier acción sensible
// (descuento en el teclado, invitar/anular en la fila) pregunte «¿puede el
// operario activo?» y, si no, pida el PIN de un responsable — sin arrastrar
// permisos y callbacks por props a través de Venta → Teclado → …
export interface SesionTpv {
  /** ¿El operario activo puede la acción por sí mismo? */
  puede: (accion: Accion) => boolean;
  /**
   * Ejecuta `alConceder` si el operario puede; si no, pide autorización de un
   * responsable y lo ejecuta solo cuando un admin mete su PIN. Nunca ejecuta la
   * acción sin permiso ni autorización.
   */
  hacer: (accion: Accion, alConceder: () => void) => void;
}

// Por defecto TODO permitido: fuera del TPV, o en tests, no hay puerta que gatear.
const Ctx = createContext<SesionTpv>({ puede: () => true, hacer: (_a, cb) => cb() });

export const SesionTpvProvider = Ctx.Provider;
export const useSesionTpv = (): SesionTpv => useContext(Ctx);
