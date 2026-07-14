/**
 * Resuelve la URL de una imagen según dónde estemos: nube o NODO LOCAL.
 *
 * LA MINA QUE DESACTIVA (estaba avisada en branding.ts):
 * en la base de datos, `product.foto_url` / `tenant_branding.logo_url` guardan una
 * **URL ABSOLUTA de la nube**:
 *
 *     https://<proyecto>.supabase.co/storage/v1/object/public/media/<ruta>
 *
 * Un TPV del nodo, sin internet, NO puede resolver eso: la carta saldría sin fotos.
 *
 * Aquí se reescribe al vuelo hacia el nodo, que sirve las mismas rutas en su LAN:
 *
 *     http://<nodo>:54321/storage/v1/object/public/media/<ruta>
 *
 * Se reescribe SOLO al pintar. En la BD se sigue guardando la URL de la nube —
 * que es la canónica: así el cliente ve las fotos desde su casa, y el dato que se
 * sincroniza no lleva dentro una dirección de la red local del bar (que fuera de
 * ese bar no significa nada).
 *
 * En la nube es la identidad: devuelve lo que le des.
 */

import { config } from "./config";

/** Todo lo que Supabase Storage sirve cuelga de aquí; es lo que buscamos para cortar. */
const MARCA = "/storage/v1/object/public/";

export function urlFoto(url: string | null | undefined): string {
  if (!url) return "";

  const cfg = config();
  if (!cfg.nodo) return url;

  const corte = url.indexOf(MARCA);
  if (corte === -1) return url; // no es de Storage (un data: o una URL suelta): tal cual

  return `${cfg.url}${url.slice(corte)}`;
}
