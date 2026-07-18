# AHORA — por dónde vamos

> **Actualizado:** 17-07-2026 · rama `nodo-local`
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
| Claude (chat) | **DECISIÓN 18-07: el TPV será app propia (Vite+React SPA servida por el nodo, dentro de Electron); la nube no servirá la operativa.** Decisión en `docs/plan/15-tpv-app-propia-vite.md`, migración en `docs/implementacion/22-tpv-spa-vite.md` (sin big-bang; prerequisito F1–F3 de la guía 21; incluye estructura de paquetes e inventario de módulos). Nodo como servicio Windows real (supervisor + SCM, health-checks, secretos con rotación, logs rotados, update con rollback): `docs/implementacion/23-nodo-servicio-windows.md`. **➡ PUNTO DE ENTRADA del desarrollo: `docs/implementacion/24-plan-maestro-tpv-y-nodo.md`** (etapas 0–8 con dependencias y puertas; E0 = commit+push pendiente). ⚠ Renombrado `17-tpv-perfecto.md` → `21-tpv-perfecto.md` (colisionaba con el 17 del manual del nodo). | `docs/plan/15…`, `docs/implementacion/21…`, `22…` |
| Claude (chat) | **E0 CERRADA · E1.2 hecha · E1.3 parcial · E2 BLOQUEADO** (18-07). **E0**: todo el trabajo TPV commiteado+pusheado (HEAD `08ec216`), `typecheck` 12/12 verde → desbloquea escritorio (el par que rompía `1736e1e` compila). **E1.2** (migración `useTpvStore`) ya estaba hecha (selectores+`getState`). **E1.3** — extraídas piezas PURAS con tests (lo que se mueve limpio a la SPA): `tpv/nombres.ts` (nombres/extras de línea), `tpv/ticket-impresion.ts` (dedup fiscal/proforma), `tpv/reparto.ts` (división en n iguales, céntimos exactos) y `tpv/pagos.ts` (mapeo de pagos: clamp/propina/cajón). **74 tests web verdes.** `page.tsx` ~3577 (no baja porque las features nuevas de esta sesión pesan más que lo extraído; el resto de reducción exige la extracción stateful de cobro/división, diferida por riesgo). ⚠ **El resto de E1.3 (cobro/división/JSX) queda DIFERIDO**: es ruta del dinero y aquí solo hay typecheck, no el humo de `PRUEBAS-TPV.md` (necesita nodo vivo). **E7.2**: encendidas 4 utilidades antes muertas, todas por reuse y sin escritura de riesgo — "Re. cocina" (`imprimirComandas`), "Resumen de caja" (Z del turno, `z_de_jornada` + `CerrarDiaModal` soloLectura), "Cobros pendientes" (`sales_order` POR_COBRAR, navega a la cuenta) y "Agenda" (→ vista Reservas). **E1.4 (F7)**: `tpv/perf.ts` con marcas de presupuesto (abrir cobrar 100ms, cambio de vista 50ms, cobrar 350ms; avisa en consola solo en dev). **7.1 Combinar copas COMPLETA** (0126 en nube, resolver con tests, flujo TPV, toggles familia/producto, setting en Ajustes). Quedan aparcadas, con motivo: "Buscar documento" (reimprimir doc fiscal pasado = sensible, necesita factura/huella), "Apunte de caja" (escribe `cash_move`, ruta de dinero no verificable aquí), "Selección de tarifa" (repricing, ruta de dinero); el resto de utilidades atenuadas necesitan módulos inexistentes (correcto así). ⛔ **E2 (fiscal al gateway) BLOQUEADO**: `gateway.mjs` es zero-dep y `apps/nodo` no es paquete; meter `@gluuh/core` exige tocar `Montar-Paquete.ps1` (empaquetar core en el nodo) + reiniciar/probar el nodo vivo → **coordinar con escritorio** antes de tocarlo (si no, TRAMPAS §5: módulo no encontrado en el bar, sin error). | `apps/web/app/tpv/{page.tsx,nombres.ts,ticket-impresion.ts,components/UtilidadesModal.tsx}` |
| Claude (escritorio) | **Nodo instalado en esta máquina** (18-07): la web del nodo elige puerto libre sola (aquí **3110**, el 3100 lo ocupa el `next dev`); panel /servidor con espera informativa + manifest/iconos; standalone desplegado en `C:\Gluuh` desde worktree limpio `C:\gluuh-paquete\web-limpia`. ✅ **RESUELTO (18-07, sesión chat)**: el HEAD actual `08ec216` **compila** (typecheck 12/12); el par página/modal de Dividir v2 quedó consistente. (Era: `1736e1e` arrastraba líneas a medias.) ⚠ Quedan 3 servicios **elevados** con el secreto viejo (auth/realtime/media, PIDs de antes de reinstalar): mueren con un reinicio de Windows. | `supabase/nodo/arrancar-nodo.ps1`, `apps/web/app/servidor/*`, `apps/web/public/manifest-servidor.webmanifest` |
| Codex + Claude (chat) | **F0 ENTREGADA · F1/F2 núcleo APLICADO EN LA NUBE** (17-07, autorizado): 0111–0115 aplicadas por MCP, tipos regenerados, espejos de transición retirados, smoke verde. Pendiente: aplicar la tanda **en el nodo** cuando se levante + prueba adversarial; F1 contract (1.5) tras canary; F2 restos (MFA, revocar sesiones, temporal cifrada, provisional offline). Seguimiento: `docs/estado/REPARACION-F0-F8.md` | `supabase/migrations/0111–0115`, `supabase/types/`, `apps/web/app/(panel)/layout.tsx`, `login`, `elegir-empresa`, `invitacion/`, `api/invitaciones|cuenta`, `lib/contexto.ts`, `packages/supabase`, `scripts/` |

