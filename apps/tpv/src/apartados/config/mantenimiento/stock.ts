import { leer, escribir, haySesion, tenantId } from "../../../lib/nodo";

// ============================================================================
// STOCK Y COMPRAS DE UN ARTÍCULO — las dos pestañas que faltaban en la ficha.
//
// Ahora tienen modelo detrás: `product.stock` (0130) y las líneas de compra que
// apuntan a este artículo. Antes de la 0130 esto no se podía enseñar sin
// inventárselo, y por eso no estaba.
// ============================================================================

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE" | "MERMA";

export interface Movimiento {
  id: string;
  tipo: string;
  cantidad: number;
  motivo: string;
  fecha: string;
}

export interface CompraDeArticulo {
  lineaId: string;
  fecha: string;
  numero: string;
  proveedor: string;
  estado: string;
  cantidad: number;
  precioUnitario: number;
}

export interface StockArticulo {
  existencias: number;
  minimo: number | null;
  movimientos: Movimiento[];
  compras: CompraDeArticulo[];
}

const num = (v: number | string | null | undefined, pordefecto = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : pordefecto;
};

/**
 * ¿Hay que reponer?
 *
 * Sin mínimo no hay aviso: un artículo que no se controla no tiene por qué
 * salir en rojo solo porque esté a cero (una tapa del día no se «repone»).
 */
export function bajoMinimo(existencias: number, minimo: number | null): boolean {
  return minimo !== null && existencias <= minimo;
}

/**
 * Coste medio de compra, ponderado por cantidad.
 *
 * Ponderado y no la media de los precios: si compraste 100 unidades a 0,50 € y
 * 2 a 3 €, el coste real está cerca de 0,55 y no de 1,75. Con la media simple el
 * margen de la carta saldría mal por goleada.
 *
 * Solo cuentan las compras RECIBIDAS: un borrador es una intención, no un coste.
 */
export function costeMedio(compras: readonly CompraDeArticulo[]): number | null {
  const recibidas = compras.filter((c) => c.estado === "RECIBIDO" && c.cantidad > 0);
  if (recibidas.length === 0) return null;
  const unidades = recibidas.reduce((s, c) => s + c.cantidad, 0);
  if (unidades <= 0) return null;
  const gasto = recibidas.reduce((s, c) => s + c.cantidad * c.precioUnitario, 0);
  return Math.round((gasto / unidades) * 10000) / 10000;
}

interface FilaMov {
  id: string; tipo: string; cantidad: number | string | null;
  motivo: string | null; created_at: string;
}

interface FilaCompra {
  id: string; cantidad: number | string | null; precio_unitario: number | string | null;
  purchase_doc: {
    numero: string | null; fecha: string; estado: string;
    supplier: { nombre: string } | null;
  } | null;
}

/** Stock y compras de un artículo, o `null` si el terminal no está emparejado. */
export async function cargarStock(productId: string): Promise<StockArticulo | null> {
  if (!haySesion()) return null;
  const [prod, movs, compras] = await Promise.all([
    leer<{ stock: number | string | null; stock_minimo: number | string | null }>(
      `product?id=eq.${productId}&select=stock,stock_minimo`),
    leer<FilaMov>(`stock_move?product_id=eq.${productId}&select=id,tipo,cantidad,motivo,created_at&order=created_at.desc&limit=50`),
    leer<FilaCompra>(
      `purchase_line?product_id=eq.${productId}` +
      "&select=id,cantidad,precio_unitario,purchase_doc(numero,fecha,estado,supplier(nombre))" +
      "&order=id.desc&limit=50"),
  ]);
  if (!prod || !movs || !compras) return null;

  const p = prod[0];
  return {
    existencias: num(p?.stock),
    minimo: p?.stock_minimo === null || p?.stock_minimo === undefined ? null : num(p.stock_minimo),
    movimientos: movs.map((m) => ({
      id: m.id, tipo: m.tipo, cantidad: num(m.cantidad),
      motivo: m.motivo ?? "", fecha: m.created_at.slice(0, 10),
    })),
    compras: compras.map((c) => ({
      lineaId: c.id,
      fecha: c.purchase_doc?.fecha ?? "",
      numero: c.purchase_doc?.numero ?? "",
      proveedor: c.purchase_doc?.supplier?.nombre ?? "Sin proveedor",
      estado: c.purchase_doc?.estado ?? "BORRADOR",
      cantidad: num(c.cantidad),
      precioUnitario: num(c.precio_unitario),
    })),
  };
}

function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

/**
 * Ajuste manual de existencias (recuento, merma, rotura).
 *
 * Guarda el MOVIMIENTO además de cambiar el número, y el motivo es obligatorio.
 * Un stock que cambia sin dejar rastro es un stock en el que nadie confía: a la
 * tercera descuadre, el dueño deja de mirarlo.
 */
export async function ajustarStock(
  productId: string, existenciasNuevas: number, existenciasAntes: number, motivo: string,
): Promise<void> {
  const tenant_id = bar();
  const diferencia = existenciasNuevas - existenciasAntes;
  if (diferencia === 0) return;
  if (!motivo.trim()) throw new Error("Un ajuste de stock sin motivo no se guarda: dentro de un mes nadie sabrá por qué.");

  await escribir("stock_move", "POST", [{
    tenant_id, product_id: productId,
    tipo: diferencia > 0 ? "AJUSTE" : "MERMA",
    cantidad: Math.abs(diferencia),
    motivo: motivo.trim(),
  }]);
  await escribir(`product?id=eq.${productId}`, "PATCH", {
    stock: existenciasNuevas, updated_at: new Date().toISOString(),
  });
}

export async function fijarMinimo(productId: string, minimo: number | null): Promise<void> {
  await escribir(`product?id=eq.${productId}`, "PATCH", {
    stock_minimo: minimo, updated_at: new Date().toISOString(),
  });
}
