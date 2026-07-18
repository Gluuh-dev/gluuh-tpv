// Mapeo de los pagos del cobro (módulo PURO, ruta del dinero — testeable).
// Extraído de app/tpv/page.tsx (E1.3): reparte los importes tecleados entre las
// formas de pago, clampa al pendiente, coloca la propina y decide si abrir cajón.
// El desglose fiscal NO se toca aquí (lo calcula /api/ticket con @gluuh/core).
import type { CobrarOpciones, LineaPago } from "./components/CobrarModal";

export type Metodo = "EFECTIVO" | "TARJETA" | "BIZUM" | "WALLET";

// payment_method.tipo (EFECTIVO/TARJETA/BIZUM/VALE/OTRO) → payment.metodo (CHECK del esquema).
export function metodoPago(tipo?: string): Metodo {
  switch (tipo) {
    case "EFECTIVO": return "EFECTIVO";
    case "TARJETA": return "TARJETA";
    case "BIZUM": return "BIZUM";
    default: return "WALLET";   // VALE / OTRO / desconocido → monedero
  }
}

/** Forma de pago mínima que necesita el mapeo (tipo → método, y si abre cajón). */
export interface FormaResuelta { id: string; tipo: string; abre_cajon: boolean }

export interface FilaPago { metodo: Metodo; importe: number; propina: number }

/**
 * Reparte `pagos` contra el importe debido (`base` + propina − descuento, clamp a 0):
 * cada línea se limita al pendiente restante; la propina va aparte, descontada del
 * primer importe para no doble-contarla. Abre cajón si alguna forma usada lo pide.
 */
export function mapearPagos(
  pagos: LineaPago[],
  base: number,
  opts: CobrarOpciones,
  formas: FormaResuelta[],
): { filas: FilaPago[]; abrirCajon: boolean | undefined } {
  const due = Math.max(0, Math.round((base + (opts.propina || 0) - (opts.descuento || 0)) * 100) / 100);
  const prop = Math.round((opts.propina || 0) * 100) / 100;
  let restante = due;
  const filas: FilaPago[] = [];
  for (const p of pagos) {
    const imp = Math.min(Math.round(p.importe * 100) / 100, restante);
    if (imp <= 0) continue;
    const forma = formas.find((f) => f.id === p.formaPagoId);
    filas.push({ metodo: metodoPago(forma?.tipo), importe: imp, propina: 0 });
    restante = Math.round((restante - imp) * 100) / 100;
  }
  // La propina va aparte: se descuenta del primer importe para no doble-contarla.
  const primera = filas[0];
  if (prop > 0 && primera) { primera.propina = prop; primera.importe = Math.max(0, Math.round((primera.importe - prop) * 100) / 100); }
  const abrirCajon = pagos.some((p) => formas.find((f) => f.id === p.formaPagoId)?.abre_cajon) || undefined;
  return { filas, abrirCajon };
}