### ✅ Auditoría técnica del 17-07 — EJECUTADA en su núcleo (mismo día)

Diagnóstico en [`docs/auditoria/`](../auditoria/README.md); ejecución y estado por fase
en [`REPARACION-F0-F8.md`](REPARACION-F0-F8.md). Los cuatro puntos se hicieron:
drift de `0105` verificado y clasificado, jornada/heartbeat y RBAC fail-closed
(0113/0114), cobro y emisión fiscal atómicos e idempotentes (0118/0119), cursores
compuestos + tombstones y superficie LAN cerrada. Migraciones `0111`–`0121` aplicadas
en la nube (0122 escrita, espera canary).

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

## 🔴 CONFIRMADO — el emparejado de terminales está ROTO en la nube

**El hook `custom_access_token_hook` NO está activado en Supabase.** Comprobado el 14-07
haciendo el login de verdad y decodificando el token: **sólo trae `role: authenticated`**,
ni `tenant_id` ni `user_rol`.

La app normal no se entera porque `current_tenant_id()` tiene un plan B (busca el `app_user`
por `auth.uid()`). Pero **hay una ruta que lee los claims a pelo**:

- `apps/web/app/api/dispositivos/generar/route.ts:39-44` → exige `user_rol` ∈ {PROPIETARIO,
  ENCARGADO} **del JWT**, y como no viene → **403 «Solo encargado o propietario» SIEMPRE**.
  → **desde el panel no se puede vincular ningún TPV nuevo.**
- Mirar de paso si el panel de admin depende de `is_platform_admin` (mismo problema).

**Dos salidas:**
- **Barata:** activar el hook en Supabase (Authentication → Hooks → Customize Access Token →
  apuntar a `public.custom_access_token_hook`). Un clic, pero **hay que acordarse en cada
  entorno** y no lo cubre ninguna migración.
- **Robusta (recomendada):** quitar la dependencia del claim en esa ruta y **preguntar el rol
  a la base** — exactamente lo que se hizo en `Instalar-Gluuh.ps1` cuando dio este mismo
  problema (leer `app_user` por `auth.uid()`). Así funciona con el hook y sin él.

> Es la **misma familia** que ya nos mordió tres veces: código que da por hecho que el token
> trae algo que no trae. Ver `TRAMPAS.md` §7.

---

## 🧹 Tarea limpia y suelta (buena para coger en paralelo)

**Quitar la mentira de las páginas de detalle** — ✅ **VERIFICADO HECHO (18-07, sesión chat)**.
Las cinco de detalle (`productos/[id]`, `categorias/[id]`, `familias/[id]`,
`grupos-mayores/[id]`, `ordenar-familias-y-categorias`) **ya guardan la carga**: las cuatro
primeras con `if (cargando) return <Cargando…>` antes de pintar el estado vacío, y `ordenar`
con `{cargado && …}`. Ninguna afirma «no hay nada» mientras carga. La nota anterior (que las
daba por pendientes) era obsoleta. Junto con las 10 principales (`TRAMPAS.md` §11), el panel
ya no miente sobre el estado del negocio.

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

**Siguiente número libre: `0127`.**

