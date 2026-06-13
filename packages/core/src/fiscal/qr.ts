/**
 * Generación de la IMAGEN del código QR de la factura VERIFACTU.
 *
 * El contenido del QR es la URL de cotejo de la AEAT (ver verifactu.ts). Aquí se
 * renderiza esa URL como imagen, con el nivel de corrección de errores "M" que
 * exige la especificación. Salidas: SVG (ideal para imprimir en el ticket) y
 * data-URL PNG (ideal para mostrar en web/pantalla).
 *
 * Ver docs/07-facturacion-y-cumplimiento-legal.md §3.4.
 */

import QRCode from "qrcode";
import { construirUrlQR, type QRInput } from "./verifactu.js";

export interface QrOpciones {
  /** Margen (módulos en blanco alrededor). La AEAT recomienda zona de silencio. */
  margin?: number;
  /** Ancho en píxeles (PNG). El tamaño impreso recomendado es 30–40 mm. */
  width?: number;
}

/** Renderiza un contenido arbitrario como QR en formato SVG (string). */
export async function generarQrSvg(contenido: string, opts: QrOpciones = {}): Promise<string> {
  return QRCode.toString(contenido, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 2,
    ...(opts.width ? { width: opts.width } : {}),
  });
}

/** Renderiza un contenido arbitrario como QR en data-URL PNG (base64). */
export async function generarQrDataUrl(contenido: string, opts: QrOpciones = {}): Promise<string> {
  return QRCode.toDataURL(contenido, {
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 2,
    width: opts.width ?? 160,
  });
}

/** Atajo: QR (SVG) de una factura VERIFACTU a partir de sus datos. */
export async function generarQrVerifactuSvg(input: QRInput, opts?: QrOpciones): Promise<string> {
  return generarQrSvg(construirUrlQR(input), opts);
}

/** Atajo: QR (data-URL PNG) de una factura VERIFACTU a partir de sus datos. */
export async function generarQrVerifactuDataUrl(input: QRInput, opts?: QrOpciones): Promise<string> {
  return generarQrDataUrl(construirUrlQR(input), opts);
}
