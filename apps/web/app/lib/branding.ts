import type { SupabaseClient } from "@supabase/supabase-js";

export interface Branding {
  nombre_comercial: string | null;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  kiosko_titulo: string | null;
  kiosko_subtitulo: string | null;
}

export const BRANDING_DEFAULT: Branding = {
  nombre_comercial: null,
  logo_url: null,
  color_primario: "#e11d48",
  color_secundario: "#0f172a",
  kiosko_titulo: null,
  kiosko_subtitulo: null,
};

/** Lee la marca de la empresa de la sesión (RLS); cae a valores por defecto. */
export async function leerBranding(sb: SupabaseClient): Promise<Branding> {
  const { data } = await sb
    .from("tenant_branding")
    .select("nombre_comercial,logo_url,color_primario,color_secundario,kiosko_titulo,kiosko_subtitulo")
    .limit(1)
    .maybeSingle();
  return { ...BRANDING_DEFAULT, ...(data ?? {}) };
}

/** Sube un archivo al bucket "media" en la carpeta del tenant y devuelve la URL pública. */
export async function subirMedia(
  sb: SupabaseClient,
  tenantId: string,
  file: File,
  carpeta: string
): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${tenantId}/${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, { upsert: true });
  if (error) throw error;
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Aclara/oscurece no; solo decide color de texto legible sobre un fondo hex. */
export function textoSobre(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#0f172a" : "#ffffff";
}
