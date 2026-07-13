// Ayudas de efectivo del cobro (puras, testeables): sugerencias de billete con el
// que paga el cliente y desglose del cambio a devolver en billetes/monedas EUR.

// Denominaciones de euro (billetes + monedas), de mayor a menor, en euros.
export const DENOMINACIONES_EUR = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] as const;

/**
 * Importes "redondos" con los que el cliente suele pagar, por ENCIMA del importe
 * pendiente (el exacto ya es un botón aparte). P. ej. pendiente 13,40 → [15,20,50,100].
 * Devuelve hasta 4, ascendentes. Total-aware: para 47 € da [50,60,100,200], no 5/10/20.
 */
export function sugerenciasEfectivo(objetivo: number): number[] {
  if (objetivo <= 0) return [];
  const escalones = [5, 10, 20, 50, 100, 200];
  const set = new Set<number>();
  for (const e of escalones) {
    const v = Math.ceil((objetivo - 1e-9) / e) * e;   // siguiente múltiplo de e ≥ objetivo
    if (v > objetivo + 1e-9) set.add(v);
  }
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

/**
 * Desglosa un importe (el cambio a devolver) en el mínimo de billetes/monedas EUR,
 * de mayor a menor (algoritmo voraz, correcto con el sistema de denominaciones euro).
 * Trabaja en céntimos para no arrastrar errores de coma flotante.
 * P. ej. 6,60 → [{valor:5,n:1},{valor:1,n:1},{valor:0.5,n:1},{valor:0.1,n:1}].
 */
export function desglosarCambio(importe: number): { valor: number; n: number }[] {
  let c = Math.round(importe * 100);
  if (c <= 0) return [];
  const out: { valor: number; n: number }[] = [];
  for (const d of DENOMINACIONES_EUR) {
    const dc = Math.round(d * 100);
    const n = Math.floor(c / dc);
    if (n > 0) { out.push({ valor: d, n }); c -= n * dc; }
  }
  return out;
}
