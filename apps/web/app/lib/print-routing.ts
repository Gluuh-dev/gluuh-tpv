// Enrutado de comandas a impresoras (guía 15 §6.1, C4). Decide qué impresora
// recibe cada estación según la zona (room) de la mesa, y encola print_job en la
// cola compartida — así una comandera móvil (sin impresora propia) hace que la
// comanda salga en la barra/cocina correcta.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RutaImpresion { estacion: string; room_id: string | null; printer_id: string }
export interface ImpresoraRef { id: string; rol: string; activa: boolean }

// Rol de impresora por defecto para cada estación (fallback si no hay regla).
const ROL_POR_ESTACION: Record<string, string> = { COCINA: "COCINA", BARRA: "BARRA", CAMARERO: "TICKETS" };

/**
 * Impresora para una estación dada la zona de la mesa. Prioridad:
 * 1) regla exacta estación + zona, 2) regla estación + cualquier zona (room null),
 * 3) impresora activa por defecto del rol equivalente. null si nada aplica.
 */
export function elegirImpresora(
  estacion: string,
  roomId: string | null,
  rutas: readonly RutaImpresion[],
  impresoras: readonly ImpresoraRef[],
): string | null {
  const exacta = roomId ? rutas.find((r) => r.estacion === estacion && r.room_id === roomId) : undefined;
  if (exacta) return exacta.printer_id;
  const general = rutas.find((r) => r.estacion === estacion && r.room_id === null);
  if (general) return general.printer_id;
  const rol = ROL_POR_ESTACION[estacion] ?? "TICKETS";
  return impresoras.find((p) => p.activa && p.rol === rol)?.id ?? null;
}

export interface LineaComanda { cantidad: number; nombre: string; nota?: string; pase?: number | null }
export interface GrupoComanda { estacion: string; lineas: LineaComanda[] }

const NOMBRES_PASES: Record<number, string> = {
  1: "1º PRIMEROS",
  2: "2º SEGUNDOS",
  3: "3º TERCEROS",
  4: "POSTRES",
  5: "BEBIDAS",
};

// Texto ESC/POS-friendly de una comanda (sin precios).
function formatearComanda(contexto: string, operario: string | undefined, lineas: LineaComanda[]): string[] {
  const out = [contexto.toUpperCase()];
  if (operario) out.push(operario);
  out.push("--------------------------------");

  const pasesAgrupados: Record<number, LineaComanda[]> = {};
  const sinPase: LineaComanda[] = [];

  for (const l of lineas) {
    const p = l.pase;
    if (typeof p === "number" && p > 0) {
      if (!pasesAgrupados[p]) pasesAgrupados[p] = [];
      pasesAgrupados[p].push(l);
    } else {
      sinPase.push(l);
    }
  }

  if (sinPase.length) {
    for (const l of sinPase) {
      out.push(`${l.cantidad} x ${l.nombre}`);
      if (l.nota) out.push(`   >> ${l.nota}`);
    }
  }

  const sortedPases = Object.keys(pasesAgrupados).map(Number).sort();
  for (const p of sortedPases) {
    const list = pasesAgrupados[p]!;
    if (!list.length) continue;
    const nombrePase = NOMBRES_PASES[p] || `${p}º TIEMPO`;
    out.push("--------------------------------", `=== ${nombrePase} ===`, "--------------------------------");
    for (const l of list) {
      out.push(`${l.cantidad} x ${l.nombre}`);
      if (l.nota) out.push(`   >> ${l.nota}`);
    }
  }

  return out;
}

/**
 * Encola las comandas en la cola compartida (print_job), una por impresora
 * destino. Devuelve cuántos trabajos se encolaron (0 = no había impresoras/rutas
 * → el llamador puede caer al camino local). No lanza: los errores se ignoran por
 * grupo (mejor imprimir lo que se pueda que romper el cobro).
 */
export async function encolarComandas(
  sb: SupabaseClient,
  args: { contexto: string; roomId: string | null; operario?: string; grupos: GrupoComanda[] },
): Promise<number> {
  const grupos = args.grupos.filter((g) => g.lineas.length > 0);
  if (!grupos.length) return 0;
  const [{ data: pr }, { data: ru }] = await Promise.all([
    sb.from("printer").select("id,rol,activa"),
    sb.from("print_route").select("estacion,room_id,printer_id"),
  ]);
  const impresoras = (pr as ImpresoraRef[] | null) ?? [];
  const rutas = (ru as RutaImpresion[] | null) ?? [];
  if (!impresoras.length) return 0;

  // Agrupa por impresora destino (dos estaciones pueden ir a la misma).
  const porImpresora = new Map<string, LineaComanda[]>();
  for (const g of grupos) {
    const printerId = elegirImpresora(g.estacion, args.roomId, rutas, impresoras);
    if (!printerId) continue;
    const acc = porImpresora.get(printerId) ?? [];
    acc.push(...g.lineas);
    porImpresora.set(printerId, acc);
  }
  if (!porImpresora.size) return 0;

  const filas = [...porImpresora.entries()].map(([printer_id, lineas]) => ({
    printer_id,
    payload: { lineas: formatearComanda(args.contexto, args.operario, lineas), cortar: true },
    estado: "ENCOLADO" as const,
  }));
  const { error } = await sb.from("print_job").insert(filas);
  return error ? 0 : filas.length;
}
