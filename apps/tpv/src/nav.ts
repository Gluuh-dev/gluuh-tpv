// Navegación de la SPA del TPV: 5 destinos + el inicio. Son VISTAS, no rutas de
// framework (nada de next/navigation). Router mínimo con estado en App; si hiciera
// falta deep-link, se pasa a hash-routes sin tocar los componentes.
export type Vista = "inicio" | "tpv" | "config" | "analisis" | "admin" | "nodo";

// Rol mínimo para entrar a un apartado. El nodo valida el rol REAL del PIN/pulsera.
export type Rol = "operario" | "tecnico" | "admin";
export const ETIQUETA_ROL: Record<Rol, string> = {
  operario: "trabajador",
  tecnico: "técnico",
  admin: "administrador",
};

export const TECLA_A_VISTA: Record<string, Exclude<Vista, "inicio">> = {
  F1: "tpv",
  F2: "config",
  F3: "analisis",
  F4: "admin",
  F5: "nodo",
};
