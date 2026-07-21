import { leer, haySesion, sesionDispositivo } from "../../lib/nodo";
import { eur } from "../../lib/dinero";

// ============================================================================
// DATOS REALES DEL INICIO — nombre del local, terminal y KPIs del turno.
//
// Sin terminal emparejado devuelve null y el Inicio se queda con los datos de
// ejemplo (BAR LA ALAMEDA). Con sesión, sale del nodo: es lo primero que valida
// que el emparejado funciona de verdad.
// ============================================================================

export interface DatosInicio {
  local: { nombre: string; terminal: string };
  turno: { mesasAbiertas: number; mesasTotal: number; ventas: string; comandas: number };
}

const n = (v: number | string | null | undefined): number => {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
};

/** El device de este terminal, sacado de la sesión (localStorage o dev). */
function nombreTerminal(): string {
  return sesionDispositivo().device_nombre ?? "Terminal";
}

/** Los datos del Inicio, o `null` si el terminal no está emparejado. */
export async function cargarInicio(): Promise<DatosInicio | null> {
  if (!haySesion()) return null;

  // El día del bar arranca a las 06:00 (no a medianoche): un cobro de las 02:00
  // es del turno de anoche. Sin esto, la caja de la madrugada saldría en el día
  // equivocado — es la misma frontera que usa la jornada del nodo.
  const desde = new Date();
  desde.setHours(desde.getHours() - 6);
  const hoy = desde.toISOString().slice(0, 10);

  const [loc, ventas, abiertas, mesas, comandas] = await Promise.all([
    leer<{ razon_social: string | null; nombre: string | null }>("location?select=razon_social,nombre&limit=1"),
    leer<{ total: number | string }>(`sales_order?select=total&created_at=gte.${hoy}T06:00:00`),
    leer<{ id: string }>("sales_order?select=id&estado=eq.POR_COBRAR"),
    leer<{ id: string }>("restaurant_table?select=id"),
    leer<{ id: string }>("sales_order?select=id&estado_preparacion=in.(PENDIENTE,ENVIADA_COCINA)&estado=eq.POR_COBRAR"),
  ]);
  if (!loc) return null;

  const nombreLocal = loc[0]?.razon_social || loc[0]?.nombre || "Mi local";
  const sumaVentas = (ventas ?? []).reduce((s, o) => s + n(o.total), 0);

  return {
    local: { nombre: nombreLocal, terminal: nombreTerminal() },
    turno: {
      mesasAbiertas: (abiertas ?? []).length,
      mesasTotal: (mesas ?? []).length,
      ventas: eur(sumaVentas),
      comandas: (comandas ?? []).length,
    },
  };
}
