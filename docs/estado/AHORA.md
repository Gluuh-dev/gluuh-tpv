# AHORA — por dónde vamos

> **Actualizado:** 14-07-2026 · rama `nodo-local`
> Léelo entero antes de tocar nada. Si terminas algo, **actualiza este fichero y haz push**.

## Qué es esto en cinco líneas

**Gluuh TPV** — TPV de hostelería para España, con VERIFACTU e IGIC canario.
Un bar tiene un **nodo local** (un mini-PC debajo de la barra) que **es la fuente de verdad
operativa**: cobra, imprime y factura **sin internet**. La nube (Supabase) es el espejo, el
panel del dueño y quien remite a Hacienda. Los TPV **sólo** hablan con el nodo.

Monorepo pnpm + Turborepo. El cerebro fiscal está en `packages/core` y **no se duplica**.

---

## ✅ Funciona hoy (y hay una prueba que lo demuestra)

Todo esto está **probado contra el nodo y la nube de verdad**, no simulado.

| | prueba |
|---|---|
| El bar **cobra sin internet**: TPV → ticket → factura VERIFACTU | `prueba-facturas-a-la-vez.mjs` |
| **Dos camareros** en la misma mesa **no se pisan** | `prueba-dos-camareros.mjs` |
| **6 cobros a la vez**: numeración correlativa y **la cadena de huellas no se bifurca** | `prueba-facturas-a-la-vez.mjs` |
| **La jornada** (el día del bar): Z, arqueo, descuadre, cierre automático a las 06:00 | `prueba-jornada.mjs` |
| **El catálogo viaja en las dos direcciones** y el 2º pase **no mueve nada** | `prueba-catalogo.mjs` |
| **Las ventas suben sin duplicar** (idempotencia por `client_id`) | `prueba-sync.mjs` |
| La nube recibe **factura + desglose + huella** (puede declarar) | `prueba-sync-fiscal.mjs` |
| El **dueño entra al panel sin internet**; el camarero, con su PIN | `prueba-auth-sin-gotrue.mjs` |
| La **RLS aísla los bares** (Ana no ve a Berto ni pidiéndolo) | `prueba-rls.mjs` |
| **Realtime** (SSE) y **fotos sin internet** | `prueba-realtime.mjs`, `prueba-media.mjs` |
| El **vigilante** revive un servicio caído en ~35 s | `prueba-vigilante.ps1` |
| Los `.ps1` **arrancan en el Windows de un bar** (PS 5.1 + BOM) | `prueba-instalador.ps1` |

```powershell
# Levantar y probar
.\supabase\nodo\Instalar-Gluuh.ps1     # instala el bar entero (es el instalador de verdad)
.\supabase\nodo\arrancar-nodo.ps1      # o sólo arrancar
node apps/nodo/pruebas/prueba-jornada.mjs   # (y las demás)
pnpm --filter @gluuh/core test         # 44 tests del motor fiscal
```

**El instalador**: `.\supabase\nodo\instalador\Montar-Paquete.ps1` → `C:\gluuh-paquete\dist\GluuhServidor-1.0.0.exe` (86 MB, asistente de 4 páginas).

---

## 🔨 En marcha

*(Apúntate AQUÍ antes de empezar, con los ficheros que vas a tocar. Y quítate al terminar.)*

| quién | qué | ficheros |
|---|---|---|
| — | — | — |

---

## 🔴 Bloqueado — esperándote a TI

1. **Ejecutar el `.exe` en una MÁQUINA LIMPIA** (sin Node, sin Postgres, sin este repo) **y
   COBRAR UNA MESA.** Es *la* prueba que falta. Todo lo demás está probado; esto no.
   *(Y es exactamente el tipo de camino que, por no recorrerlo, tenía tres tapones.)*
2. **Rotar la contraseña del titular de pruebas** (`admin@gluuh.com`). Se restableció el
   14-07 durante la prueba del instalador y **la nueva quedó escrita en el chat**. Cámbiala en
   Supabase → Authentication → Users. *(La contraseña **no se escribe aquí**: este repositorio
   es **público**.)*
3. **Firmar el `.exe`.** Sin firma, SmartScreen enseña un aviso rojo de «aplicación no
   reconocida» y el técnico no va a pulsar *ejecutar de todas formas* en el ordenador de un
   cliente.

