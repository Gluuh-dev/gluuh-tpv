"use client";
import { createClient } from "@supabase/supabase-js";
import type { GluuhContractDatabase, GluuhSupabaseClient } from "@gluuh/supabase";
import { config } from "./config";

// Cliente de Supabase para el NAVEGADOR (clave publishable, segura para el cliente).
// La RLS protege los datos: cada usuario solo ve los de su empresa.
let _client: GluuhSupabaseClient | null = null;

export function supabaseBrowser(): GluuhSupabaseClient {
  if (!_client) {
    // Persistencia explícita de la sesión (localStorage) + refresco automático,
    // para que el login se mantenga entre recargas. `experimental.passkey`
    // habilita passkeys (WebAuthn); es experimental y puede no estar tipada
    // todavía → cast controlado.
    const opts = {
      auth: { persistSession: true, autoRefreshToken: true, experimental: { passkey: true } },
    } as never;

    // En el NODO esto no viene de las NEXT_PUBLIC_ (que se incrustan al compilar): lo
    // inyecta el propio servidor del bar en el HTML. Así una sola compilación vale para
    // todos los bares, y en las terminales no hay ni una variable que configurar.
    const { url, clave: key } = config();

    // En el prerender de `next build` las NEXT_PUBLIC_ pueden no estar definidas
    // y `createClient` lanzaría "supabaseUrl is required", rompiendo la build.
    // Al prerenderizar no se hace ninguna petición real (los fetch van en
    // efectos del cliente), así que usamos un destino inerte para no romper.
    // Si faltan/quedan en placeholder en el NAVEGADOR es un error de
    // configuración real (servidor arrancado sin .env.local): lo avisamos fuerte.
    if (typeof window !== "undefined" && (!url || !key || url.includes("placeholder"))) {
      console.error(
        "⚠️ Supabase mal configurado: el navegador no tiene NEXT_PUBLIC_SUPABASE_URL/" +
          "PUBLISHABLE_KEY reales. Revisa apps/web/.env.local y REINICIA el servidor dev. " +
          "El login fallará con valores placeholder.",
      );
    }

    _client = createClient<GluuhContractDatabase>(
      url || "https://placeholder.invalid",
      key || "placeholder",
      opts,
    );
  }
  return _client;
}
