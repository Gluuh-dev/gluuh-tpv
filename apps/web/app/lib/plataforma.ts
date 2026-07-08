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
