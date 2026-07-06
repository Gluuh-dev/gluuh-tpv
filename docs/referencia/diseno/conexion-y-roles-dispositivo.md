# Conexión y roles de dispositivo (cómo cada equipo sabe qué es)

> Cómo un dispositivo se conecta al sistema y **decide qué rol cumple** (TPV, comandero, monitor de cocina, pantalla, almacén). Investigado del **manual oficial de Ágora** y reescrito con nuestra propuesta (sin teclear IP/puerto). Complementa [arquitectura.md](arquitectura.md) y [01 — Plataforma](../01-arquitectura-y-plataforma/).

---

## Cómo lo hace Ágora (confirmado en su manual)

1. **El TPV maestro/servidor levanta servidores web** por módulo, cada uno en su **puerto**:
   - Monitor de Cocina (KDS): puerto **8983** por defecto.
   - Administración/comandas web: **8984** (el que usas).
   - El puerto es configurable desde la activación de módulos.
2. **Cada dispositivo entra por navegador** a `http://ip-del-servidor:puerto`. No instala nada: es una **web servida desde el equipo maestro en la LAN**.
3. En la **pantalla de arranque** se elige el **Tipo** del dispositivo y parámetros (lo de tu captura, v8.2.5):
   - **Tipo**: `Monitor de cocina` / `TPV` / `Comandero` …
   - **Idioma**, **Log** (INFO…), **Monitor** (qué monitor KDS de los configurados), **Tamaño Fuente**.
4. Esa elección se **guarda en el dispositivo** (navegador) → a partir de ahí arranca directo en ese rol.
5. En multipuesto, cada cliente configura **dirección IP/nombre + puerto TCP** del servidor, SSL sí/no, **"Comprobar conexión"**, y se marca **"Este equipo sólo se utiliza como cliente"** (deshabilita funciones de servidor, mejora rendimiento). Los clientes **sincronizan la hora** con el servidor antes de vender. Hay que abrir el puerto en firewall/antivirus.

```
        ┌──────── EQUIPO MAESTRO (servidor LAN) ────────┐
        │  Ágora server + BD local + servidores web      │
        │   :8983 KDS   :8984 web/comandas   ...          │
        └───────────────▲───────────────▲───────────────┘
                         │ http (LAN)    │
        ┌────────────────┴──┐   ┌────────┴───────────┐
        │ navegador → Tipo:  │   │ navegador → Tipo:   │
        │   "Monitor cocina" │   │   "Comandero"/"TPV" │
        └────────────────────┘   └─────────────────────┘
```

> Resumen Ágora: **una web servida en LAN + el dispositivo elige su rol al arrancar y lo recuerda**. Sencillo, pero exige **teclear IP/puerto**, abrir firewall y depende del equipo maestro encendido.

## Cómo lo hacemos nosotros (igual o mejor)

Mismo principio (**rol por dispositivo, una sola base de código**) pero **sin IPs ni puertos a mano** y funcionando también contra la nube:

### 1. Roles = superficies que ya tenemos
`app/tpv` · `app/comandera` · `app/kds` (cocina) · `app/pantalla` (cliente) · `app/kiosko` · `app/almacen`. El "Tipo" de Ágora = nuestra **superficie**; el `device.tipo` ([puntos-de-venta.md](../09-referencia-configurador-agora/administracion/puntos-de-venta.md)) ya lo modela.

### 2. Emparejamiento por **QR**, no por IP ★
En vez de teclear `ip:puerto` + elegir tipo, el dispositivo nuevo muestra una pantalla "Emparejar" → se **escanea un QR generado en el backoffice** (o se introduce un código corto). Ese QR lleva: tenant, servidor (nube o LAN), **rol/grupo/centro** y un **token de emparejamiento** de un solo uso.
- Resultado: se crea/asocia el registro `device`, se guarda el **token** y el **rol** en el dispositivo, y arranca directo en su superficie en **modo kiosco**.
- Cero IPs, cero puertos, cero firewall para el usuario. Cambiar el rol de un terminal se hace **desde el backoffice**, no en el equipo.

### 3. A qué se conecta
- **Por defecto, a la nube** (Supabase) — no necesita equipo maestro encendido.
- **Opcional: servidor LAN edge** (offline‑first) — autodescubrimiento por **mDNS/Bonjour** (sin teclear IP) y *fallback* a la nube. La verdad canónica sigue en Supabase ([01 §4](../01-arquitectura-y-plataforma/)).

### 4. Persistencia y arranque
El rol + token viven en el dispositivo (localStorage / secure storage en Tauri/Expo). Arranque automático a pantalla completa en su rol ([01 §6 kiosco](../01-arquitectura-y-plataforma/)). Sin "pantalla de arranque" cada vez.

### 5. Parámetros equivalentes
- **Idioma** → del usuario/dispositivo ([recursos.md](../09-referencia-configurador-agora/herramientas/recursos.md)).
- **Monitor / Tamaño fuente** → del `kitchen_monitor` y del `button_layout` ([monitores-cocina.md](../09-referencia-configurador-agora/cocina/monitores-cocina.md), [configuracion-botones.md](../09-referencia-configurador-agora/herramientas/configuracion-botones.md)) — configurados en backoffice, no en el equipo.
- **Log** → telemetría/diagnóstico opcional.

### 6. Seguridad
Token por dispositivo (revocable desde backoffice), PIN por superficie + Supabase Auth para backoffice ([usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md)), todo respaldado por RLS.

```
DISPOSITIVO NUEVO
  abre la PWA → "Emparejar" → escanea QR del backoffice
        → registra device (tenant, rol, centro, grupo) + token
        → arranca en su superficie (kiosco) contra nube (o LAN edge si existe)
  (cambiar rol = backoffice, no el equipo)
```

## Tabla comparativa

| Aspecto | Ágora | Gluuh (propuesta) |
|---|---|---|
| Conexión | teclear `ip:puerto` + firewall | **QR de emparejamiento** / autodescubrimiento mDNS |
| Elección de rol | en el equipo, al arrancar | en el **backoffice**; el equipo solo hereda |
| Servidor | equipo maestro LAN encendido | **nube** por defecto + LAN edge opcional |
| Recordar rol | navegador del equipo | token+rol en dispositivo (revocable) |
| Cambiar rol/zona | reconfigurar el equipo | un clic en backoffice |
| Una base de código | sí (web por módulo) | **sí** (`apps/web`, una superficie por ruta) |

> Prioridad: **media‑alta**. El emparejamiento por QR es un gran salto de usabilidad frente a "teclea la IP y el puerto"; encaja con [arquitectura.md](arquitectura.md) y el modelo `device` de [puntos-de-venta.md](../09-referencia-configurador-agora/administracion/puntos-de-venta.md). 🔴 falta.

---

**Fuentes (manual oficial Ágora):**
- KDS — acceso por navegador `http://ipservidor:puerto`, puerto 8983 por defecto: <https://www.agorapos.com/manual/agora-restaurant/html/AgoraKDS.html>
- Configurar conexión a servidor (IP/nombre + puerto TCP, "solo cliente", comprobar conexión, sincronización horaria): <https://www.agorapos.com/manual/agora-retail/html/PosConfigurationConfigureServer.html>
- Administración Web (acceso por navegador a `http://IP-DEL-SERVIDOR:PUERTO/`): <https://www.agorapos.com/manual/agora-retail/html/WA_AdministracionWeb.html>
- App de almacén web: <https://www.agorapos.com/manual/agora-restaurant/html/AgoraWMS.html>
