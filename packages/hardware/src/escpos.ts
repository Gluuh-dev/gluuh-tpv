/**
 * Driver ESC/POS real sobre node-thermal-printer.
 *
 * Transporte soportado: red (`tcp://192.168.1.50:9100`), el estándar de las
 * térmicas de hostelería (Epson TM-T20/T88, Star TSP…).
 * ponytail: USB/serie pendiente; si hace falta, la impresora USB se comparte
 * en Windows como impresora de red o se añade `serialport` en una iteración.
 */
import { CharacterSet, PrinterTypes, ThermalPrinter } from "node-thermal-printer";
import type { Printer, PrintJob } from "./index.js";

export interface ConfigImpresora {
  /** URI del transporte, p. ej. `tcp://192.168.1.50:9100`. */
  uri: string;
  /** Familia de comandos. La mayoría de térmicas chinas emulan EPSON. */
  tipo?: "EPSON" | "STAR";
  /** Caracteres por línea (42 en 80 mm, 32 en 58 mm). */
  ancho?: number;
}

export class EscPosPrinter implements Printer {
  constructor(private readonly config: ConfigImpresora) {}

  async imprimir(job: PrintJob): Promise<void> {
    const impresora = new ThermalPrinter({
      type: this.config.tipo === "STAR" ? PrinterTypes.STAR : PrinterTypes.EPSON,
      interface: this.config.uri,
      width: this.config.ancho ?? 42,
      characterSet: CharacterSet.PC858_EURO,
      removeSpecialCharacters: false,
      options: { timeout: 5000 },
    });

    const conectada = await impresora.isPrinterConnected();
    if (!conectada) throw new Error(`Impresora no accesible en ${this.config.uri}`);

    for (const linea of job.lineas) impresora.println(linea);
    if (job.qr) {
      impresora.alignCenter();
      impresora.printQR(job.qr, { cellSize: 6, correction: "M", model: 2 });
      impresora.alignLeft();
    }
    if (job.cortar !== false) {
      impresora.newLine();
      impresora.cut();
    }
    if (job.abrirCajon) impresora.openCashDrawer();

    await impresora.execute();
  }
}
