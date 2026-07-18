// Navegación de la SPA del TPV: 5 destinos + el inicio. Son VISTAS, no rutas de
// framework (nada de next/navigation). Router mínimo con estado en App; si hiciera
// falta deep-link, se pasa a hash-routes sin tocar los componentes.
export type Vista = "inicio" | "tpv" | "config" | "analisis" | "admin" | "nodo";

export const TECLA_A_VISTA: Record<string, Exclude<Vista, "inicio">> = {
  F1: "tpv",
  F2: "config",
  F3: "analisis",
  F4: "admin",
  F5: "nodo",
};
