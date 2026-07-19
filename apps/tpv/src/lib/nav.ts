// Navegación de la SPA del TPV: 5 apartados + el inicio. Son VISTAS, no rutas de
// framework (nada de next/navigation). Router mínimo con estado en App; si hiciera
// falta deep-link, se pasa a hash-routes sin tocar los componentes.
export type Vista = "inicio" | "tpv" | "config" | "analisis" | "admin" | "nodo";
export type Apartado = Exclude<Vista, "inicio">;

export const TECLA_A_VISTA: Record<string, Apartado> = {
  F1: "tpv",
  F2: "config",
  F3: "analisis",
  F4: "admin",
  F5: "nodo",
};

// Rol mínimo para entrar a un apartado. El nodo valida el rol REAL del PIN/pulsera.
export type Rol = "operario" | "tecnico" | "admin";
export const ETIQUETA_ROL: Record<Rol, string> = {
  operario: "trabajador",
  tecnico: "técnico",
  admin: "administrador",
};

// ¿`rol` abre una puerta que exige `requiere`? El administrador abre cualquier
// puerta (incluida la técnica: el dueño puede mirar su propio nodo); el técnico
// no administra; el trabajador solo opera.
const NIVEL: Record<Rol, number> = { operario: 0, tecnico: 1, admin: 2 };
export function cumpleRol(rol: Rol, requiere: Rol): boolean {
  return NIVEL[rol] >= NIVEL[requiere];
}
