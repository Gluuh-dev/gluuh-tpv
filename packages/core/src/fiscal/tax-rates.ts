/** Clases fiscales y resolución del % por territorio. Fuente única para web/escritorio/móvil. */

export type ClaseFiscal = "GENERAL" | "REDUCIDO" | "SUPERREDUCIDO" | "EXENTO";
export type TerritorioFiscal =
  | "PENINSULA_BALEARES"
  | "CANARIAS"
  | "CEUTA_MELILLA"
  | "FORAL_PV"
  | "FORAL_NAVARRA";

export const CLASES_FISCALES = [
  { v: "GENERAL", t: "General" },
  { v: "REDUCIDO", t: "Reducido" },
  { v: "SUPERREDUCIDO", t: "Superreducido" },
  { v: "EXENTO", t: "Exento (sin impuesto)" },
] as const;

/** % por (territorio, clase). DEBE coincidir con el seed de la tabla SQL tax_rate. */
export const TIPOS_POR_TERRITORIO: Record<string, Record<string, number>> = {
  PENINSULA_BALEARES: { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
  CANARIAS:           { GENERAL: 7,  REDUCIDO: 3,  SUPERREDUCIDO: 0, EXENTO: 0 },
  CEUTA_MELILLA:      { GENERAL: 10, REDUCIDO: 4,  SUPERREDUCIDO: 1, EXENTO: 0 },
  FORAL_PV:           { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
  FORAL_NAVARRA:      { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
};

/** Devuelve el % automáticamente según la clase fiscal y el territorio del local. */
export function ivaAuto(clase: string, territorio: string): number {
  const t = TIPOS_POR_TERRITORIO[territorio] ?? TIPOS_POR_TERRITORIO.PENINSULA_BALEARES!;
  return t[clase] ?? 0;
}

/** Nombre del impuesto según el territorio (para mostrar en la UI). */
export function nombreImpuesto(territorio: string): string {
  if (territorio === "CANARIAS") return "IGIC";
  if (territorio === "CEUTA_MELILLA") return "IPSI";
  return "IVA";
}
