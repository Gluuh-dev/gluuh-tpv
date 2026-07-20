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

// ── Territorio a partir de la dirección fiscal ────────────────────────────────
// El territorio NO se pregunta ni se asume: se DEDUCE de la dirección fiscal del
// local. Asumir península es el fallo caro (un bar canario facturando al 21 % en
// vez de al 7 % de IGIC, sin que salte ningún error).
//
// El código postal manda: sus dos primeras cifras son el código de provincia.
// Si no hay CP legible, se cae al nombre de la provincia.

/** Provincias por código (2 primeras cifras del CP) que NO son península/Baleares. */
const PROVINCIA_A_TERRITORIO: Record<string, TerritorioFiscal> = {
  "35": "CANARIAS",       // Las Palmas
  "38": "CANARIAS",       // Santa Cruz de Tenerife
  "51": "CEUTA_MELILLA",  // Ceuta
  "52": "CEUTA_MELILLA",  // Melilla
  "01": "FORAL_PV",       // Álava
  "20": "FORAL_PV",       // Gipuzkoa
  "48": "FORAL_PV",       // Bizkaia
  "31": "FORAL_NAVARRA",  // Navarra
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => sinAcentos(s).toLowerCase().trim();

/** Nombres de provincia/territorio (por si no llega el CP). */
function territorioPorNombre(provincia: string): TerritorioFiscal | null {
  const p = norm(provincia);
  if (!p) return null;
  if (/(palmas|tenerife|canaria|lanzarote|fuerteventura|gomera|hierro|palma\b)/.test(p)) return "CANARIAS";
  if (/(ceuta|melilla)/.test(p)) return "CEUTA_MELILLA";
  if (/(alava|araba|gipuzkoa|guipuzcoa|bizkaia|vizcaya|donostia|bilbao|vitoria)/.test(p)) return "FORAL_PV";
  if (/(navarra|nafarroa|pamplona|iruna)/.test(p)) return "FORAL_NAVARRA";
  return null;
}

/**
 * Deduce el territorio fiscal de una dirección. España por defecto; con `pais`
 * distinto de España devuelve null (fuera del alcance de IVA/IGIC/IPSI español).
 *
 * Manda el CP; si no es legible, se usa el nombre de la provincia; si tampoco,
 * PENINSULA_BALEARES (el caso mayoritario) — pero conviene avisar al usuario.
 */
export function territorioDesdeDireccion(dir: {
  codigoPostal?: string | null;
  provincia?: string | null;
  pais?: string | null;
}): TerritorioFiscal | null {
  const pais = norm(dir.pais ?? "");
  if (pais && !/^(es|esp|espana|spain)$/.test(pais)) return null;

  const cp = String(dir.codigoPostal ?? "").replace(/\D/g, "");
  if (cp.length >= 2) {
    const prov = cp.slice(0, 2);
    // Solo los CP de provincia válida (01–52) deciden; "99" no dice nada.
    const n = Number(prov);
    if (n >= 1 && n <= 52) return PROVINCIA_A_TERRITORIO[prov] ?? "PENINSULA_BALEARES";
  }

  return territorioPorNombre(dir.provincia ?? "") ?? "PENINSULA_BALEARES";
}
