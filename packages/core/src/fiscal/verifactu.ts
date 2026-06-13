/**
 * Motor VERIFACTU — generación de la huella (hash) encadenada y del código QR
 * de cotejo de la AEAT.
 *
 * Implementa el algoritmo documentado por la Agencia Tributaria:
 *  - Cadena de campos `clave=valor` unidos por '&' en ORDEN EXACTO.
 *  - SHA-256 en UTF-8, salida hexadecimal de 64 caracteres en MAYÚSCULAS.
 *  - Encadenamiento: cada registro incluye la huella del anterior.
 *  - QR = URL HTTPS al servicio "ValidarQR" con nif, numserie, fecha, importe.
 *
 * ⚠️ Antes de producción, reconfirmar los XSD y el formato vigentes en el portal
 * de desarrolladores de la AEAT. Ver docs/07-facturacion-y-cumplimiento-legal.md §3.
 */

import { createHash } from "node:crypto";

export type EntornoAEAT = "produccion" | "pruebas";

/** URLs oficiales del servicio de cotejo del QR. */
export const URL_COTEJO_AEAT: Record<EntornoAEAT, string> = {
  produccion: "https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR",
  pruebas: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
};

/**
 * Datos mínimos para calcular la huella de un "registro de facturación de alta".
 * Los importes y la fecha deben venir ya formateados según la especificación:
 *  - importes: punto decimal (p. ej. "12.35").
 *  - fechaExpedicionFactura: "dd-mm-aaaa".
 *  - fechaHoraHusoGenRegistro: ISO 8601 con huso (p. ej. "2024-01-01T19:20:30+01:00").
 */
export interface RegistroAltaInput {
  idEmisorFactura: string; // NIF del emisor
  numSerieFactura: string; // serie + número
  fechaExpedicionFactura: string; // dd-mm-aaaa
  tipoFactura: string; // F1, F2, R1...
  cuotaTotal: string;
  importeTotal: string;
  /** Huella del registro inmediatamente anterior. Vacío "" si es el primero. */
  huellaRegistroAnterior: string;
  fechaHoraHusoGenRegistro: string; // ISO 8601 con offset
}

/**
 * Construye la cadena de entrada de la huella en el ORDEN EXACTO exigido por la AEAT.
 * El orden y los nombres de campo NO se pueden alterar.
 */
export function construirCadenaHuella(i: RegistroAltaInput): string {
  return [
    `IDEmisorFactura=${i.idEmisorFactura}`,
    `NumSerieFactura=${i.numSerieFactura}`,
    `FechaExpedicionFactura=${i.fechaExpedicionFactura}`,
    `TipoFactura=${i.tipoFactura}`,
    `CuotaTotal=${i.cuotaTotal}`,
    `ImporteTotal=${i.importeTotal}`,
    `Huella=${i.huellaRegistroAnterior}`,
    `FechaHoraHusoGenRegistro=${i.fechaHoraHusoGenRegistro}`,
  ].join("&");
}

/** Calcula la huella SHA-256 (hex, 64 caracteres, mayúsculas) de un registro de alta. */
export function calcularHuella(i: RegistroAltaInput): string {
  return createHash("sha256")
    .update(construirCadenaHuella(i), "utf8")
    .digest("hex")
    .toUpperCase();
}

export interface RegistroEncadenado extends RegistroAltaInput {
  huella: string;
}

/**
 * Encadena una secuencia de registros: la huella de cada uno se calcula
 * incluyendo la del anterior. `huellaInicial` es "" si no hay cadena previa, o
 * la última huella conocida del dispositivo/serie (importante para offline).
 */
export function encadenarRegistros(
  registros: Omit<RegistroAltaInput, "huellaRegistroAnterior">[],
  huellaInicial = "",
): RegistroEncadenado[] {
  let anterior = huellaInicial;
  const salida: RegistroEncadenado[] = [];
  for (const r of registros) {
    const completo: RegistroAltaInput = { ...r, huellaRegistroAnterior: anterior };
    const huella = calcularHuella(completo);
    salida.push({ ...completo, huella });
    anterior = huella;
  }
  return salida;
}

export interface QRInput {
  nif: string;
  numSerieFactura: string;
  fechaExpedicion: string; // dd-mm-aaaa
  importeTotal: string;
  entorno?: EntornoAEAT;
}

/**
 * Construye la URL del servicio de cotejo que se codifica en el QR de la factura.
 *
 * La AEAT documenta los parámetros sin codificar el separador '/' del número de
 * serie, por lo que se interpolan directamente para reproducir el formato oficial.
 * Confirmar las reglas de codificación con la especificación vigente del QR antes
 * de producción.
 */
export function construirUrlQR(i: QRInput): string {
  const base = URL_COTEJO_AEAT[i.entorno ?? "produccion"];
  const query =
    `nif=${i.nif}` +
    `&numserie=${i.numSerieFactura}` +
    `&fecha=${i.fechaExpedicion}` +
    `&importe=${i.importeTotal}`;
  return `${base}?${query}`;
}

/** Leyenda obligatoria junto al QR en modalidad VERIFACTU. */
export const LEYENDA_VERIFACTU = "VERI*FACTU";
