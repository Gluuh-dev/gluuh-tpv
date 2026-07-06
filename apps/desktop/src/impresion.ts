// Cola de impresión local con persistencia a disco y reintentos.
// Un ticket encolado NUNCA se pierde: si la impresora está apagada se
// reintenta cada 15 s y se notifica a la web (toast).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EscPosPrinter, type ConfigImpresora, type PrintJob } from "@gluuh/hardware";

const REINTENTO_MS = 15_000;

export interface EventoImpresion {
  tipo: "impresion";
  datos: { estado: "IMPRESO" | "ERROR" | "ENCOLADO"; pendientes: number; error?: string };
}

export class ColaImpresion {
  private cola: PrintJob[] = [];
  private procesando = false;

  constructor(
    private readonly userData: string,
    private readonly obtenerConfig: () => ConfigImpresora | undefined,
    private readonly notificar: (evento: EventoImpresion) => void,
  ) {
    try {
      this.cola = JSON.parse(readFileSync(this.ruta(), "utf8")) as PrintJob[];
    } catch {
      this.cola = [];
    }
    setInterval(() => void this.procesar(), REINTENTO_MS);
    if (this.cola.length) void this.procesar();
  }

  private ruta(): string {
    return path.join(this.userData, "cola-impresion.json");
  }

  private persistir(): void {
    writeFileSync(this.ruta(), JSON.stringify(this.cola), "utf8");
  }

  encolar(job: PrintJob): { ok: boolean; pendientes: number } {
    this.cola.push(job);
    this.persistir();
    this.notificar({ tipo: "impresion", datos: { estado: "ENCOLADO", pendientes: this.cola.length } });
    void this.procesar();
    return { ok: true, pendientes: this.cola.length };
  }

  // Apertura de cajón INMEDIATA (best-effort, sin cola ni reintento): abrir el
  // cajón horas después —cuando reviva la cola— con la caja desatendida es peor
  // que no abrirlo. Si la impresora está apagada, simplemente no se abre ahora.
  async abrirCajonInmediato(): Promise<{ ok: boolean; error?: string }> {
    const config = this.obtenerConfig();
    if (!config?.uri) return { ok: false, error: "Impresora sin configurar" };
    try {
      await new EscPosPrinter(config).imprimir({ lineas: [], cortar: false, abrirCajon: true });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async procesar(): Promise<void> {
    if (this.procesando) return;
    this.procesando = true;
    try {
      while (this.cola.length) {
        const job = this.cola[0]!;
        // Cada trabajo va a SU impresora (barra, cocina…) por IP; si no trae
        // una, a la impresora por defecto del terminal.
        const config = job.impresora ?? this.obtenerConfig();
        if (!config?.uri) {
          this.notificar({
            tipo: "impresion",
            datos: { estado: "ERROR", pendientes: this.cola.length, error: "Impresora sin configurar" },
          });
          return; // el timer reintentará cuando haya config
        }
        try {
          await new EscPosPrinter(config).imprimir(job);
          this.cola.shift();
          this.persistir();
          this.notificar({ tipo: "impresion", datos: { estado: "IMPRESO", pendientes: this.cola.length } });
        } catch (e) {
          this.notificar({
            tipo: "impresion",
            datos: { estado: "ERROR", pendientes: this.cola.length, error: e instanceof Error ? e.message : String(e) },
          });
          return; // no descartamos el trabajo: reintento en 15 s
        }
      }
    } finally {
      this.procesando = false;
    }
  }
}
