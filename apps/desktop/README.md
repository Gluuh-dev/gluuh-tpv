# @gluuh/desktop — TPV de barra (Electron)

Aplicación de escritorio (Windows) del TPV. **Electron carga la web operativa
(`/tpv`)** y aporta lo que el navegador no puede: impresión **ESC/POS** con cola
local y reintentos, apertura de **cajón**, **visor de cliente** en el segundo
monitor, **auto-update**, identidad de terminal y **copia de seguridad a USB**.
Guía completa: [docs/implementacion/03](../../docs/implementacion/03-app-escritorio-electron.md).

## Ejecutar (desarrollo)

```bash
# 1) Arranca la web (en otra terminal):
pnpm --filter @gluuh/web dev          # http://localhost:3100

# 2) Arranca el escritorio (compila TS y carga la web):
pnpm --filter @gluuh/desktop dev
# o apuntando a otra URL:
GLUUH_URL=https://tpv.gluuh.app pnpm --filter @gluuh/desktop dev
```

En desarrollo abre ventana normal; empaquetada arranca a pantalla completa,
con arranque junto a Windows y recarga automática si el renderer muere.

## Configuración del terminal

Fichero `config.json` en la carpeta de datos de la app
(`%APPDATA%/gluuh-desktop/` una vez empaquetada):

```json
{
  "servidor": "http://192.168.1.10:3100",
  "impresora": { "uri": "tcp://192.168.1.50:9100", "tipo": "EPSON", "ancho": 42 },
  "backup": { "hora": "03:30", "destino": "E:\\backups-gluuh" }
}
```

- **servidor**: URL/IP del equipo donde corre la web (se pide al instalar y se
  edita en Configuración). Sin ella se usa `GLUUH_URL` o `http://localhost:3100`.
- **impresora**: térmica ESC/POS por red (puerto 9100). Sin config, la web cae a
  `window.print()`. USB: compartirla en Windows como impresora de red (driver
  serie pendiente).
- **backup**: volcado diario de CSVs del tenant a la carpeta/USB indicada
  (retención: 30 copias). Sin `destino`, no hay backup automático.

## Puente `window.gluuh` (preload)

`imprimir(PrintJob)` · `abrirCajon()` · `guardarDispositivo(cred)` ·
`publicarTicketVisor(datos)` · `guardarBackup(nombre, ficheros)` ·
`onEvento(cb)` · `version` · `device`. El contrato `PrintJob` vive en
`@gluuh/hardware`.

## Identidad del dispositivo

Se vincula desde `/conectar` con un código de 6 dígitos generado en el
backoffice (Dispositivos). La credencial queda en `device.json` (userData).
Sin vincular, la app funciona igualmente con el login web normal.

## Empaquetado y auto-update

```bash
pnpm --filter @gluuh/desktop dist     # instalador NSIS en dist-instalador/
```

`electron-updater` comprueba GitHub Releases al arrancar y cada 6 h; instala al
siguiente arranque (nunca en mitad del servicio). Pendiente: firma de código
(SmartScreen avisará hasta entonces).
