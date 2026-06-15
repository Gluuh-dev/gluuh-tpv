"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase para el NAVEGADOR (clave publishable, segura para el cliente).
// La RLS protege los datos: cada usuario solo ve los de su empresa.
let _client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return _client;
}
