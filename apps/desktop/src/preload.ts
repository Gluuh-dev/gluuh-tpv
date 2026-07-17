// Puente seguro web↔main (contextIsolation). Único canal de hardware.
// La web detecta `window.gluuh` para usar impresión nativa en vez de window.print().
import { contextBridge, ipcRenderer } from "electron";
import type { PrintJob } from "@gluuh/hardware";

const info = ipcRenderer.sendSync("gluuh:info") as {
  version: string;
  device: { id: string; nombre: string } | null;
};

contextBridge.exposeInMainWorld("gluuh", {
  version: info.version,
  device: info.device,
  imprimir: (job: PrintJob) => ipcRenderer.invoke("gluuh:imprimir", job),
  abrirCajon: () => ipcRenderer.invoke("gluuh:abrir-cajon"),
  guardarDispositivo: (d: unknown) => ipcRenderer.invoke("gluuh:guardar-dispositivo", d),
  publicarTicketVisor: (datos: unknown) => ipcRenderer.send("gluuh:visor", datos),
  guardarBackup: (nombreCarpeta: string, ficheros: unknown) =>
    ipcRenderer.invoke("gluuh:guardar-backup", nombreCarpeta, ficheros),
  // F4.3: el MAIN canjea el token del terminal (que la web nunca ve) por una
  // sesión de datos; la web solo recibe la sesión resultante.
  sesionTerminal: () => ipcRenderer.invoke("gluuh:sesion-terminal"),
  leerConfigTerminal: () => ipcRenderer.invoke("gluuh:leer-config"),
  guardarConfigTerminal: (cfg: unknown) => ipcRenderer.invoke("gluuh:guardar-config", cfg),
  // Primer arranque: la pantalla local manda IP + código efímero del terminal;
  // el main lo canjea contra el nodo y, si va, entra a la operativa.
  conectarTerminal: (datos: unknown) => ipcRenderer.invoke("gluuh:conectar-terminal", datos),
  onEvento: (cb: (evento: { tipo: string; datos?: unknown }) => void) => {
    const listener = (_e: unknown, evento: { tipo: string; datos?: unknown }) => cb(evento);
    ipcRenderer.on("gluuh:evento", listener);
    return () => ipcRenderer.removeListener("gluuh:evento", listener);
  },
});
