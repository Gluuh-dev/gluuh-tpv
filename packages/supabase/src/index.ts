/**
 * @gluuh/supabase — Cliente de Supabase compartido por las apps cliente
 * (web, escritorio, móvil). Supabase es la base de datos (PostgreSQL gestionado)
 * + Auth + Realtime + Storage. Ver docs/05 §7 y docs/06.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface GluuhSupabaseConfig {
  url: string;
  /** Clave pública (anon) para clientes. NUNCA usar la service_role en el cliente. */
  anonKey: string;
}

/** Crea un cliente de Supabase para las apps cliente. */
export function createGluuhClient(config: GluuhSupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export type { SupabaseClient };
