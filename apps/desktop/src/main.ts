// Gluuh TPV — proceso principal de Electron.
// Carga la web operativa (/tpv) a pantalla completa y aporta lo que el
// navegador no puede: impresión ESC/POS con cola, cajón, visor de cliente,
// auto-update, identidad de terminal y copia de seguridad a USB.
// Guía: docs/implementacion/03-app-escritorio-electron.md
import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import path from "node:path";
import type { PrintJob } from "@gluuh/hardware";
import { crearPlanificadorDiario, guardarBackupEnDisco, type FicheroBackup } from "./backup";
import { leerConfig } from "./config";
import { guardarIdentidad, leerIdentidad, type Identidad } from "./identidad";
import { ColaImpresion } from "./impresion";
import { crearVisorSiHaySegundaPantalla, publicarEnVisor } from "./visor";

// URL de la web (en dev, el servidor Next local; en prod, el despliegue).
const URL_BASE = (process.env.GLUUH_URL ?? "http://localhost:3100").replace(/\/tpv\/?$/, "");
const ORIGEN = new URL(URL_BASE).origin;

let ventana: BrowserWindow | null = null;
let identidad: Identidad | null = null;
let cola: ColaImpresion;

// Una sola instancia: un TPV por PC.
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); }
});

function notificarWeb(evento: { tipo: string; datos?: unknown }): void {
  if (ventana && !ventana.isDestroyed()) ventana.webContents.send("gluuh:evento", evento);
}

function crearVentana(): void {
  ventana = new BrowserWindow({
    fullscreen: app.isPackaged, // en dev, ventana normal para poder trabajar
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    title: "Gluuh TPV",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ventana.loadURL(`${URL_BASE}/tpv`);

  // Modo TPV: navegación solo dentro de nuestra web; lo externo, al navegador.
  ventana.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== ORIGEN) e.preventDefault();
  });
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== ORIGEN) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Resiliencia: si el renderer muere, se recarga solo.
  ventana.webContents.on("render-process-gone", () => ventana?.reload());
  ventana.on("unresponsive", () => ventana?.reload());
  ventana.on("closed", () => { ventana = null; });
  // ponytail: cierre protegido por PIN pendiente — llega con el diálogo web (guía 03 pieza 3).
}

function inicializarUpdater(): void {
  if (!app.isPackaged) return;
  // Carga diferida: electron-updater no hace falta en dev.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // nunca reiniciar en mitad del servicio
  const comprobar = () => autoUpdater.checkForUpdates().catch(() => undefined);
  void comprobar();
  setInterval(() => void comprobar(), 6 * 60 * 60 * 1000);
  autoUpdater.on("update-downloaded", (info) =>
    notificarWeb({ tipo: "update", datos: { version: info.version } }),
  );
}

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  identidad = leerIdentidad(userData);
  cola = new ColaImpresion(userData, () => leerConfig(userData).impresora, notificarWeb);

  // ── IPC ──────────────────────────────────────────────────────────────────
  ipcMain.on("gluuh:info", (e) => {
    e.returnValue = {
      version: app.getVersion(),
      device: identidad ? { id: identidad.device_id, nombre: identidad.nombre } : null,
    };
  });
  ipcMain.handle("gluuh:imprimir", (_e, job: PrintJob) => cola.encolar(job));
  ipcMain.handle("gluuh:abrir-cajon", () =>
    cola.encolar({ lineas: [], cortar: false, abrirCajon: true }),
  );
  ipcMain.handle("gluuh:guardar-dispositivo", (_e, d: Identidad) => {
    guardarIdentidad(userData, d);
    identidad = d;
    return { ok: true };
  });
  ipcMain.on("gluuh:visor", (_e, datos: unknown) => publicarEnVisor(datos));
  ipcMain.handle("gluuh:guardar-backup", (_e, nombreCarpeta: string, ficheros: FicheroBackup[]) => {
    const destino = leerConfig(userData).backup?.destino ?? "";
    return guardarBackupEnDisco(destino, nombreCarpeta, ficheros);
  });

  // ── Ventanas ────────────────────────────────────────────────────────────
  crearVentana();
  crearVisorSiHaySegundaPantalla(URL_BASE);
  screen.on("display-added", () => crearVisorSiHaySegundaPantalla(URL_BASE));

  // ── Arranque con Windows + updater + backup diario ──────────────────────
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  inicializarUpdater();
  crearPlanificadorDiario(
    () => (leerConfig(userData).backup?.destino ? leerConfig(userData).backup?.hora ?? "03:30" : undefined),
    () => notificarWeb({ tipo: "backup" }),
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
