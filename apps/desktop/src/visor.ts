// Visor de cliente en el segundo monitor: ventana a pantalla completa con
// /visor. El ticket en curso viaja por IPC (misma máquina, sin red).
import { BrowserWindow, screen } from "electron";
import path from "node:path";

let visor: BrowserWindow | null = null;
// Último ticket publicado: se reenvía al crear el visor (2º monitor enchufado a
// mitad de servicio) o cuando /visor termina de cargar tras el primer publicar,
// para que el cliente no vea "Bienvenido" con una cuenta en curso.
let ultimoTicket: unknown = null;

export function crearVisorSiHaySegundaPantalla(urlBase: string): void {
  const pantallas = screen.getAllDisplays();
  const principal = screen.getPrimaryDisplay();
  const segunda = pantallas.find((d) => d.id !== principal.id);
  if (!segunda || (visor && !visor.isDestroyed())) return;

  visor = new BrowserWindow({
    x: segunda.bounds.x,
    y: segunda.bounds.y,
    fullscreen: true,
    autoHideMenuBar: true,
    title: "Gluuh Visor",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  visor.loadURL(`${urlBase}/visor`);
  visor.webContents.on("did-finish-load", () => {
    if (ultimoTicket !== null) visor?.webContents.send("gluuh:evento", { tipo: "visor", datos: ultimoTicket });
  });
  visor.on("closed", () => { visor = null; });
}

export function publicarEnVisor(datos: unknown): void {
  ultimoTicket = datos;
  if (visor && !visor.isDestroyed()) {
    visor.webContents.send("gluuh:evento", { tipo: "visor", datos });
  }
}
