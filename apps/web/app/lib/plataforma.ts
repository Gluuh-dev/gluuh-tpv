// Separación de superficies (guía 15): la zona de PLATAFORMA (/admin, /api/admin)
// solo existe en los hosts de plataforma (admin.gluuh.com). En cualquier otro host
// responde 404 aunque se conozca la ruta. Sustituye al middleware (proxy.ts), que
// Next 16 compila como Node middleware y OpenNext/Cloudflare no soporta.
export const HOSTS_PLATAFORMA = (process.env.PLATAFORMA_HOSTS ?? "admin.gluuh.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const host = (h: string | null) => (h ?? "").split(":")[0]?.toLowerCase() ?? "";

/** ¿La petición llega a un host de plataforma? En desarrollo siempre sí. */
export function hostPlataforma(headerHost: string | null): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return HOSTS_PLATAFORMA.includes(host(headerHost));
}

/**
 * MFA OBLIGATORIO para el personal Gluuh (F2 entrega 2.3, plan 14 §6).
 *
 * Con `MFA_GLUUH_OBLIGATORIO=1`, las rutas de plataforma exigen que la sesión
 * haya pasado el segundo factor (claim `aal` = "aal2" del JWT de Supabase; lo
 * firma GoTrue, el cliente no puede fabricarlo). APAGADO por defecto: hay que
 * enrolar el TOTP de las cuentas Gluuh en /seguridad ANTES de encenderlo, o el
 * admin se deja fuera a sí mismo.
 */
export function mfaPlataformaInsuficiente(bearer: string): boolean {
  if (process.env.MFA_GLUUH_OBLIGATORIO !== "1") return false;
  try {
    const cuerpo = JSON.parse(
      Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { aal?: string };
    return cuerpo.aal !== "aal2";
  } catch {
    return true; // token ilegible con el flag encendido = insuficiente
  }
}
