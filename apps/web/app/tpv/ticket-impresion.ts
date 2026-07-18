// Piezas puras de la construcción del ticket/proforma imprimible (E1.3).
// Extraído de app/tpv/page.tsx para no duplicar la construcción de líneas entre
// el ticket fiscal y la proforma (una deriva ahí = ticket y cuenta que no cuadran).
// Sin React ni stores: recibe el contexto de nombres (ver ./nombres.ts).
import { nombreBaseDeKey, extraIngredientesDetallados, type CtxNombres } from "./nombres";
import type { TicketImpresion } from "../lib/impresion";

/** Línea de comanda mínima que necesita la impresión (clave + cantidad + precio unitario). */
export interface LineaComandaImpr {
  id: string;
  cantidad: number;
  precio: number;
}

type LineaTicket = TicketImpresion["lineas"][number];

/** Etiqueta de contexto del documento: mesa, "Para llevar · X" o "Barra". */
export function etiquetaContexto(
  mesa: { nombre: string } | null,
  llevar: { nombre: string } | null,
): string {
  return mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Barra";
}

/** Líneas imprimibles del ticket/proforma: nombre (nombre_ticket) + importe + extras. */
export function lineasImprimibles(ctxN: CtxNombres, lineas: LineaComandaImpr[]): LineaTicket[] {
  return lineas.map((l) => ({
    cantidad: l.cantidad,
    nombre: nombreBaseDeKey(ctxN, l.id, "nombre_ticket"),
    importe: l.precio * l.cantidad,
    extras: extraIngredientesDetallados(ctxN, l.id).map((ext) => ({
      nombre: ext.nombre,
      cantidad: ext.uds,
      precioExtra: ext.precio,
    })),
  }));
}
