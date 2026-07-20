import { leer, escribir, haySesion, tenantId } from "../../../lib/nodo";

// ============================================================================
// IMPRESORAS Y RUTAS — por dónde sale cada comanda.
//
// El artículo NUNCA nombra una impresora, y es a propósito: el día que cambian
// el aparato de cocina habría que repasar 1.200 artículos. Lo que dice el
// artículo es su ESTACIÓN (cocina, barra, camarero) y la ruta traduce
// estación + sala → impresora.
//
//     product.estacion  →  print_route (estación + sala)  →  printer
//
// Así «la barra de la terraza imprime en su propia impresora» se dice UNA vez,
// en la ruta, sin tocar la carta.
//
// ⚠ Hoy `printer` y `print_route` están a CERO filas en el bar de pruebas: por
// eso ninguna comanda ha salido nunca por red. Esta pantalla es lo que faltaba.
// ============================================================================

export const ROLES = [
  { valor: "TICKETS", texto: "Tickets (cobro)" },
  { valor: "COCINA", texto: "Cocina" },
  { valor: "BARRA", texto: "Barra" },
  { valor: "ETIQUETAS", texto: "Etiquetas" },
] as const;

export const TRANSPORTES = [
  { valor: "RED", texto: "Red (IP)" },
  { valor: "USB", texto: "USB" },
] as const;

export const TIPOS = [
  { valor: "EPSON", texto: "Epson (ESC/POS)" },
  { valor: "STAR", texto: "Star" },
] as const;

/** Estaciones que se pueden enrutar. NINGUNA no imprime, así que no sale. */
export const ESTACIONES_RUTA = ["COCINA", "BARRA", "CAMARERO"] as const;

export interface Impresora {
  id: string;
  nombre: string;
  rol: string;
  transporte: string;
  /** `192.168.1.201:9100` en red; nombre o ruta del sistema en USB. */
  destino: string;
  /** Caracteres por línea: 48 en 80 mm, 32 en 58 mm. */
  ancho: number;
  tipo: string;
  activa: boolean;
}

export interface Ruta {
  id: string;
  estacion: string;
  /** null = vale para cualquier sala. */
  roomId: string | null;
  printerId: string;
}

export interface Sala { id: string; nombre: string }

// ── El enrutado (portado 1:1 de `apps/web/app/lib/print-routing.ts`) ────────

const ROL_POR_ESTACION: Record<string, string> = {
  COCINA: "COCINA", BARRA: "BARRA", CAMARERO: "TICKETS",
};

/**
 * Qué impresora recibe una estación, según la sala de la mesa. Por orden:
 *
 *   1. regla exacta   (esta estación, ESTA sala)
 *   2. regla general  (esta estación, cualquier sala)
 *   3. la impresora activa del rol equivalente
 *   4. null → no hay a dónde mandarlo
 *
 * Lo concreto gana a lo general: si hay una impresora para la barra de la
 * terraza, manda esa aunque exista una regla de barra para todo el local.
 *
 * PURA a propósito: es lo que decide dónde sale el papel, y se prueba sin nodo.
 */
export function elegirImpresora(
  estacion: string,
  roomId: string | null,
  rutas: readonly Ruta[],
  impresoras: readonly Impresora[],
): string | null {
  const exacta = roomId ? rutas.find((r) => r.estacion === estacion && r.roomId === roomId) : undefined;
  if (exacta) return exacta.printerId;

  const general = rutas.find((r) => r.estacion === estacion && r.roomId === null);
  if (general) return general.printerId;

  const rol = ROL_POR_ESTACION[estacion] ?? "TICKETS";
  return impresoras.find((p) => p.activa && p.rol === rol)?.id ?? null;
}

/**
 * Explica en una frase por qué acabará saliendo por ahí. La pantalla lo enseña
 * al lado de cada estación: una tabla de rutas sin esto obliga a hacer el
 * razonamiento a mano, y es justo donde uno se equivoca.
 */
