// Puente con la app de escritorio (Electron). Presente solo dentro de
// Gluuh Desktop; en navegador puro `window.gluuh` es undefined.
// Contrato del preload: apps/desktop/src/preload.ts

interface GluuhPrintJob {
  lineas: string[];
  cortar?: boolean;
  abrirCajon?: boolean;
  qr?: string;
  impresora?: { uri: string; tipo?: "EPSON" | "STAR"; ancho?: number };
}

interface GluuhEvento {
  tipo: "impresion" | "backup" | "update" | "visor";
  datos?: unknown;
}

interface GluuhDesktop {
  version: string;
  device: { id: string; nombre: string } | null;
  imprimir(job: GluuhPrintJob): Promise<{ ok: boolean; pendientes?: number; error?: string }>;
  abrirCajon(): Promise<{ ok: boolean }>;
  guardarDispositivo(d: { device_id: string; nombre: string; modulo: string; token: string }): Promise<{ ok: boolean }>;
  publicarTicketVisor(datos: unknown): void;
  guardarBackup(
    nombreCarpeta: string,
    ficheros: { nombre: string; contenido: string; base64?: boolean }[],
  ): Promise<{ ok: boolean; ruta?: string; error?: string }>;
  onEvento(cb: (evento: GluuhEvento) => void): () => void;
}

interface Window {
  gluuh?: GluuhDesktop;
}
