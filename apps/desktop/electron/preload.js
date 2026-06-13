// Puente seguro entre la web (renderer) y el hardware (main), con aislamiento de
// contexto. La web llama, por ejemplo: await window.servio.imprimirTicket(texto)
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("servio", {
  /** Imprime un ticket en la impresora local y abre el cajón (ESC/POS). */
  imprimirTicket: (contenido) => ipcRenderer.invoke("servio:imprimir-ticket", contenido),
});