export function explicarRuta(
  estacion: string,
  roomId: string | null,
  rutas: readonly Ruta[],
  impresoras: readonly Impresora[],
): { impresora: Impresora | null; motivo: string } {
  const id = elegirImpresora(estacion, roomId, rutas, impresoras);
  const impresora = impresoras.find((p) => p.id === id) ?? null;
  if (!impresora) return { impresora: null, motivo: "No hay ninguna impresora para esto: no saldrá nada." };

  if (roomId && rutas.some((r) => r.estacion === estacion && r.roomId === roomId)) {
    return { impresora, motivo: "Regla para esta sala." };
  }
  if (rutas.some((r) => r.estacion === estacion && r.roomId === null)) {
    return { impresora, motivo: "Regla general de la estación." };
  }
  return { impresora, motivo: `Sin regla: cae en la impresora de ${impresora.rol.toLowerCase()}.` };
}

// ── Carga y guardado ────────────────────────────────────────────────────────

interface FilaImpresora {
  id: string; nombre: string; rol: string; transporte: string;
  destino: string | null; ancho: number | null; tipo: string; activa: boolean;
}
interface FilaRuta { id: string; estacion: string; room_id: string | null; printer_id: string }

export interface DatosImpresion { impresoras: Impresora[]; rutas: Ruta[]; salas: Sala[] }

export async function cargarImpresion(): Promise<DatosImpresion | null> {
  if (!haySesion()) return null;
  const [impresoras, rutas, salas] = await Promise.all([
    leer<FilaImpresora>("printer?select=id,nombre,rol,transporte,destino,ancho,tipo,activa&order=nombre"),
    leer<FilaRuta>("print_route?select=id,estacion,room_id,printer_id"),
    leer<Sala>("room?select=id,nombre&order=orden"),
  ]);
  if (!impresoras || !rutas || !salas) return null;
  return {
    impresoras: impresoras.map((p) => ({
      id: p.id, nombre: p.nombre, rol: p.rol, transporte: p.transporte,
      destino: p.destino ?? "", ancho: p.ancho ?? 48, tipo: p.tipo, activa: p.activa,
    })),
    rutas: rutas.map((r) => ({ id: r.id, estacion: r.estacion, roomId: r.room_id, printerId: r.printer_id })),
    salas,
  };
}

function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

export async function guardarImpresora(p: Impresora): Promise<void> {
  await escribir("printer?on_conflict=id", "POST", [{
    id: p.id, tenant_id: bar(), nombre: p.nombre, rol: p.rol, transporte: p.transporte,
    // Vacío va como NULL: una cadena vacía en `destino` parece configurada y no lo está.
    destino: p.destino.trim() || null, ancho: p.ancho, tipo: p.tipo, activa: p.activa,
    updated_at: new Date().toISOString(),
  }]);
}

export async function borrarImpresora(id: string): Promise<void> {
  // Las rutas que apuntaban aquí se van con ella: dejarlas sería mandar comandas
  // a una impresora que ya no existe, y eso no da error — simplemente no sale nada.
  await escribir(`print_route?printer_id=eq.${id}`, "DELETE");
  await escribir(`printer?id=eq.${id}`, "DELETE");
}

/** Fija (o quita, con `printerId` null) la impresora de una estación en una sala. */
export async function fijarRuta(
  estacion: string, roomId: string | null, printerId: string | null,
): Promise<void> {
  const tenant_id = bar();
  const filtroSala = roomId ? `&room_id=eq.${roomId}` : "&room_id=is.null";
  await escribir(`print_route?estacion=eq.${estacion}${filtroSala}`, "DELETE");
  if (!printerId) return;
  await escribir("print_route", "POST", [{
    tenant_id, estacion, room_id: roomId, printer_id: printerId,
    updated_at: new Date().toISOString(),
  }]);
}
