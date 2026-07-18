// Reparto de un importe en partes (módulo PURO, ruta del dinero — testeable).
// Extraído de app/tpv/page.tsx (E1.3): dividir una cuenta en n iguales.

/** Reparte `totalEuros` en `n` partes iguales con CÉNTIMOS EXACTOS: todas iguales
 *  salvo la última, que absorbe el resto para que la suma cuadre con el total al
 *  céntimo (nunca sobra ni falta un céntimo). `n <= 0` → []. */
export function repartirIgual(totalEuros: number, n: number): number[] {
  if (n <= 0) return [];
  const totalC = Math.round(totalEuros * 100);
  const baseC = Math.floor(totalC / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? totalC - baseC * (n - 1) : baseC) / 100);
}