- `0126` — **APLICADA EN LA NUBE 18-07 (sesión chat, combinar copas / 7.1)**: `family.combinable`
  (bool, default false) + `product.combinable` (bool NULL = hereda de la familia; true/false
  = override por producto). La categoría de "con qué" (refrescos) va en un **setting**
  (`tpv.combinados.categoria_id`), no en columna. Resolver puro `esCombinable()` en
  `catalogo-store.ts` (con tests). **7.1 COMPLETA**: flujo de combinar en el TPV (picker de
  refresco tras añadir una copa combinable), toggle en la ficha de familia, override
  heredar/sí/no en la ficha de producto, y selector de categoría en Ajustes del panel.
  Tipos regenerados. ⚠ **Nodo: sin aplicar** (los selects del catálogo degradan solos hasta
  que llegue por su ledger, TRAMPAS §2).

- `0125` — **APLICADA 18-07 (sesión chat, llevar+reservas)**: `reservation` +telefono/canal/
  alergias y estado TERMINADA en el CHECK; `sales_order` +entrega_at/direccion/canal_pedido
  y EN_CAMINO en el CHECK de preparación. Para las pantallas de Para llevar y Reservas
  (mockups `docs/diseño/gluuh-para-llevar.html` / `gluuh-reservas.html`).

- `0124` — **APLICADA 17-07 (sesión chat, dividir cuenta)**: `separar_cuenta(p_mesa_order,
  p_location, p_user, p_campos, p_lineas)` — saca líneas concretas del pedido de una mesa
  a un sub-pedido cobrable (barra, POR_COBRAR) y las descuenta de la mesa, atómico y NO
  fiscal. Base de "cobrar por artículos → salen de la mesa". Invoker (RLS).

- `0123` — **RESERVADA + APLICADA 17-07 (sesión chat, dividir cuenta)**:
  `cuenta_parte` — persiste la división de una cuenta (partes IGUAL/IMPORTE/PRODUCTOS,
  importe, líneas jsonb, cobrada/payment) para que reaparezca al volver a la mesa.
  Diseño: `docs/plan/dividir-cuenta-y-ciclo.md`.

- `0122` — **ESCRITA 17-07, NO APLICAR HASTA CANARY** (F1.5 contract): retira las
  unicidades globales de `app_user` y crea la unicidad cuenta+tenant. Condiciones de
  aplicación DENTRO del fichero (canary F1 + sesiones renovadas). Puerta 8 aplica.
- `0121` — **RESERVADA 17-07 (F5.3, sesión chat)**: `sesion_soporte_y_break_glass` —
  sesiones de soporte con consentimiento del titular, break-glass con MFA+motivo (máx
  2 h, sin autorrenovación) y auditoría en `evento_seguridad`.

- `0120` — **APLICADA EN LA NUBE por MCP el 17-07** (F7.3): `tombstones_sync` — cada
  DELETE de catálogo deja lápida con fecha (trigger en **60 tablas**, humo verde). El
  sincronizador las respeta: fila local más vieja que su lápida se borra y NO se sube
  (la resurrección por backup antiguo está muerta); fila local más nueva gana (LWW).
  Marca `tumba:` por tabla con el mismo cursor compuesto. ⚠ En el NODO el trigger llega
  al aplicar 0120 allí — hasta entonces las bajas del bar no dejan lápida propia.

- `0119` — **APLICADA EN LA NUBE por MCP el 17-07** (F6): `cobro_atomico_y_outbox_worker` —
  RPC `cobrar_cuenta` (candado + validación de suma en servidor + pagos + COBRADA en una
  transacción; humo en vivo: suma-mal rechazada, pago mixto con propina OK, doble cobro
  de otro terminal → YA_COBRADA, reintento con mismo client_id → OK sin duplicar) y
  `outbox_tomar`/`outbox_resolver` (lease `skip locked` del worker AEAT).
  **El TPV aún NO la llama** (tpv/page.tsx en otra sesión): adoptarla al integrar.
  Worker en `apps/api` (`OutboxWorker`): apagado salvo `OUTBOX_AEAT=1`; verifica que la
  huella recalculada desde el snapshot == la almacenada ANTES de enviar; nunca marca
  ACEPTADA sin acuse. Política propina/redondeo codificada = la actual (puerta 6 abierta).

- `0118` — **APLICADA EN LA NUBE por MCP el 17-07** (F6): `emision_fiscal_atomica` —
  RPC `emitir_factura_fiscal` (factura + desglose + outbox en UNA transacción;
  humo en vivo: OK con desglose atómico, número pisado → COLISION limpia),
  unicidad `(tenant, order_id)` y `fiscal_outbox` (AEAT durable; **encolado apagado**:
  se enciende con `VERIFACTU_ENVIO=1` y aún NO hay worker). `/api/factura` ahora
  encadena la huella con el F1/F2 REAL (antes siempre F2) y un reintento tras
  timeout devuelve la factura existente en vez de emitir otra.

