// Contexto de sesión (F1 entrega 1.2, migraciones 0111/0113).
//
// Tras el login, el SERVIDOR registra qué empresa (y local) usa ESTA sesión
// (`establecer_contexto_sesion`, validado contra la membresía; el navegador solo
// elige de su lista, nunca aporta autoridad). Dos sesiones de la misma cuenta
// pueden trabajar en empresas distintas a la vez.
//
// Transición: si las RPC aún no están desplegadas (puerta 4 pendiente), todo
// degrada al comportamiento actual de tenant único sin romper el login.
import type { GluuhSupabaseClient } from "@gluuh/supabase";

export interface Membresia { tenant_id: string; tenant_nombre: string; app_user_id: string; rol: string }

const CLAVE_ULTIMO = "gluuh:tenant";

/** Membresías de la cuenta autenticada. `null` = RPC no desplegada (transición). */
export async function misMembresias(sb: GluuhSupabaseClient): Promise<Membresia[] | null> {
  const { data, error } = await sb.rpc("mis_membresias");
  if (error) return null;
  return (data ?? []) as Membresia[];
}

/** Fija el contexto en servidor. Falso solo si el servidor lo rechaza (membresía inválida). */
export async function elegirEmpresa(sb: GluuhSupabaseClient, tenantId: string): Promise<boolean> {
  const { error } = await sb.rpc("establecer_contexto_sesion", { p_tenant: tenantId });
  if (error) {
    // RPC inexistente (42883/404) = transición, no un rechazo de autorización.
    if (/does not exist|not find|404/i.test(error.message)) return true;
    return false;
  }
  try { localStorage.setItem(CLAVE_ULTIMO, tenantId); } catch { /* sin almacenamiento */ }
  return true;
}

/** Último tenant elegido en este navegador (solo para preseleccionar en la UI). */
export function ultimoTenant(): string | null {
  try { return localStorage.getItem(CLAVE_ULTIMO); } catch { return null; }
}

/**
 * Resuelve el contexto tras el login: con una sola membresía la fija y sigue;
 * con varias pide elegir. Devuelve la ruta a la que navegar, o null para seguir
 * el destino normal.
 */
export async function resolverContextoTrasLogin(sb: GluuhSupabaseClient): Promise<string | null> {
  const membresias = await misMembresias(sb);
  if (!membresias || membresias.length === 0) return null; // transición o identidad incompleta: lo decide el panel
  if (membresias.length === 1) {
    await elegirEmpresa(sb, membresias[0]!.tenant_id);
    return null;
  }
  return "/elegir-empresa";
}
