import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Passkeys (WebAuthn) sobre Supabase Auth (beta). La API experimental aún no está
 * tipada en el SDK, por eso accedemos con cast controlado y aislado aquí.
 */

/** ¿El navegador/dispositivo soporta passkeys? */
export function passkeysSoportadas(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

/** Registra una passkey para el usuario con sesión iniciada. */
export async function registrarPasskey(sb: SupabaseClient) {
  return await (sb.auth as unknown as { registerPasskey: () => Promise<{ data: unknown; error: { message: string } | null }> }).registerPasskey();
}

/** Inicia sesión con una passkey (huella / Face ID / Windows Hello). */
export async function entrarConPasskey(sb: SupabaseClient) {
  return await (sb.auth as unknown as { signInWithPasskey: () => Promise<{ data: unknown; error: { message: string } | null }> }).signInWithPasskey();
}
