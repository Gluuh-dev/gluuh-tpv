import { escribir, haySesion, tenantId, sesionDispositivo } from "./nodo";

// ============================================================================
// TRAZABILIDAD — «por si pasa algo».
//
// Registra en el nodo (tabla `evento_auditoria`, migración 0136) cada crear /
// modificar / eliminar / duplicar del catálogo. Dos reglas de oro:
//
//  1. BEST-EFFORT: si el registro falla (sin sesión, red caída, tabla aún sin
//     migrar), NO lanza. La auditoría jamás puede tumbar la operación que la
//     genera —guardar un artículo no puede fallar porque el log falle—.
//  2. Sin terminal emparejado no hay dónde guardar (ni operación real): se
//     ignora en silencio, como el resto del contrato con el nodo.
// ============================================================================

export type AccionAudit = "crear" | "modificar" | "eliminar" | "duplicar";

export interface Evento {
  /** Tabla lógica: 'product', 'family', 'category'… */
  entidad: string;
  accion: AccionAudit;
  /** Id/uuid o código de la fila afectada. */
  entidadId: string;
  /** Legible de un vistazo: «Alhambra 1925». */
  resumen: string;
  /** Snapshot opcional: el DESPUÉS al crear/modificar; el ANTES al eliminar. */
  datos?: unknown;
}

export async function registrarEvento(e: Evento): Promise<void> {
  if (!haySesion()) return;
  const t = tenantId();
  if (!t) return;
  try {
    const s = sesionDispositivo();
    await escribir("evento_auditoria", "POST", [{
      tenant_id: t,
      entidad: e.entidad,
      entidad_id: e.entidadId,
      accion: e.accion,
      resumen: e.resumen,
      datos: e.datos ?? null,
      actor_device: s.device_id ?? null,
      actor_operario: s.device_nombre ?? null,
      created_at: new Date().toISOString(),
    }]);
  } catch (err) {
    // Se queda en consola: la operación ya se hizo, esto es solo el registro.
    console.warn("[trazabilidad] no se pudo registrar el evento:", err);
  }
}
