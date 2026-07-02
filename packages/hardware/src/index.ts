/**
 * @gluuh/hardware — Abstracción de impresora / cajón / datáfono (ESC/POS).
 *
 * Define la interfaz común (`PrintJob`/`Printer`) y el primer backend real:
 * `EscPosPrinter` (red tcp://, usado por la app de escritorio). Ver
 * docs/implementacion/03-app-escritorio-electron.md.
 */

/** Trabajo de impresión genérico (independiente del transporte físico). */
export interface PrintJob {
  /** Líneas de texto ya formateadas o comandos de alto nivel. */
  lineas: string[];
  /** Cortar papel al final. */
  cortar?: boolean;
  /** Abrir el cajón portamonedas (pulso ESC/POS `ESC p`). */
  abrirCajon?: boolean;
  /** Contenido para imprimir como QR (p. ej. URL de cotejo VERIFACTU). */
  qr?: string;
}

/** Contrato que implementa cada backend de impresión. */
export interface Printer {
  imprimir(job: PrintJob): Promise<void>;
}

export { EscPosPrinter, type ConfigImpresora } from "./escpos.js";

export const HARDWARE_PACKAGE = "@gluuh/hardware";
