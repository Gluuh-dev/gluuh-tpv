/**
 * @gluuh/hardware — Abstracción de impresora / cajón / datáfono (ESC/POS).
 *
 * Placeholder del esqueleto. Define la interfaz común que implementan los
 * distintos backends de hardware (Rust en Tauri, SDK nativo en móvil, ePOS/
 * CloudPRNT en web). Ver docs/10-comanderas-kds-e-impresion.md.
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

export const HARDWARE_PACKAGE = "@gluuh/hardware";
