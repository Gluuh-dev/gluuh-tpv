import { leer, escribir, haySesion, tenantId } from "../../../lib/nodo";

// ============================================================================
// COMPRAS (datos) — albaranes y facturas de proveedor, desde el propio TPV.
//
// Un albarán no es "anotar que entró algo": es un documento con proveedor,
// número, fecha y precios, y es de donde sale el COSTE real de la carta. Por eso
// vive en `purchase_doc` + `purchase_line` (migración 0130) y no en un apunte
// suelto de `stock_move`.
//
// Una línea apunta a un ARTÍCULO o a un INGREDIENTE, nunca a los dos: un bar
// compra cajas de cerveza (que revende tal cual) y kilos de tomate (que
// transforma). Y guarda SIEMPRE la descripción del albarán aunque esté casada,
// porque si mañana se borra el artículo la compra tiene que seguir contando qué
// se compró.
// ============================================================================

export type TipoDoc = "ALBARAN" | "FACTURA";
export type EstadoDoc = "BORRADOR" | "RECIBIDO" | "ANULADO";

export interface LineaCompra {
  id: string;
  productId: string | null;
  ingredientId: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  descuentoPct: number;
  tipoImpositivo: number;
}

export interface DocumentoCompra {
  id: string;
  supplierId: string | null;
  tipo: TipoDoc;
  estado: EstadoDoc;
  numero: string;
  fecha: string;      // YYYY-MM-DD
  notas: string;
  lineas: LineaCompra[];
}

export interface Proveedor { id: string; nombre: string; nif: string }

// ── Dinero ──────────────────────────────────────────────────────────────────

/** Céntimos exactos: `toFixed` a mitad de cálculo arrastra el error a la suma. */
const c2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Importe de una línea SIN impuesto, con su descuento aplicado.
 *
 * Al contrario que en la carta, aquí los precios van SIN impuesto incluido: un
 * albarán de proveedor los da así, y sumarlos como si lo llevaran inflaría el
 * coste un 7-21 % y el margen saldría mentira.
 */
export const baseLinea = (l: Pick<LineaCompra, "cantidad" | "precioUnitario" | "descuentoPct">): number =>
  c2(l.cantidad * l.precioUnitario * (1 - l.descuentoPct / 100));

export interface Totales { base: number; impuestos: number; total: number }

/**
 * Totales del documento.
 *
 * El impuesto se calcula POR LÍNEA y luego se suma: un albarán mezcla tipos
 * (7 % la comida, 21 % la limpieza), así que aplicar un tipo medio al total
 * daría un número que no cuadra con la factura del proveedor — y esa factura la
 * mira Hacienda.
 */
export function totales(lineas: readonly LineaCompra[]): Totales {
  let base = 0;
  let impuestos = 0;
  for (const l of lineas) {
    const b = baseLinea(l);
    base += b;
    impuestos += c2(b * (l.tipoImpositivo / 100));
  }
  base = c2(base);
  impuestos = c2(impuestos);
  return { base, impuestos, total: c2(base + impuestos) };
}

// ── Carga y guardado ────────────────────────────────────────────────────────

const num = (v: number | string | null | undefined, pordefecto = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : pordefecto;
};

interface FilaLinea {
  id: string; product_id: string | null; ingredient_id: string | null;
  descripcion: string; cantidad: number | string | null; unidad: string | null;
  precio_unitario: number | string | null; descuento_pct: number | string | null;
  tipo_impositivo: number | string | null; orden: number | null;
}

interface FilaDoc {
  id: string; supplier_id: string | null; tipo: string; estado: string;
  numero: string | null; fecha: string; notas: string | null;
  purchase_line: FilaLinea[] | null;
}

const COLUMNAS =
  "id,supplier_id,tipo,estado,numero,fecha,notas," +
  "purchase_line(id,product_id,ingredient_id,descripcion,cantidad,unidad,precio_unitario,descuento_pct,tipo_impositivo,orden)";

