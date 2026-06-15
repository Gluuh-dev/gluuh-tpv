/**
 * Motor de impuestos: IVA (península/Baleares) e IGIC (Canarias).
 *
 * En hostelería los precios de carta suelen llevar el impuesto INCLUIDO, por lo
 * que aquí se calcula la base y la cuota "desglosando hacia atrás" desde el PVP.
 *
 * Tipos vigentes a junio de 2026 — verificar cambios normativos (la UE presiona
 * para subir el IVA de hostelería al 21 %). Ver docs/07-facturacion-y-cumplimiento-legal.md §7.
 */

import type { Territorio, LineaImpuesto } from "../domain/types.js";

export type Impuesto = "IVA" | "IGIC" | "IPSI";

export const IMPUESTO_POR_TERRITORIO: Record<Territorio, Impuesto> = {
  PENINSULA_BALEARES: "IVA",
  CANARIAS: "IGIC",
  CEUTA_MELILLA: "IPSI",
};


export interface LineaFiscal {
  /** Importe total de la línea (PVP, impuesto INCLUIDO), en euros. */
  importe: number;
  /** Tipo impositivo en %. */
  tipo: number;
}

export interface ResultadoImpuestos {
  impuesto: Impuesto;
  /** Desglose por tipo impositivo (un ticket puede tener varios). */
  desglose: (LineaImpuesto & { importe: number })[];
  baseTotal: number;
  cuotaTotal: number;
  importeTotal: number;
}

const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Calcula el desglose de impuestos de un conjunto de líneas con el impuesto
 * INCLUIDO en el importe, agrupando por tipo. Soporta múltiples tipos en un
 * mismo ticket (p. ej. menú al 7 % + vino para llevar al 15 %).
 */
export function calcularImpuestosIncluidos(
  lineas: LineaFiscal[],
  territorio: Territorio,
): ResultadoImpuestos {
  const porTipo = new Map<number, { base: number; cuota: number; importe: number }>();

  for (const l of lineas) {
    const base = redondear(l.importe / (1 + l.tipo / 100));
    const cuota = redondear(l.importe - base);
    const acc = porTipo.get(l.tipo) ?? { base: 0, cuota: 0, importe: 0 };
    acc.base = redondear(acc.base + base);
    acc.cuota = redondear(acc.cuota + cuota);
    acc.importe = redondear(acc.importe + l.importe);
    porTipo.set(l.tipo, acc);
  }

  const desglose = [...porTipo.entries()]
    .map(([tipo, v]) => ({ tipo, base: v.base, cuota: v.cuota, importe: v.importe }))
    .sort((a, b) => a.tipo - b.tipo);

  return {
    impuesto: IMPUESTO_POR_TERRITORIO[territorio],
    desglose,
    baseTotal: redondear(desglose.reduce((s, d) => s + d.base, 0)),
    cuotaTotal: redondear(desglose.reduce((s, d) => s + d.cuota, 0)),
    importeTotal: redondear(desglose.reduce((s, d) => s + d.importe, 0)),
  };
}

/** Formatea un importe para los registros VERIFACTU: punto decimal, 2 decimales. */
export function formatImporte(n: number): string {
  return n.toFixed(2);
}
