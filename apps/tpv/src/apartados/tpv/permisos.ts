import type { Rol } from "../../lib/nav";
import type { Operario } from "./sesion";

// PERMISOS del operario en el TPV (Capa 3). Mismo contrato que el nodo
// (`app_user.perfil.permisos`, migración 0048): un jsonb de flags con las claves
// modificar · descuento · borrar · invitar · cobrar. Puro y testeable: decide
// quién puede hacer qué y cuándo hace falta que un responsable autorice.

export type Accion = "modificar" | "descuento" | "borrar" | "invitar" | "cobrar";

export const ACCIONES: { clave: Accion; etiqueta: string }[] = [
  { clave: "modificar", etiqueta: "Cambiar precio o cantidad" },
  { clave: "descuento", etiqueta: "Aplicar descuentos" },
  { clave: "borrar", etiqueta: "Anular líneas" },
  { clave: "invitar", etiqueta: "Invitar" },
  { clave: "cobrar", etiqueta: "Cobrar" },
];

/** Flags del perfil. Ausente = permitido; solo `false` niega (contrato 0041/0048). */
export type Permisos = Partial<Record<Accion, boolean>>;

// Distingue tres situaciones que NO son lo mismo, y ahí está el bug caro del Next:
//   · perfil cargado         → mandan sus flags (ausente = permitido).
//   · sin perfil configurado → el rol decide (admin todo; operario opera).
//   · perfil NO CARGADO (fallo de red) → se DENIEGA lo sensible. Tratar un error
//     de carga como "sin restricciones" deja a cualquiera anulando y descontando.
export type EstadoPerfil =
  | { estado: "cargado"; permisos: Permisos }
  | { estado: "sin-perfil" }        // el operario no tiene perfil asignado
  | { estado: "sin-cargar" };       // aún no llegó, o falló: fail-closed

/** ¿Puede el operario hacer la acción por sí mismo, sin pedir autorización? */
export function puede(rol: Rol, perfil: EstadoPerfil, accion: Accion): boolean {
  // El administrador (encargado/propietario) puede todo: es quien AUTORIZA a los demás.
  if (rol === "admin") return true;
  switch (perfil.estado) {
    case "cargado":
      return perfil.permisos[accion] !== false;   // ausente = permitido; solo false niega
    case "sin-perfil":
      return true;                                 // sin perfil configurado, el trabajador opera
    case "sin-cargar":
      return false;                                // fail-closed: mejor pedir PIN de más que de menos
  }
}

/** ¿Este operario puede AUTORIZAR a otro una acción que a aquel se le negó? */
export function puedeAutorizar(autorizador: Operario, accion: Accion): boolean {
  // Un responsable autoriza cualquier acción del TPV. Se mantiene simple a
  // propósito: el que manda (admin) desbloquea; afinar por acción es 0048 y no
  // hace falta para que el mecanismo sea correcto.
  return puede(autorizador.rol, { estado: "sin-perfil" }, accion) && autorizador.rol === "admin";
}