const aDocumento = (d: FilaDoc): DocumentoCompra => ({
  id: d.id,
  supplierId: d.supplier_id,
  tipo: d.tipo === "FACTURA" ? "FACTURA" : "ALBARAN",
  estado: d.estado === "RECIBIDO" || d.estado === "ANULADO" ? d.estado : "BORRADOR",
  numero: d.numero ?? "",
  fecha: d.fecha,
  notas: d.notas ?? "",
  lineas: (d.purchase_line ?? [])
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((l) => ({
      id: l.id,
      productId: l.product_id,
      ingredientId: l.ingredient_id,
      descripcion: l.descripcion,
      cantidad: num(l.cantidad, 1),
      unidad: l.unidad ?? "ud",
      precioUnitario: num(l.precio_unitario),
      descuentoPct: num(l.descuento_pct),
      tipoImpositivo: num(l.tipo_impositivo),
    })),
});

export interface Compras { documentos: DocumentoCompra[]; proveedores: Proveedor[] }

/** Las compras del bar, o `null` si el terminal no está emparejado. */
export async function cargarCompras(): Promise<Compras | null> {
  if (!haySesion()) return null;
  const [docs, provs] = await Promise.all([
    leer<FilaDoc>(`purchase_doc?select=${COLUMNAS}&order=fecha.desc`),
    leer<{ id: string; nombre: string; nif: string | null }>("supplier?select=id,nombre,nif&activo=is.true&order=nombre"),
  ]);
  if (!docs || !provs) return null;
  return {
    documentos: docs.map(aDocumento),
    proveedores: provs.map((p) => ({ id: p.id, nombre: p.nombre, nif: p.nif ?? "" })),
  };
}

function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

/** Guarda el documento con sus líneas. Un RECIBIDO ya no se toca (ver `recibir`). */
export async function guardarCompra(d: DocumentoCompra): Promise<void> {
  const tenant_id = bar();
  const t = totales(d.lineas);

  await escribir("purchase_doc?on_conflict=id", "POST", [{
    id: d.id, tenant_id, supplier_id: d.supplierId, tipo: d.tipo, estado: d.estado,
    numero: d.numero || null, fecha: d.fecha, notas: d.notas || null,
    base: t.base, impuestos: t.impuestos, total: t.total,
    updated_at: new Date().toISOString(),
  }]);

  // Las líneas se reescriben enteras: son pocas y así una línea quitada no se
  // queda viva sumando al total del albarán.
  await escribir(`purchase_line?purchase_doc_id=eq.${d.id}`, "DELETE");
  if (d.lineas.length === 0) return;
  await escribir("purchase_line", "POST", d.lineas.map((l, i) => ({
    id: l.id, tenant_id, purchase_doc_id: d.id,
    product_id: l.productId, ingredient_id: l.ingredientId,
    descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad,
    precio_unitario: l.precioUnitario, descuento_pct: l.descuentoPct,
    tipo_impositivo: l.tipoImpositivo, orden: i,
    updated_at: new Date().toISOString(),
  })));
}

/**
 * RECIBIR: mete la mercancía en el almacén.
 *
 * Es el único paso que toca existencias, y por eso es explícito y de ida: un
 * albarán en BORRADOR se puede corregir todo lo que haga falta, pero en cuanto
 * se recibe ha movido stock y ya no se edita — se corrige con otro documento,
 * como en cualquier contabilidad. Si se pudiera editar, cambiar una cantidad
 * dejaría el stock descuadrado sin que nadie se enterara.
 */
export async function recibirCompra(d: DocumentoCompra): Promise<void> {
  if (d.estado !== "BORRADOR") throw new Error("Este documento ya se recibió; corrígelo con otro.");
  const tenant_id = bar();
  await guardarCompra({ ...d, estado: "BORRADOR" });

  const conDestino = d.lineas.filter((l) => l.productId ?? l.ingredientId);
  if (conDestino.length > 0) {
    await escribir("stock_move", "POST", conDestino.map((l) => ({
      tenant_id, product_id: l.productId, ingredient_id: l.ingredientId,
      purchase_line_id: l.id, tipo: "ENTRADA", cantidad: l.cantidad,
      motivo: `${d.tipo === "FACTURA" ? "Factura" : "Albarán"} ${d.numero || "sin número"}`,
    })));
  }

  await escribir(`purchase_doc?id=eq.${d.id}`, "PATCH", {
    estado: "RECIBIDO", updated_at: new Date().toISOString(),
  });
}

export async function borrarCompra(id: string): Promise<void> {
  await escribir(`purchase_doc?id=eq.${id}`, "DELETE");
}

export async function crearProveedor(id: string, nombre: string): Promise<void> {
  await escribir("supplier", "POST", [{ id, tenant_id: bar(), nombre }]);
}