---

## ⚠️ Sin confirmar — hay que mirarlo

**El hook `custom_access_token_hook` NO está activado en Supabase.** La función existe en la
base, pero el token que devuelve el login **no trae `tenant_id` ni `user_rol`**.

La aplicación no se entera porque `current_tenant_id()` tiene un plan B (busca el `app_user`
por `auth.uid()`). Pero **hay código que lee los claims a pelo**:

- `apps/web/app/api/dispositivos/generar/route.ts` → exige `user_rol` ∈ {PROPIETARIO,
  ENCARGADO} leyéndolo del JWT. **Si el hook está apagado, esto devuelve 403 siempre** → el
  **emparejado de terminales estaría roto**. *Hay que comprobarlo.*
- `es_admin_plataforma()` / `is_platform_admin` → mirar si el panel de admin depende de ello.

Dos salidas: **activar el hook** en Supabase (Authentication → Hooks → Customize Access
Token), o **quitar la dependencia del claim** como se hizo en `Instalar-Gluuh.ps1`. Lo
segundo es más robusto; lo primero, más barato.

---

## ⏭️ Lo siguiente (por orden)

Sale de `docs/plan/11-decisiones-del-nodo.md`.

1. **Latido + modo emergencia + serie A/B.** El nodo late contra la nube. Si un bar lleva
   días sin dar señales, se ve en el panel. Y la serie de facturación se parte (A el nodo,
   B la nube) para que no puedan chocar nunca.
2. **Impresión por IP** (ESC/POS sobre TCP 9100). Hoy la impresión depende de Electron.
3. **Envío a la AEAT desde la nube.** El nodo ya le manda la factura, su desglose y su huella
   (`prueba-sync-fiscal.mjs` lo demuestra). Falta que la nube las remita.
4. **Un nodo por LOCAL, no por empresa.** Hoy `provisionar.mjs` se baja el `tenant` entero.
   Una cadena con tres bares necesita tres nodos, cada uno con lo suyo.
5. **Cuenta de servicio por bar** (en vez de reusar la cuenta del titular).
6. **Condiciones de uso** — el instalador va **sin página de licencia a propósito**: una
   licencia inventada que el cliente ACEPTA es peor que no tener ninguna.

---

## 🔢 Migraciones

**Siguiente número libre: `0105`.**
*(Cógelo, **súbelo aquí primero**, y luego escribe el fichero. Si dos sesiones escriben una
0105, git mezcla las dos y se aplican en un orden que nadie decidió.)*

Aplicadas **en la nube y en el nodo** hasta la **0104**:

| | |
|---|---|
| `0099` | unifica los clientes en `customer` (mata la tabla `client`) |
| `0100` | `nodo_release` — publicar actualizaciones a los bares |
| `0101` | `updated_at` en **49 tablas** de catálogo + `set_updated_at` sólo hacia adelante |
| `0102` | `guardar_cuenta` — dos camareros no se pisan (se va `reemplazar_lineas_orden`) |
| `0103` | **la jornada** — el día del bar, el Z, el arqueo |
| `0104` | `empresa_por_codigo` — sin esto el instalador no instala nada |

---

## 🗺️ El mapa, en corto

```
apps/web        Next 16. Backoffice en app/(panel), TPV en app/tpv.
                ⚠ En las rutas de API: `lib/supabaseServidor.ts`, NUNCA `NEXT_PUBLIC_*`.
                   (En el nodo, eso hablaba con la nube: el bar no podía cobrar.)
apps/nodo       El servidor del bar. gateway(54321) auth realtime media web sync
                espejo.mjs = el mirroring compartido. jornada/copia/reloj = lo de cada noche.
packages/core   El motor fiscal. VERIFACTU (huella encadenada, QR, XML) e IVA/IGIC/IPSI.
                NO SE DUPLICA EN LAS APPS.
supabase/       migrations/ = el esquema canónico. nodo/ = instalar y arrancar el bar.
```

Los siete servicios del nodo: Postgres **55432**, PostgREST 55433, Auth **propio** 55434,
Realtime (SSE) 55435, Media 55436, Web (Next) 3100, **Gateway 54321 ← lo único que ve el TPV**.
