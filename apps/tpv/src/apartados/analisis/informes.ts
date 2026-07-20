// CATÁLOGO DE INFORMES, con la organización de Ágora (docs/especificaciones/
// mapa-agora-completo.md §Informes). Ágora los agrupa en columnas y deja marcar
// favoritos con una estrella; esto es lo mismo.
//
// REGLA: un informe que no podemos servir sale ATENUADO y lo dice. Enseñar 50
// informes que abren una pantalla vacía es peor que enseñar 8 que funcionan —
// el dueño pierde la confianza en todos, incluidos los buenos.

/** Secciones del Análisis a las que puede llevar un informe (las que existen). */
export type SeccionInforme = "resumen" | "ventas" | "diario" | "productos" | "camareros" | "caja" | "impuestos";

export interface Informe {
  id: string;
  nombre: string;
  /** A dónde lleva. Sin esto, el informe está pendiente y sale atenuado. */
  va?: SeccionInforme;
  /** Por qué no está todavía (se ve al pasar por encima). */
  falta?: string;
}

export interface GrupoInformes {
  titulo: string;
  informes: Informe[];
}

const PEND_COMPRAS = "Necesita el módulo de compras y almacén";
const PEND_CLIENTES = "Necesita ventas con cliente asignado";
const PEND_HIST = "Necesita histórico: llega cuando el nodo acumule jornadas";
const PEND_CENTROS = "Necesita centros de venta configurados";
const PEND_PERIODOS = "Necesita periodos de servicio configurados";

export const CATALOGO: GrupoInformes[] = [
  {
    titulo: "Análisis",
    informes: [
      { id: "an-ventas", nombre: "Análisis de Ventas", va: "resumen" },
      { id: "an-compras", nombre: "Análisis de Compras", falta: PEND_COMPRAS },
      { id: "an-stocks", nombre: "Análisis de Stocks", falta: PEND_COMPRAS },
    ],
  },
  {
    titulo: "Ventas",
    informes: [
      { id: "ve-evolucion", nombre: "Evolución de Ventas", va: "ventas" },
      { id: "ve-comparativa", nombre: "Comparativa Interanual", falta: PEND_HIST },
      { id: "ve-fiscal", nombre: "Resumen Fiscal", va: "impuestos" },
      { id: "ve-invitaciones", nombre: "Invitaciones", falta: "Necesita registrar las invitaciones al cobrar" },
      { id: "ve-reservas", nombre: "Reservas", falta: "Necesita el módulo de reservas" },
      { id: "ve-347", nombre: "Documento 347", falta: PEND_CLIENTES },
      { id: "ve-diario", nombre: "Diario de Ventas", va: "diario" },
    ],
  },
  {
    titulo: "Catálogo",
    informes: [
      { id: "ca-top50", nombre: "Top 50 Productos", va: "productos" },
      { id: "ca-familias", nombre: "Familias y Productos", va: "productos" },
      { id: "ca-margenes-fam", nombre: "Márgenes por Familias", falta: "Necesita el coste de cada artículo (escandallo)" },
      { id: "ca-margenes-cat", nombre: "Márgenes por Categorías", falta: "Necesita el coste de cada artículo (escandallo)" },
      { id: "ca-menu-eng", nombre: "Menú Engineering", falta: "Necesita coste y margen por artículo" },
      { id: "ca-historico", nombre: "Histórico de Ventas", va: "diario" },
      { id: "ca-alergenos", nombre: "Alérgenos por Producto", falta: "Necesita los alérgenos rellenos en la ficha" },
      { id: "ca-promos", nombre: "Promociones y Productos", falta: "Necesita promociones activas" },
      { id: "ca-ventas-diarias", nombre: "Ventas Diarias", va: "ventas" },
    ],
  },
  {
    titulo: "Usuarios",
    informes: [
      { id: "us-rendimiento", nombre: "Rendimiento de Usuarios", va: "camareros" },
      { id: "us-propinas", nombre: "Propinas por Usuario", va: "camareros" },
      { id: "us-productos", nombre: "Productos por Usuario", falta: "Necesita la venta detallada por operario" },
      { id: "us-desc-prod", nombre: "Descuentos por Usuario y Producto", falta: "Necesita registrar quién aplica cada descuento" },
      { id: "us-cancel", nombre: "Cancelaciones por Usuario", falta: "Necesita registrar el motivo de cancelación" },
      { id: "us-asistencia", nombre: "Asistencia por Usuario", falta: "Necesita fichajes (entrada/salida)" },
    ],
  },
  {
    titulo: "Caja",
    informes: [
      { id: "cj-formas", nombre: "Formas de Pago", va: "caja" },
      { id: "cj-cierres", nombre: "Cierres de Caja (Z)", va: "caja" },
      { id: "cj-movimientos", nombre: "Movimientos de Caja", falta: "Necesita apuntes de caja (entradas/salidas)" },
      { id: "cj-pendientes", nombre: "Cobros Pendientes", falta: PEND_CLIENTES },
      { id: "cj-tarifas", nombre: "Tarifas", falta: "Necesita tarifas configuradas" },
    ],
  },
  {
    titulo: "Centros de venta",
    informes: [
      { id: "cv-centros", nombre: "Centros de Venta", falta: PEND_CENTROS },
      { id: "cv-ubicacion", nombre: "Ventas por Ubicación", falta: PEND_CENTROS },
      { id: "cv-comensales", nombre: "Comensales por Centro", falta: PEND_CENTROS },
    ],
  },
  {
    titulo: "Periodos de servicio",
    informes: [
      { id: "ps-productos", nombre: "Productos por Periodo", falta: PEND_PERIODOS },
      { id: "ps-comensales", nombre: "Comensales por Periodo", falta: PEND_PERIODOS },
      { id: "ps-operaciones", nombre: "Operaciones por Periodo", falta: PEND_PERIODOS },
    ],
  },
  {
    titulo: "Clientes",
    informes: [
      { id: "cl-ventas", nombre: "Ventas a Cliente", falta: PEND_CLIENTES },
      { id: "cl-facturas", nombre: "Facturas por Cliente", falta: PEND_CLIENTES },
      { id: "cl-impuestos", nombre: "Impuestos por Cliente", falta: PEND_CLIENTES },
      { id: "cl-productos", nombre: "Productos Vendidos a Cada Cliente", falta: PEND_CLIENTES },
    ],
  },
];

export const totalInformes = CATALOGO.reduce((n, g) => n + g.informes.length, 0);
export const disponibles = CATALOGO.reduce((n, g) => n + g.informes.filter((i) => i.va).length, 0);

// ── Favoritos (la estrella de Ágora) ────────────────────────────────────────
const CLAVE_FAV = "gluuh_informes_favoritos";

export function leerFavoritos(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAVE_FAV) ?? "[]") as string[]; } catch { return []; }
}
export function guardarFavoritos(ids: string[]): void {
  try { localStorage.setItem(CLAVE_FAV, JSON.stringify(ids)); } catch { /* sin persistencia */ }
}
