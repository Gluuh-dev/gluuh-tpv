// Precio efectivo de una línea de comanda (módulo PURO, testeable):
// peso ("pid|@kg") o formato ("pid|fid") + suplementos de modificadores
// + precio manual y descuento por línea (con clamp a 0).
// Extraído de app/tpv/page.tsx (plan 015); el componente le pasa su contexto.
// Los imports de tipos son type-only: este módulo no arrastra React ni stores.
import { claveBase } from "./clave-linea";
import type { Prod, Formato, ModOpcion } from "../lib/catalogo-store";
import type { ModoDescuento } from "./hooks/useTpvStore";

export interface CtxPrecio {
  /** Índice O(1) del catálogo (productos + menús como pseudo-productos). */
  prodPorId: Map<string, Prod>;
  formatos: Record<string, Formato[]>;
  modById: Record<string, ModOpcion>;
  /** Precio manual por CLAVE COMPLETA de línea (incluido el sufijo "#n"). */
  preciosManuales: Record<string, number>;
  /** Descuento por CLAVE COMPLETA de línea. */
  descuentos: Record<string, ModoDescuento>;
  /**
   * Precio de la TARIFA activa, por producto (migración 0131). La tarifa la
   * elige la SALA de la mesa (`room.tarifa_id`) o el cliente.
   *
   * Vacío o sin entrada para un producto = se cobra su precio normal. Esa es la
   * misma regla que aplica el servidor (`precio_de_venta`): una tarifa a medio
   * rellenar cobra de más, nunca regala el género.
   */
  preciosTarifa?: Record<string, number>;
}

export function precioEfectivo(ctx: CtxPrecio, id: string): number {
  const [pid, fid, mods] = claveBase(id).split("|");   // el "#n" no altera producto/precio base
  const prod = pid ? ctx.prodPorId.get(pid) : undefined;
  if (!prod) return 0;
  // El precio de partida es el de la tarifa, si esa tarifa dice algo de este
  // producto; si no, el de siempre.
  const precioBase = ctx.preciosTarifa?.[pid!] ?? prod.precio;
  let calc: number;
  if (fid?.startsWith("@")) calc = precioBase * (parseFloat(fid.slice(1)) || 0);   // €/kg × peso
  else {
    const fmt = fid ? (ctx.formatos[pid!] ?? []).find((f) => f.id === fid) : undefined;
    // ⚠ Un FORMATO manda sobre la tarifa: `product_price` es por ARTÍCULO y no
    // hay precio por formato×tarifa en el modelo. Ajustarlo "proporcionalmente"
    // sería inventarse lo que cobra el bar, así que no se hace: si una tarifa
    // tiene que cambiar el precio de un formato, hace falta modelo nuevo.
    calc = fmt ? fmt.precio : precioBase;
  }
  let base = ctx.preciosManuales[id] ?? calc;
  if (mods) {
    for (const m of mods.split(",")) {
      base += ctx.modById[m]?.precio_extra ?? 0;
    }
  }
  const desc = ctx.descuentos[id];
  if (!desc) return base;
  if (desc.tipo === "PCT") return Math.max(0, base * (1 - desc.valor / 100));
  return Math.max(0, base - desc.valor);
}
