"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase para el NAVEGADOR (clave publishable, segura para el cliente).
// La RLS protege los datos: cada usuario solo ve los de su empresa.
let _client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!_client) {
    // `experimental.passkey` habilita passkeys (WebAuthn). Es opción experimental
    // y puede no estar tipada todavía → cast controlado.
    const opts = { auth: { experimental: { passkey: true } } } as never;
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      opts,
    );
  }
  return _client;
}
