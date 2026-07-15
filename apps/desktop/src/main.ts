// Gluuh TPV — proceso principal de Electron.
// Carga la web operativa (/tpv) a pantalla completa y aporta lo que el
// navegador no puede: impresión ESC/POS con cola, cajón, visor de cliente,
// auto-update, identidad de terminal y copia de seguridad a USB.
// Guía: docs/implementacion/03-app-escritorio-electron.md
import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import path from "node:path";
import type { PrintJob } from "@gluuh/hardware";
import { crearPlanificadorDiario, guardarBackupEnDisco, type FicheroBackup } from "./backup";
import { leerConfig, guardarConfig, type ConfigTerminal } from "./config";
import { guardarIdentidad, leerIdentidad, type Identidad } from "./identidad";
import { ColaImpresion } from "./impresion";
import { crearVisorSiHaySegundaPantalla, publicarEnVisor } from "./visor";

// URL/IP de la web. Precedencia: config.json del terminal (editable, se mete al
// instalar y luego en Configuración) > GLUUH_URL (env de empaquetado) > localhost.
// Se resuelve al arrancar (whenReady), cuando ya hay userData.
//
// El puerto es el 54321, el del GATEWAY — lo ÚNICO que ve un TPV. Es quien le inyecta al
// HTML la configuración del nodo (clave anon, URL interna). Apuntar al 3100 (la web cruda,
// interna) cargaría el TPV SIN esa config: pantallas sin datos y sin poder cobrar. En un
// terminal, config.json trae la IP del servidor (http://<ip-del-servidor>:54321).
const normalizaUrl = (u: string) => u.trim().replace(/\/tpv\/?$/, "").replace(/\/+$/, "");
let URL_BASE = normalizaUrl(process.env.GLUUH_URL ?? "http://localhost:54321");
let ORIGEN = new URL(URL_BASE).origin;

// Ruta inicial según el módulo con el que se vinculó el terminal. Duplica el
// RUTA_MODULO de la web (apps/web/app/lib/modulos.ts) porque el proceso main no
// puede importar código de Next; mantener en sincronía si se añaden módulos.
const RUTA_MODULO: Record<string, string> = {
  TPV: "/tpv", COMANDERA: "/comandera", COCINA: "/cocina", PANTALLA: "/pantalla",
  KIOSKO: "/kiosko", CARTELERIA: "/ofertas", VISOR: "/visor",
};

let ventana: BrowserWindow | null = null;
let identidad: Identidad | null = null;
let cola: ColaImpresion;

// Espera/reconexión: el terminal puede encenderse ANTES que el servidor, o el servidor
// reiniciarse en mitad del servicio. Sin esto, Electron enseña una página de error fea. Con
// esto, muestra una pantalla local de "Conectando…" y entra solo cuando el nodo responde.
let esperando = false;
let sondeo: NodeJS.Timeout | null = null;

// La ruta con la que arranca este terminal según el módulo con el que se vinculó.
function rutaDeInicio(): string {
  return identidad && identidad.modulo !== "TPV"
    ? RUTA_MODULO[identidad.modulo] ?? "/inicio"
    : "/inicio";
}

