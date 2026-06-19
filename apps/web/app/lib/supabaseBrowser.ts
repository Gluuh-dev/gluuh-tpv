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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // En el prerender de `next build` las NEXT_PUBLIC_ pueden no estar definidas
    // y `createClient` lanzaría "supabaseUrl is required", rompiendo la build.
    // Al prerenderizar no se hace ninguna petición real (los fetch van en
    // efectos del cliente), así que usamos un destino inerte para no romper.
    // Si faltan en el NAVEGADOR es un error de configuración real: lo avisamos.
    if ((!url || !key) && typeof window !== "undefined") {
      console.error(
        "Supabase mal configurado: faltan NEXT_PUBLIC_SUPABASE_URL o " +
          "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el build.",
      );
    }

    _client = createClient(
      url || "https://placeholder.invalid",
      key || "placeholder",
      opts,
    );
  }
  return _client;
}
