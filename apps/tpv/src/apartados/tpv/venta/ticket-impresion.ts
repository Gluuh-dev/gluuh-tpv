import { PRODUCTOS_DEMO } from "../datos";
import { useVenta } from "../store";
import { imprimirComanda } from "../../../lib/impresion";
import type { TicketImpresion, DisenoTicket, ComandaImpresion } from "../../../lib/impresion";

// Construye el TicketImpresion a partir del carrito de la venta (store) para
// IMPRIMIR DE PRUEBA al cobrar. `esPrueba: true` y sin QR/huella → no toca
// /api/ticket ni node:crypto: imprime sin backend, en navegador o en Electron.
// Cuando se cablee el nodo, esto se sustituye por el ticket fiscal real.

const LOCAL_DEMO = { nombre: "Bar La Alameda", cif: "B00000000", direccion: "C/ Mayor 1 · Santa Cruz de La Palma" };
export const DISENO_DEMO: DisenoTicket = { anchoMm: 80, cabecera: "Cafetería · Terraza", pie: "¡Gracias por su visita!\nwww.gluuh.com" };

function nombreProducto(id: string): string {
  const base = id.split("|")[0]!;
  return PRODUCTOS_DEMO.find((p) => p.id === base)?.nombre ?? base;
}

export function construirTicketPrueba(opts: Readonly<{
  contexto: string;
  operario?: string;
  baseImponible: number;
  impuesto: number;
  total: number;
  descuento?: number;
  propina?: number;
  proforma?: boolean;
}>): TicketImpresion {
  const s = useVenta.getState();
  const lineas: TicketImpresion["lineas"] = Object.entries(s.comanda)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({
      cantidad: q,
      nombre: nombreProducto(id),
      importe: s.invitadas[id] ? 0 : s.precioEfectivo(id) * q,
    }));
  // Descuento global y propina como líneas, para que la suma cuadre con el total.
  if (opts.descuento) lineas.push({ cantidad: 1, nombre: "Descuento", importe: -opts.descuento });
  if (opts.propina) lineas.push({ cantidad: 1, nombre: "Propina", importe: opts.propina });

  return {
    local: LOCAL_DEMO,
    contexto: opts.contexto || "Barra",
    operario: opts.operario,
    lineas,
    desglose: [
      { etiqueta: "Base imponible", cuota: opts.baseImponible },
      { etiqueta: "IVA 10%", cuota: opts.impuesto },
    ],
    total: opts.total,
    esPrueba: true,
    proforma: opts.proforma,
  };
}

// ── MARCHAR: comanda(s) de cocina/barra, agrupadas por ESTACIÓN ──
// La estación real la hereda el producto de su familia (config del panel). En la
// demo no hay estación por producto, así que se deduce de la categoría: bebidas →
// BARRA, el resto → COCINA. Al cablear el nodo, se sustituye por la estación real.
export type Estacion = "COCINA" | "BARRA";
const CATEGORIAS_BARRA = new Set(["cervezas", "vinos", "refrescos", "cafes", "copas", "combinados", "bebidas"]);

export function estacionDeCategoria(categoria: string): Estacion {
  return CATEGORIAS_BARRA.has(categoria) ? "BARRA" : "COCINA";
}

/** Comanda(s) a marchar desde unas líneas pendientes, una por estación. */
export function construirComandas(
  contexto: string,
  operario: string | undefined,
  pendientes: readonly { id: string; cantidad: number }[],
): { estacion: Estacion; comanda: ComandaImpresion }[] {
  const porEstacion: Record<Estacion, ComandaImpresion["lineas"]> = { COCINA: [], BARRA: [] };
  for (const { id, cantidad } of pendientes) {
    if (cantidad <= 0) continue;
    const base = id.split("|")[0]!;
    const p = PRODUCTOS_DEMO.find((x) => x.id === base);
    porEstacion[estacionDeCategoria(p?.categoria ?? "")].push({ cantidad, nombre: p?.nombre ?? base });
  }
  return (["COCINA", "BARRA"] as Estacion[])
    .filter((e) => porEstacion[e].length > 0)
    .map((e) => ({ estacion: e, comanda: { contexto: contexto || "Barra", operario, lineas: porEstacion[e] } }));
}

// MARCHAR: imprime la comanda de lo PENDIENTE (entero, o solo `ids`) por estación y
// marca esas líneas como marchadas. Devuelve las estaciones a las que fue (para
// el aviso). No cobra ni vacía: la cuenta sigue abierta.
export function marcharPendientes(opts: Readonly<{ ids?: string[]; operario?: string }> = {}): Estacion[] {
  const s = useVenta.getState();
  let pend = s.pendientes();
  if (opts.ids) { const sel = new Set(opts.ids); pend = pend.filter((p) => sel.has(p.id)); }
  if (!pend.length) return [];
  const comandas = construirComandas(s.contexto, opts.operario ?? "María Ruiz", pend);
  for (const { estacion, comanda } of comandas) void imprimirComanda(comanda, `COMANDA · ${estacion}`);
  s.marcarMarchado(pend.map((p) => p.id));
  return comandas.map((c) => c.estacion);
}
