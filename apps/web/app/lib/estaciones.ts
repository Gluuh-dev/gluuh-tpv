// Estación de preparación de un producto/línea: a dónde va cuando se marcha.
//  - COCINA   → ticket/pantalla de cocina (comidas)
//  - BARRA    → ticket de barra (bebidas)
//  - CAMARERO → lo prepara el propio camarero (p. ej. tapas frías); no va a cocina/pantalla
//  - NINGUNA  → no se manda a preparar
export const ESTACIONES = ["COCINA", "BARRA", "CAMARERO", "NINGUNA"] as const;
export type Estacion = (typeof ESTACIONES)[number];

export const ESTACION_LABEL: Record<Estacion, string> = {
  COCINA: "Cocina",
  BARRA: "Barra",
  CAMARERO: "Camarero",
  NINGUNA: "Ninguna",
};

// Normaliza valores nulos/heredados a una estación canónica (por defecto, Cocina).
export function estacionDe(e?: string | null): Estacion {
  return e && (ESTACIONES as readonly string[]).includes(e) ? (e as Estacion) : "COCINA";
}