// ¿Responde el nodo? Pregunta al gateway (/nodo/estado, sin autenticación). Timeout corto:
// solo queremos saber si HABLA.
async function servidorVivo(): Promise<boolean> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2500);
    const r = await fetch(`${URL_BASE}/nodo/estado`, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

// Entrar a la operativa (o a la pantalla del módulo). Si el nodo no está, el did-fail-load
// de abajo nos devolverá a la pantalla de espera.
function irAOperativa(): void {
  esperando = false;
  void ventana?.loadURL(`${URL_BASE}${rutaDeInicio()}`);
}

// Primer arranque: pantalla LOCAL de conexión (IP + usuario + contraseña del terminal). Va
// dentro de la app porque el nodo aún no se conoce. Se enseña cuando no hay identidad guardada.
function mostrarConexion(): void {
  if (!ventana) return;
  void ventana.loadFile(path.join(app.getAppPath(), "conectar-terminal.html"), {
    query: { servidor: ORIGEN },
  });
}

// Mostrar la pantalla de espera y sondear el nodo hasta que responda.
function mostrarEsperando(): void {
  if (!ventana) return;
  if (!esperando) {
    esperando = true;
    void ventana.loadFile(path.join(app.getAppPath(), "esperando.html"), {
      query: { servidor: ORIGEN },
    });
  }
  if (sondeo) return; // ya estamos reintentando
  sondeo = setInterval(async () => {
    if (await servidorVivo()) {
      if (sondeo) { clearInterval(sondeo); sondeo = null; }
      irAOperativa();
    }
  }, 2000);
}

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
  // Primer arranque: sin identidad guardada → pantalla de conexión (IP + credencial del
  // terminal). Con identidad → directo a la operativa (si el nodo no responde, el
  // did-fail-load de abajo lleva a "Conectando…" y reintenta).
  if (identidad) irAOperativa();
  else mostrarConexion();

  // Si no se puede cargar del nodo (apagado, reiniciándose, red caída), a la pantalla de
  // espera. -3 (ERR_ABORTED) es una navegación normal, no un fallo; y file:// es la propia
  // pantalla de espera: ninguno cuenta.
  ventana.webContents.on("did-fail-load", (_e, codigo, _desc, url, esPrincipal) => {
    if (!esPrincipal || codigo === -3) return;
    if (url.startsWith("file:")) return;
    mostrarEsperando();
  });

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
  // (la regla se llamaba `no-var-requires`; ese disable ya no silenciaba nada)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  // IP/URL del servidor configurable en config.json (la mete el instalador y se
  // edita en Configuración). Si está mal escrita, se mantiene el valor por defecto.
  const servidor = leerConfig(userData).servidor;
  if (servidor) {
    try { const u = normalizaUrl(servidor); ORIGEN = new URL(u).origin; URL_BASE = u; }
    catch { /* servidor inválido: se conserva GLUUH_URL / localhost */ }
  }
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
  ipcMain.handle("gluuh:abrir-cajon", () => cola.abrirCajonInmediato());
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
  // Configuración del terminal (config.json) editable desde la web.
  ipcMain.handle("gluuh:leer-config", () => leerConfig(userData));
  ipcMain.handle("gluuh:guardar-config", (_e, cfg: ConfigTerminal) => {
    try {
      guardarConfig(userData, cfg);
      // Si cambió el servidor, aplicarlo sin reiniciar: recargar a la nueva URL.
      if (cfg.servidor) {
        try {
          const u = normalizaUrl(cfg.servidor);
          if (u !== URL_BASE) { URL_BASE = u; ORIGEN = new URL(u).origin; ventana?.loadURL(`${URL_BASE}/inicio`); }
        } catch { /* URL inválida: no se recarga, se corregirá al reintentar */ }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // Primer arranque: login del TERMINAL (IP + usuario + contraseña). El fetch va por el main
  // (no el renderer) para no chocar con CORS desde un file://.
  ipcMain.handle("gluuh:conectar-terminal", async (_e, datos: { servidor: string; usuario: string; clave: string; recordar?: boolean }) => {
    const base = normalizaUrl(datos.servidor ?? "");
    if (!base) return { error: "Falta la dirección del servidor." };
    let origen: string;
    try { origen = new URL(base).origin; } catch { return { error: "La dirección del servidor no es válida." }; }

    let r: Response;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);
      r = await fetch(`${base}/auth/v1/dispositivo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario: datos.usuario, clave: datos.clave }),
        signal: c.signal,
      });
      clearTimeout(t);
    } catch {
      return { error: "No se pudo contactar con el servidor. Comprueba la dirección y la red." };
    }
    if (r.status === 401) return { error: "Usuario o contraseña del terminal incorrectos." };
    if (!r.ok) return { error: "El servidor rechazó la conexión." };

    const j = (await r.json()) as { device_id: string; nombre: string; modulo: string; token: string };
    // La dirección del servidor se guarda siempre (para reintentos y para prerrellenar).
    guardarConfig(userData, { ...leerConfig(userData), servidor: base });
    URL_BASE = base;
    ORIGEN = origen;
    // La identidad (con el token del dispositivo) solo si "recordar"; si no, vive en memoria.
    const id: Identidad = { device_id: j.device_id, nombre: j.nombre, modulo: j.modulo, token: j.token };
    if (datos.recordar !== false) guardarIdentidad(userData, id);
    identidad = id;
    irAOperativa();
    return { ok: true };
  });

  // ── Ventanas ────────────────────────────────────────────────────────────
  crearVentana();
  crearVisorSiHaySegundaPantalla(URL_BASE);
  screen.on("display-added", () => crearVisorSiHaySegundaPantalla(URL_BASE));

  // ── Arranque con Windows + updater + backup diario ──────────────────────
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  inicializarUpdater();
  crearPlanificadorDiario(
    () => { const b = leerConfig(userData).backup; return b?.destino ? b.hora ?? "03:30" : undefined; },
    () => notificarWeb({ tipo: "backup" }),
  );

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
