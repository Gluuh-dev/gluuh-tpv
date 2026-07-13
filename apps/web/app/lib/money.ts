// Formato de dinero ÚNICO de la app (es-ES): 1234.5 → "1.234,50 €".
// Antes había 34 copias locales de `eur()` con TRES salidas distintas en pantalla
// ("1234.50 €", "1234,50 €", "1.234,50 €") dentro del mismo producto español.
//
// El formateador se crea UNA vez (Intl.NumberFormat es caro de construir y esto
// se llama por línea de ticket y por tile, en cada render).
//
// OJO: la impresión térmica NO usa esto (`eurTxt` en app/lib/impresion.ts): el
// ticket ESC/POS tiene columnas de ancho fijo y su propio formato; no unificar.
const FMT_EUR = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Importe en euros con formato español. Tolera null/undefined/NaN → "0,00 €". */
export const eur = (n: number | null | undefined): string => `${FMT_EUR.format(Number(n) || 0)} €`;
