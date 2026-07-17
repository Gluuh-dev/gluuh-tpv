import type { GluuhSupabaseClient } from "@gluuh/supabase";
import { config } from "./config";

export interface Branding {
  nombre_comercial: string | null;
  logo_url: string | null;
  /** Logo para la cabecera del ticket térmico (b/n, simple). Cae a logo_url si falta. */
  logo_ticket_url: string | null;
  color_primario: string;
  color_secundario: string;
  kiosko_titulo: string | null;
  kiosko_subtitulo: string | null;
  mesa_color: string;
  silla_color: string;
}

export const BRANDING_DEFAULT: Branding = {
  nombre_comercial: null,
  logo_url: null,
  logo_ticket_url: null,
  color_primario: "#572370",
  color_secundario: "#541F6E",
  kiosko_titulo: null,
  kiosko_subtitulo: null,
  mesa_color: "#e8e4de",
  silla_color: "#707378",
};

/** Lee la marca de la empresa de la sesión (RLS); cae a valores por defecto. */
export async function leerBranding(sb: GluuhSupabaseClient): Promise<Branding> {
  const { data } = await sb
    .from("tenant_branding")
    .select("nombre_comercial,logo_url,logo_ticket_url,color_primario,color_secundario,kiosko_titulo,kiosko_subtitulo,mesa_color,silla_color")
    .limit(1)
    .maybeSingle();
  return { ...BRANDING_DEFAULT, ...(data ?? {}) };
}

// Reduce una imagen en el navegador ANTES de subirla (máx 1024 px de lado,
// webp q0.82). Los tiles del TPV/kiosko pintan miniaturas de ~80-120 px: subir
// la foto de cámara original (1-3 MB) solo aporta descargas y jank. SVG/GIF y
// no-imágenes pasan tal cual; si algo falla, se sube el original (best-effort).
async function reducirImagen(file: File, maxLado = 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    if (escala >= 1 && file.size < 300_000) return file;   // ya pequeña: no tocar
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;      // webp no ayudó: original
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch { return file; }
}

/** Sube un archivo al bucket "media" en la carpeta del tenant y devuelve la URL pública.
 *  Las imágenes se reducen antes de subir (miniaturas para tiles; plan 014).
 *
 *  ★ COSTURA DEL NODO LOCAL ★ — Este es el ÚNICO sitio de la app que toca Storage
 *  (verificado: 2 llamadas, las dos aquí). Cuando llegue el nodo, la rama va AQUÍ:
 *  en la nube → Supabase Storage; en el nodo → POST al endpoint de fotos del nodo,
 *  que la guarda en su carpeta y la sirve por la LAN. No hace falta una capa nueva.
 *
 *  ⚠️ LA MINA, YA DESACTIVADA (13-07-2026): en la BD se guarda una **URL ABSOLUTA de la
 *  nube** (`product.foto_url`, `tenant_branding.logo_url`…), que un TPV del nodo sin
 *  internet NO puede resolver. La resuelve `app/lib/urlFoto.ts`, por el que pasan ya
 *  TODOS los sitios que pintan una imagen de Storage (17, no los ~8 que se estimaron).
 *
 *  Y se sigue guardando la URL de la NUBE aunque la foto se suba al nodo: es la
 *  canónica. Ver el porqué abajo, en subirMedia.
 */
export async function subirMedia(
  sb: GluuhSupabaseClient,
  tenantId: string,
  file: File,
  carpeta: string
): Promise<string> {
  file = await reducirImagen(file);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${tenantId}/${carpeta}/${crypto.randomUUID()}.${ext}`;

  // ── NODO LOCAL: la foto va al disco del nodo, no a la nube ────────────────
  // El dueño cambia una foto un martes que se ha caído la línea, y tiene que verla en
  // el TPV al instante. El nodo la guarda y la deja en cola; cuando vuelva internet,
  // el sincronizador la sube a Supabase (el archivo de verdad).
  //
  // OJO CON LO QUE SE DEVUELVE: aunque la foto esté sólo en la LAN, en la base de datos
  // se guarda la URL **de la nube**. Es la canónica: así el dato que se sincroniza no
  // lleva dentro una dirección de la red del bar (que fuera de ese bar no significa
  // nada), y el dueño ve la foto desde su casa. Al pintar, `urlFoto()` la redirige al
  // nodo. Nunca guardes aquí la URL del nodo.
  const cfg = config();
  if (cfg.nodo) {
    const nodo = cfg.url;
    const r = await fetch(`${nodo}/storage/v1/object/media/${path}`, {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!r.ok) throw new Error(`El nodo no pudo guardar la imagen (HTTP ${r.status})`);

    const nube = cfg.urlNube;
    if (!nube) throw new Error("El nodo no dice cuál es su Supabase: no sé qué URL guardar");
    return `${nube}/storage/v1/object/public/media/${path}`;
  }

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
