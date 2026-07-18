// Nombres y extras de una línea de comanda (módulo PURO, testeable):
// resuelve el nombre visible (base + formato/peso + modificadores), el nombre
// "base" (sin modificadores), el desglose de ingredientes extra, y el reparto
// de un precio manual entre base y extras.
// Extraído de app/tpv/page.tsx (plan 24, E1.3); el componente le pasa su contexto.
// Mismo patrón que ./precio.ts: imports type-only, sin React ni stores.
import { claveBase } from "./clave-linea";
import type { Prod, Formato, ModOpcion } from "../lib/catalogo-store";

export interface CtxNombres {
  /** Índice O(1) del catálogo (productos + menús como pseudo-productos). */
  prodPorId: Map<string, Prod>;
  formatos: Record<string, Formato[]>;
  modById: Record<string, ModOpcion>;
}

export interface ExtraDetalle {
  nombre: string;
  precio: number;
  uds: number;
}

/** Nombre completo: base (o nombre_ticket/nombre_cocina) + formato/peso + modificadores. */
export function nombreDeKey(ctx: CtxNombres, key: string, campo?: "nombre_ticket" | "nombre_cocina"): string {
  const [pid, fid, mods] = claveBase(key).split("|");
  const p = pid ? ctx.prodPorId.get(pid) : undefined;
  if (!p) return "";
  const base = (campo && p[campo]) || p.nombre;
  let nombre: string;
  if (fid?.startsWith("@")) nombre = `${base} (${fid.slice(1)} kg)`;   // por peso
  else {
    const fmt = fid ? (ctx.formatos[p.id] ?? []).find((f) => f.id === fid) : undefined;
    nombre = fmt ? `${base} (${fmt.nombre})` : base;
  }
  if (mods) {
    const ns = mods.split(",").map((m) => ctx.modById[m]?.nombre).filter(Boolean);
    if (ns.length) nombre += ` · ${ns.join(", ")}`;
  }
  return nombre;
}

/** Nombre base: igual que nombreDeKey pero SIN el sufijo de modificadores. */
export function nombreBaseDeKey(ctx: CtxNombres, key: string, campo?: "nombre_ticket" | "nombre_cocina"): string {
  const [pid, fid] = claveBase(key).split("|");
  const p = pid ? ctx.prodPorId.get(pid) : undefined;
  if (!p) return "";
  const base = (campo && p[campo]) || p.nombre;
  if (fid?.startsWith("@")) return `${base} (${fid.slice(1)} kg)`;
  const fmt = fid ? (ctx.formatos[p.id] ?? []).find((f) => f.id === fid) : undefined;
  return fmt ? `${base} (${fmt.nombre})` : base;
}

/** Ingredientes extra (modificadores) agrupados por id, con su precio y unidades. */
export function extraIngredientesDetallados(ctx: CtxNombres, key: string): ExtraDetalle[] {
  const [, , mods] = claveBase(key).split("|");
  if (!mods) return [];
  const counts: Record<string, number> = {};
  for (const m of mods.split(",")) {
    counts[m] = (counts[m] ?? 0) + 1;
  }
  return Object.entries(counts).map(([mId, uds]) => {
    const mod = ctx.modById[mId];
    return {
      nombre: mod?.nombre ?? mId,
      precio: mod?.precio_extra ?? 0,
      uds,
    };
  });
}

/** Si el precio unitario efectivo difiere del calculado, devuelve la base manual
 *  (precio - coste de extras, clamp a 0); si no difiere, undefined. */
export function obtenerBaseManualSiDifiere(ctx: CtxNombres, baseKey: string, precioUnitario: number): number | undefined {
  const [pid, fid, mods] = baseKey.split("|");
  // Solo products reales (las líneas de menú llegan con product_id NULL y no pasan por aquí).
  const prod = pid ? ctx.prodPorId.get(pid) : undefined;
  if (!prod) return undefined;
  let calcBase = prod.precio;
  if (fid && !fid.startsWith("@")) {
    const fmt = (ctx.formatos[pid!] ?? []).find((f) => f.id === fid);
    if (fmt) calcBase = fmt.precio;
  }
  let calcTotal = calcBase;
  if (mods) {
    for (const m of mods.split(",")) {
      calcTotal += ctx.modById[m]?.precio_extra ?? 0;
    }
  }
  if (Math.abs(precioUnitario - calcTotal) > 0.01) {
    const extrasCost = calcTotal - calcBase;
    return Math.max(0, precioUnitario - extrasCost);
  }
  return undefined;
}
