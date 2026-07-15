// Gluuh TPV — LA APP DE BANDEJA DEL SERVIDOR DEL BAR.
//
// ─────────────────────────────────────────────────────────────────────────────
//  QUÉ ES, Y POR QUÉ ES DISTINTA DEL TPV
//
//  El mini-PC de debajo de la barra es el SERVIDOR. No cobra: sirve los datos y la web a
//  los TPV. Hasta ahora su panel (`/servidor`) sólo se abría en el navegador, y no había
//  forma de saber de un vistazo si estaba vivo.
//
//  Esto lo convierte en una app de verdad: un icono en la BANDEJA (la esquina de abajo a la
//  derecha, junto al reloj). Verde = todo bien. Ámbar/rojo = algo pasa. Con un clic se abre
//  el panel; al cerrarlo, NO se cierra el programa: se esconde en la bandeja y sigue ahí.
//
//  Es un `main` de Electron APARTE del TPV (`main.ts`) a propósito: el TPV va a pantalla
//  completa, imprime tickets y gestiona el cajón. El servidor no hace nada de eso — sólo
//  enseña su panel y se queda en la esquina. Meter las dos cosas en un fichero sería
//  cargar el mini-PC del bar con medio TPV que no usa.
//
//  Se arranca con:  electron dist/servidor.main.js
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, Menu, Tray, nativeImage, shell } from "electron";
import path from "node:path";
import http from "node:http";

const PANEL = process.env.GLUUH_PANEL_URL ?? "http://localhost:54321/servidor";
const ESTADO = process.env.GLUUH_ESTADO_URL ?? "http://localhost:54321/nodo/estado";
const ICONO = path.join(__dirname, "..", "icono-app.png");

let ventana: BrowserWindow | null = null;
let tray: Tray | null = null;

// Un solo servidor por PC: si se abre dos veces, la segunda saca a la primera del escondite.
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => mostrar());

function crearVentana(): void {
  ventana = new BrowserWindow({
    width: 1000,
    height: 760,
    title: "Servidor Gluuh",
    icon: ICONO,
    autoHideMenuBar: true,
    show: false,   // arranca escondido en la bandeja; se muestra al pulsar el icono
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  void ventana.loadURL(PANEL);

  // Cerrar la ventana NO cierra el servidor: se esconde en la bandeja. Un servidor que se
  // apaga porque alguien le dio a la X es un bar que por la tarde no puede cobrar. Para
  // salir de verdad, el menú de la bandeja → «Salir».
  ventana.on("close", (e) => {
    if (!salamosDeVerdad) {
      e.preventDefault();
      ventana?.hide();
    }
  });

  // Los enlaces externos (si el panel abriera alguno) van al navegador, no dentro de la app.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

function mostrar(): void {
  if (!ventana) crearVentana();
  ventana?.show();
  ventana?.focus();
}

let salamosDeVerdad = false;
function salir(): void {
  salamosDeVerdad = true;
  app.quit();
}

// ── El semáforo de la bandeja ────────────────────────────────────────────────
//
// Cada 30 s se pregunta al propio nodo cómo está y se pinta el aviso del icono en
// consecuencia. Así el dueño ve DESDE LA ESQUINA si su servidor va bien, sin abrir nada.
function comprobarEstado(): void {
  http.get(ESTADO, (res) => {
    let cuerpo = "";
    res.on("data", (c) => (cuerpo += c));
    res.on("end", () => {
      try {
        const e = JSON.parse(cuerpo);
        const servicios = Object.values(e.servicios ?? {});
        const todoArriba = servicios.length > 0 && servicios.every(Boolean);
        const relojMal = e.reloj?.ok === false;
        pintarTray(todoArriba && !relojMal ? "ok" : "aviso");
      } catch {
        pintarTray("caido");
      }
    });
  }).on("error", () => pintarTray("caido"));
}

function pintarTray(estado: "ok" | "aviso" | "caido"): void {
  if (!tray) return;
  const texto = {
    ok:     "Servidor Gluuh — todo funcionando",
    aviso:  "Servidor Gluuh — atención: algo necesita mirarse",
    caido:  "Servidor Gluuh — NO RESPONDE",
  }[estado];
  tray.setToolTip(texto);
}

app.whenReady().then(() => {
  crearVentana();

  const icono = nativeImage.createFromPath(ICONO);
  tray = new Tray(icono.isEmpty() ? nativeImage.createEmpty() : icono);
  tray.setToolTip("Servidor Gluuh");

  const menu = Menu.buildFromTemplate([
    { label: "Abrir el panel", click: mostrar },
    { type: "separator" },
    { label: "Salir", click: salir },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", mostrar);   // clic normal en el icono = abrir el panel

  comprobarEstado();
  setInterval(comprobarEstado, 30_000);

  // Arranca solo al encender el ordenador (es el panel del servidor: siempre presente).
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
});

// Sin ventanas NO se cierra: vive en la bandeja hasta que se elige «Salir».
//
// En Windows, el comportamiento por defecto de `window-all-closed` es CERRAR la app. Basta
// con suscribirse (aunque el handler no haga nada) para desactivar ese cierre automático: a
// partir de aquí, mandamos nosotros, y sólo se sale por el menú de la bandeja.
app.on("window-all-closed", () => {
  if (salamosDeVerdad) app.quit();
});
