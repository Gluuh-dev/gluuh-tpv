// Gluuh TPV — proceso principal de Electron.
// Carga la aplicación web (Next.js) y expone el hardware local del TPV:
// impresora ESC/POS, cajón portamonedas y datáfono. Ver docs/10 y docs/05.
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

// URL de la web a cargar (en dev, el servidor Next; en prod, el despliegue).
const GLUUH_URL = process.env.GLUUH_URL || "http://localhost:3100/tpv";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Gluuh TPV",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(GLUUH_URL);
}

/**
 * Impresión de ticket (ESQUELETO). En la implementación real, aquí se envían
 * los bytes ESC/POS a la impresora (USB/serie/red) con `node-thermal-printer` o
 * `serialport`, y se abre el cajón con la secuencia `ESC p`. Ver docs/10 §3.
 */
ipcMain.handle("gluuh:imprimir-ticket", async (_event, contenido) => {
  console.log(`[impresion] ${String(contenido ?? "").length} bytes recibidos`);
  // TODO: serializar a ESC/POS, imprimir y disparar el cajón.
  return { ok: true, simulado: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
