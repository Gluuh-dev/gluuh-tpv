// Ayudas de efectivo del cobro (puras): sugerencias de billete y desglose del
// cambio en billetes/monedas EUR. Portado 1:1 de apps/web/app/tpv/efectivo.ts.

export const DENOMINACIONES_EUR = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01] as const;

/** Importes redondos por ENCIMA del pendiente (hasta 4, ascendentes, total-aware). */
export function sugerenciasEfectivo(objetivo: number): number[] {
  if (objetivo <= 0) return [];
  const escalones = [5, 10, 20, 50, 100, 200];
  const set = new Set<number>();
  for (const e of escalones) {
    const v = Math.ceil((objetivo - 1e-9) / e) * e;
    if (v > objetivo + 1e-9) set.add(v);
  }
  return [...set].sort((a, b) => a - b).slice(0, 4);
}

/** Desglosa el cambio en el mínimo de billetes/monedas EUR (voraz, en céntimos). */
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
