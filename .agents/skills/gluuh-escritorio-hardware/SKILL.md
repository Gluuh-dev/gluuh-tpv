---
name: gluuh-escritorio-hardware
description: >-
  Cómo construir y tocar la app de escritorio de Gluuh (apps/desktop, Electron)
  y la capa de hardware (packages/hardware): puente window.gluuh, impresión
  ESC/POS con cola local y cola compartida print_job, cajón, modo kiosk,
  visor de cliente en segundo monitor, empaquetado con auto-update, identidad
  de dispositivo y copia de seguridad a USB. Úsala SIEMPRE que trabajes en
  apps/desktop, packages/hardware, impresión de tickets o integración de
  periféricos del TPV.
---

# App de escritorio y hardware — guía de trabajo

Documento madre: `docs/implementacion/03-app-escritorio-electron.md` (piezas,
DDL de `print_job`, criterios de aceptación). Decisiones de arquitectura:
`docs/plan/02-app-escritorio-windows.md`.

## Principios

1. **No se reescribe la web**: Electron carga la web TPV (`GLUUH_URL`; dev
   `http://localhost:3100/tpv` — el README que diga 3000 está mal). El desktop
   solo añade lo que el navegador no puede: hardware, kiosk, updater, backup.
2. **Un solo canal web↔nativo: el preload** (`contextBridge` → `window.gluuh`).
   `contextIsolation: true`, `nodeIntegration: false` (ya está así). Nada de
   servidores HTTP locales ni servicios Windows aparte.
3. El contrato de impresión es **`PrintJob` de `packages/hardware`** — los
   drivers se implementan en ese paquete, no en la app.

## Contrato `window.gluuh`

```ts
{ version, device: {id,nombre}|null, imprimir(job): Promise<{ok,error?}>,
  abrirCajon(): Promise<void>, online: boolean, onEvento(cb) }
```
La web detecta `window.gluuh` y elige impresión nativa vs `window.print()`.

## Impresión (el corazón)

- Driver: `EscPosPrinter implements Printer` en `packages/hardware` con
  `node-thermal-printer` (Epson/Star; `tcp://ip:9100`, USB, serie vía
  `serialport`). Cajón = pulso `ESC p` cuando `abrirCajon: true`.
- **Cola local persistida** (`userData/cola-impresion.json`): impresora apagada
  → reintento cada 15 s + evento a la web. Un ticket jamás se pierde.
- **Cola compartida**: tabla `print_job` (tenant, device_destino, payload,
  estado) + suscripción Supabase Realtime en el main → el PC imprime lo de
  comandera/kiosko. Limitación asumida: sin internet solo imprime el propio PC.
- Config de impresora en `setting` ámbito DEVICE (`impresora.tipo/uri/ancho`).

## Resto de piezas (resumen operativo)

- **Identidad**: `userData/device.json` `{device_id, token, nombre}`; si falta,
  cargar `/conectar` (flujo de emparejado de la skill gluuh-modulos-dispositivos).
- **Kiosk**: fullscreen, `autoHideMenuBar`, bloqueo de navegación fuera del
  dominio, cierre con PIN de encargado (interceptar `close`, preguntar vía IPC),
  arranque con Windows, relanzado en `render-process-gone`.
- **Empaquetado**: `electron-builder` (NSIS) + `electron-updater` (GitHub
  Releases); comprobar al arrancar y cada 6 h, instalar al siguiente arranque —
  nunca reiniciar en mitad del servicio. Firma de código pendiente (SmartScreen
  avisará; documentado).
- **Visor de cliente**: si hay 2º monitor (`screen.getAllDisplays()`), segunda
  BrowserWindow fullscreen con `/visor` (ticket en curso vía IPC; en reposo,
  ofertas). Sin red, sin BD: solo IPC.
- **Backup local**: a la hora configurada (`backup.hora/destino` en setting
  DEVICE), exportar CSV por tabla + `manifest.json` a la carpeta/USB elegida,
  vía RPC `export_tenant_csv` (security definer, token de dispositivo — NUNCA
  la service key en el desktop). Retener 30 copias. Formato legible sin Gluuh.

## Convenciones del paquete

- `apps/desktop/src/*.ts` compilado con tsc (sin bundler): `main.ts`,
  `preload.ts`, `impresion.ts`, `identidad.ts`, `backup.ts`, `visor.ts`.
- Dependencias permitidas: `electron`, `electron-builder`, `electron-updater`,
  `node-thermal-printer`, `serialport`. No añadir otras sin decisión explícita.
- Offline de datos NO es asunto del desktop: lo resuelve PowerSync en la web
  (`docs/implementacion/06-offline-powersync.md`). El desktop solo aporta la
  cola de impresión local y el indicador de red.
