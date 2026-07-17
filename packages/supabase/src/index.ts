/**
 * @gluuh/supabase — Cliente de Supabase compartido por las apps cliente
 * (web, escritorio, móvil). Supabase es la base de datos (PostgreSQL gestionado)
 * + Auth + Realtime + Storage. Ver docs/05 §7 y docs/06.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/database.types.js";

export type { Database } from "../../../supabase/types/database.types.js";

type EsquemaPublico = Database["public"];
type RegistroTransitorio = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Contrato de transición para el código existente.
 *
 * Conserva del tipo generado los nombres de tablas, vistas y RPC (incluidos sus
 * argumentos), que es la barrera necesaria para detectar drift. Las filas y los
 * payloads siguen abiertos mientras se migra el CRUD histórico: hoy muchas
 * inserciones omiten `tenant_id` deliberadamente porque lo completa el trigger
 * `set_tenant_id()`.
 *
 * El código nuevo sensible debe usar `GluuhSupabaseClientEstricto`.
 */
export type GluuhContractDatabase = Omit<Database, "public"> & {
  public: Omit<EsquemaPublico, "Tables" | "Views" | "Functions"> & {
    Tables: {
      [K in keyof EsquemaPublico["Tables"]]: {
        Row: RegistroTransitorio;
        Insert: RegistroTransitorio;
        Update: RegistroTransitorio;
        Relationships: EsquemaPublico["Tables"][K]["Relationships"];
      };
    };
    Views: {
      [K in keyof EsquemaPublico["Views"]]: {
        Row: RegistroTransitorio;
        Relationships: EsquemaPublico["Views"][K] extends { Relationships: infer R } ? R : [];
      };
    };
    Functions: {
      [K in keyof EsquemaPublico["Functions"]]: {
        Args: RegistroTransitorio;
        Returns: RegistroTransitorio;
      };
    };
  };
};

export type GluuhSupabaseClient = SupabaseClient<GluuhContractDatabase>;
export type GluuhSupabaseClientEstricto = SupabaseClient<Database>;
export type TablaPublica = keyof GluuhContractDatabase["public"]["Tables"];

export interface GluuhSupabaseConfig {
  url: string;
  /** Clave pública (anon) para clientes. NUNCA usar la service_role en el cliente. */
  anonKey: string;
}

/** Crea un cliente de Supabase para las apps cliente. */
export function createGluuhClient(config: GluuhSupabaseConfig): GluuhSupabaseClient {
  return createClient<GluuhContractDatabase>(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export type { SupabaseClient };