- `0117` — **APLICADA EN LA NUBE por MCP el 17-07** (F4): `emparejado_v2_y_operario` —
  credencial de dispositivo rotatoria/revocable (humo verificado: rotación v1→v2 OK,
  reuso del hash viejo rechazado), sesión de operario por terminal, bloqueo de PIN
  por TERMINAL (`validar_pin_terminal`; la firma vieja `validar_pin` pasa por el canal
  "sin terminal" — **los TPV deben pasar su `device_id` al adoptarla**), retirada de
  `admin_sembrar_terminal_defecto` y fin de la semilla de operarios conocidos
  (`crear-empresa` ya no llama a `admin_sembrar_operarios_defecto`; la función se
  retira en F4.4 final). Canje v2: access 12 h + refresh rotatorio; legacy JWT
  acortado a 30 días. Rutas nuevas: `/api/dispositivos/renovar` y `/revocar`.

- `0116` — **APLICADA EN LA NUBE 17-07** (F3, la ejecutó el usuario a mano):
  `orden_instalacion_y_nodo` — orden por local (hash del código, 30 días, reserva 24 h,
  un solo uso) + `nodo_instancia` + canje atómico `canjear_orden_instalacion`.
  Humo verificado en vivo: canje OK crea nodo, segundo canje INVALIDA; datos de humo
  borrados. Tipos regenerados (91 tablas / 49 RPC) y espejos de transición retirados.
  El flujo legacy `tenant.codigo_instalacion` sigue como compat hasta F3.4.
  **⚠ Nodo local: 0111–0116 sin aplicar allí** (aplicar al levantarlo).

- `0111`–`0115` — **APLICADAS EN LA NUBE por MCP el 17-07** (F1/F2, autorizado por el
  usuario): `0111_identidad_global_expand`, `0112_identidad_global_backfill` (2 cuentas,
  4 perfiles creados/materializados, 4 asignaciones, ledger verde),
  `0113_identidad_fail_closed` (current_tenant_id/operario_permite v2, contexto por
  sesión), `0114_endurecer_rpc_privilegiadas` (jornada/heartbeat con guardia de tenant,
  anon revocado), `0115_invitaciones_y_alta_titular`. Tipos regenerados (89 tablas /
  48 RPC), smoke fail-closed verde, advisors sin críticos.
  **⚠ EN EL NODO NO ESTÁN APLICADAS**: cuando se levante, aplicar 0111–0115 y correr
  `apps/nodo/pruebas/prueba-identidad-fail-closed.mjs`.

- `0110` — `clientes_stats()`: visitas y última visita por cliente (lista del TPV).

- `0109` — ficha de cliente "Cómo se le vende": `customer.tarifa_id` (FK a `tarifa`),
  `descuento_pct` y `saldo` (deuda, para el filtro "Con deuda").

- `0108` — el menú es un ARTÍCULO más: `menu.category_id` (FK a `category`, `on delete set null`).
  Así los menús caen en una familia/categoría "Menús" y salen en la rejilla del TPV como un
  producto (al tocarlo abre el MenuModal). El clonado de plantilla remapea `category_id`.

- `0107` — terminal por defecto al crear empresa. **Parte credencial RECHAZADA**: la
  función viva en la nube está ROTA (referencia objetos de `0105` que no existen),
  nunca sembró un terminal y el caller descartaba el error. Llamada eliminada de
  `crear-empresa` el 17-07; la función se retira de la nube en F4.

- `0105` — credencial usuario/contraseña por terminal. **DISEÑO RECHAZADO (plan
  `docs/plan/14`) y NO aplicada en la nube** (verificado por MCP el 17-07: 0 columnas,
  0 RPC — la nota anterior "aplicada en nube y nodo" era falsa para la nube). El código
  ya no la llama (flujo retirado; `/dispositivo` del nodo responde 410). Puede seguir
  aplicada en nodos existentes: su retirada allí es F4 (entrega 4.4), con migración
  nueva e idempotente. **No aplicar jamás.** Ver `docs/auditoria/08-baseline-esquema-2026-07-17.md`.
- `0106` — semilla de formas de pago (`admin_sembrar_formas_pago`): Efectivo/Tarjeta/Bizum
  al crear empresa, SIEMPRE, sin depender de la plantilla. La llama `api/admin/crear-empresa`.
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
