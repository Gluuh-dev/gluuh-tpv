import { PRODUCTOS_DEMO } from "../datos";
import { useVenta } from "../store";
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

/** Comanda(s) a marchar desde el carrito, una por estación con productos. */
export function construirComandas(contexto: string, operario?: string): { estacion: Estacion; comanda: ComandaImpresion }[] {
  const s = useVenta.getState();
  const porEstacion: Record<Estacion, ComandaImpresion["lineas"]> = { COCINA: [], BARRA: [] };
  for (const [id, q] of Object.entries(s.comanda)) {
    if (q <= 0) continue;
    const base = id.split("|")[0]!;
    const p = PRODUCTOS_DEMO.find((x) => x.id === base);
    porEstacion[estacionDeCategoria(p?.categoria ?? "")].push({ cantidad: q, nombre: p?.nombre ?? base });
  }
  return (["COCINA", "BARRA"] as Estacion[])
    .filter((e) => porEstacion[e].length > 0)
    .map((e) => ({ estacion: e, comanda: { contexto: contexto || "Barra", operario, lineas: porEstacion[e] } }));
}
