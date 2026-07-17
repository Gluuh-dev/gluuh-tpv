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

// Config local del terminal (config.json). Espejo de ConfigTerminal del desktop.
interface GluuhConfigTerminal {
  /** URL/IP del equipo donde corre la web (p. ej. "http://192.168.1.10:3100"). */
  servidor?: string;
  impresora?: { uri: string; tipo?: "EPSON" | "STAR"; ancho?: number };
  backup?: { hora?: string; destino?: string };
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
  /** F4.3: canjea la credencial del TERMINAL por una sesión de datos del bar
   *  (sub = device, sin app_user: lo sensible queda denegado hasta el PIN).
   *  `null` si el equipo no está emparejado o el nodo la rechaza. */
  sesionTerminal(): Promise<{ access_token: string; refresh_token: string } | null>;
  /** Lee la config local del terminal (config.json). */
  leerConfigTerminal(): Promise<GluuhConfigTerminal>;
  /** Guarda la config local del terminal; si cambia `servidor`, recarga la app. */
  guardarConfigTerminal(cfg: GluuhConfigTerminal): Promise<{ ok: boolean; error?: string }>;
  onEvento(cb: (evento: GluuhEvento) => void): () => void;
}

interface Window {
  gluuh?: GluuhDesktop;
}
