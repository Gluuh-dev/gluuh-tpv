# 23 — El nodo como servicio de Windows "de verdad"

> Objetivo: que el mini-PC del bar se comporte como un electrodoméstico — enchufas
> y funciona, se recupera solo, se apaga limpio y se actualiza entero. **Se parte
> de lo que YA existe** (tarea programada SYSTEM al arranque, `arrancar-nodo.ps1`
> con `Start-Process` por pieza, vigilante que revive en ~35 s, bandeja, gateway de
> puerto único, instalador `.exe`): esto lo endurece, no lo reescribe.

## Diagnóstico de lo actual (verificado en `supabase/nodo/`)

| Pieza | Hoy | Riesgo |
|---|---|---|
| Arranque | Tarea programada (SYSTEM, AtStartup) → `arrancar-nodo.ps1` lanza pg_ctl, PostgREST, GoTrue, servicios Node y web con `Start-Process` | Procesos "sueltos": sin recuperación individual del SCM, sin apagado ordenado |
| Recuperación | Vigilante (~35 s) + la tarea como 2º nivel | Bien; pero el vigilante no distingue "caído" de "arrancando" (sleeps, no health-checks) |
| Secretos | `secreto.mjs`; **hoy hay 3 procesos elevados con el secreto viejo** (AHORA.md) — mueren al reiniciar | La rotación de secretos no reinicia a los consumidores |
| Logs | Salida de procesos; sin rotación uniforme | Disco lleno con el tiempo; diagnóstico difícil |
| Apagado | El SO mata los procesos | Postgres sin `pg_ctl stop -m fast` → recovery al arrancar (funciona, pero es sucio) |
| Puertos | Gateway único LAN; web elige puerto libre (3110 si 3100 ocupado) | El puerto variable complica a Electron/TPVs: debe ser FIJO en producción |

## Plan (en orden; cada paso deja el nodo mejor y probado)

### 1. Supervisor único como SERVICIO Windows real
Un solo proceso `apps/nodo/supervisor.mjs` que:
- lanza los hijos **en orden con health-check** (pg `pg_isready` → PostgREST →
  GoTrue → gateway → media/sync → web/SPA) — fuera los sleeps;
- reinicia al hijo caído con backoff exponencial (1 s→2→4… máx 30 s) y contador;
- expone `GET /salud` (estado por hijo, uptime, versión) — lo pinta la bandeja y
  el panel `/servidor`;
- al recibir STOP: apaga hijos en orden inverso y **`pg_ctl stop -m fast`**.

Registrado como **servicio del SCM** (`GluuhNodo`) con `sc.exe create` +
`sc failure` (reinicio automático), en vez de tarea programada. El SCM da:
arranque al boot, recuperación, dependencias (Tcpip), y el evento de apagado que
una tarea no recibe. La tarea actual queda como plan C durante una versión.
*(El vigilante actual se integra COMO el supervisor — no son dos cosas.)*

### 2. Health-checks reales y arranque rápido
- Cada pieza declara su chequeo (puerto + endpoint) en un manifiesto
  `nodo.config.json` (nombre, orden, comando, salud, puerto FIJO).
- **Puertos fijos en producción** (web/SPA 3100, gateway el suyo): si está
  ocupado, el supervisor mata al ocupante zombi propio o falla con mensaje claro
  — nunca "elige otro" (los TPV apuntan a una URL fija).

### 3. Secretos con rotación segura
- Un único origen (`secreto.mjs`, ya existe) + **al rotar, el supervisor
  reinicia** a todos los consumidores. Adiós a la clase de bug "3 procesos con el
  secreto viejo". Fichero de secretos con ACL solo SYSTEM/Administradores.

### 4. Logs como producto
- `C:\Gluuh\logs\<servicio>.log` con rotación por tamaño (p. ej. 5 MB × 5) hecha
  por el supervisor. Errores fatales → Registro de eventos de Windows (fuente
  "Gluuh"), que es donde mira un técnico.

### 5. Actualización del nodo en un paso
- Paquete de versión (zip: standalone del panel + `apps/tpv/dist` + servicios +
  `parches/*.sql`) → el supervisor: para hijos → swap de carpeta (`actual` →
  `anterior`, versión nueva → `actual`) → aplica parches SQL en orden → arranca →
  si la salud no llega en N s, **rollback automático** a `anterior`.
- Esto conecta con la guía 15 (licencia/despliegue) y con el latido a la nube
  (AHORA «Lo siguiente» nº 1): la nube ve versión y estado de cada bar.

### 6. Cortafuegos y superficie
- Regla de firewall del instalador: solo el puerto del gateway (y web/SPA) en la
  LAN; Postgres 55432 y servicios internos **solo localhost**. (La auditoría F0–F8
  ya cerró superficie; esto lo deja escrito en el instalador.)

### 7. Pruebas que lo demuestran (patrón del repo: si no hay prueba, no está hecho)
- `prueba-supervisor.ps1`: mata cada hijo → revive en < 10 s; mata Postgres →
  revive y el TPV cobra; `Restart-Computer` → todo arriba sin tocar nada.
- `prueba-apagado.ps1`: stop del servicio → Postgres para limpio (sin recovery en
  el siguiente arranque).
- Se añaden al humo del instalador (`prueba-instalador.ps1`).

## Qué NO se hace
- NSSM u otro wrapper externo por hijo: más piezas que mantener; el supervisor
  único ya da recuperación por hijo y un solo punto de servicio.
- Reescribir servicios en otro lenguaje (decisión en `docs/plan/15`).

## Estado
| Paso | Estado |
|---|---|
| 1–7 | ⬜ (coordinar con la sesión de escritorio: instalador y nodo instalado en su máquina) |
