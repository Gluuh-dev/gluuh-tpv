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

## 🆕 La SPA del TPV en Vite YA EXISTE (18-07)

**`apps/tpv`** — el TPV instalable como **SPA Vite + React + Tailwind 4** (decisión plan 15,
guía 22 Fase C). **Compila** (`pnpm --filter @gluuh/tpv build`, `vite build` verde) y typecheck
verde; el workspace pasó a **13 paquetes**. Trae el **sistema de diseño Gluuh entero** (copia
fiel de `apps/web/app/globals.css`: tokens claro/oscuro, marca morada) y **tema propio**
(`src/lib/tema.ts`, sin next-themes). `src/App.tsx` es un starter operativo (rejilla + ticket)
**para empezar a diseñar el TPV en Vite ya**. Dev: `pnpm --filter @gluuh/tpv dev` (:3120).

⚠ **Sin big-bang**: el TPV Next (`apps/web/app/tpv`) **sigue funcionando** como referencia
hasta que la SPA alcance paridad y pase el humo. Siguiente fase: mover por tandas los módulos
puros (ya extraídos: `precio/nombres/reparto/pagos/ticket-impresion`) y luego el `page.tsx`
stateful + su desacople de `next/navigation`/`next/dynamic`.

---

## 🔨 En marcha

*(Apúntate AQUÍ antes de empezar, con los ficheros que vas a tocar. Y quítate al terminar.)*

| quién | qué | ficheros |
|---|---|---|
| Claude (chat) | **Ficha de artículo del TPV nuevo CABLEADA al nodo (20-07).** La pantalla de Artículos deja de ser demo: si el terminal está emparejado lee `product`+`product_format`+`product_category` del nodo y guarda allí; si no, enseña la carta de ejemplo **con su aviso en pantalla** (un catálogo de mentira sin avisar acaba con alguien dando de alta 40 artículos que se pierden al recargar). **0128 aplicada en NUBE y NODO** (contrastadas las 10 columnas en los dos lados): `product.color/icono` + los 6 parámetros que la ficha ya pintaba y no tenían dónde guardarse, y `product_format.coste/raciones`. ⚠ **Las TARIFAS (precio por sala) NO se guardan** y la ficha lo dice: el modelo bueno es una tabla `tarifa`, no tres columnas con las salas incrustadas — **decisión pendiente**. Verificado contra el nodo real (lectura de 74 productos + alta con formato y categoría, **en transacción y con rollback**, 74 antes y después). Confirmado en vivo que `numeric` llega como **TEXTO** por JSON (`"3.20"`): sin convertir, los precios se suman como cadenas. El transporte con el nodo sale a `lib/nodo.ts` (era una copia dentro de `operarios.ts`). ⚠ **Nada de esto se activa hasta que la SPA tenga EMPAREJADO (F4)**: hoy no hay sesión de dispositivo, así que en la práctica va en modo ejemplo. | `apps/tpv/src/lib/nodo.ts`, `apps/tpv/src/apartados/config/mantenimiento/{catalogo,duplicar,Productos,AspectoArticulo}.*`, `supabase/migrations/0128_*.sql` |
| Claude (chat) | **LAS 9 PRUEBAS LOCALES DEL NODO, EN VERDE (20-07).** Antes había 3 «no concluyentes» y 2 que reventaban. Cuatro **bugs de producción** encontrados por el camino, todos del tipo «no da ningún error»: **(1)** `arrancar-nodo.ps1 -Parar` tenía el `-ErrorAction` en **Get-Process** en vez de en `Stop-Process`: con `ErrorActionPreference='Stop'`, un «Acceso denegado» lanzaba excepción y **mataba el script a medias** — no paraba GoTrue ni Postgres y **el desinstalador se iba dejando medio nodo vivo**. De ahí que al reinstalar sobrevivieran servicios con el **secreto JWT viejo** y PostgREST devolviera 401 a todo. Ahora además VERIFICA los puertos y avisa en rojo + `exit 1`. **(2)** `gateway.mjs` hacía `res.writeHead(502)` en el manejador de error sin mirar `headersSent`: si el SSE se cortaba a mitad, `ERR_HTTP_HEADERS_SENT` **dentro de un manejador de eventos** = excepción no capturada y **el gateway entero se caía**, dejando al bar sin nodo. Visto en vivo. **(3)** `media.mjs` hacía `break` dentro de un `for await (const t of req)` al pasarse del tope: salir de un for-await **destruye el stream**, y esa conexión es keep-alive que el gateway reutiliza → **la petición SIGUIENTE de ese TPV moría con ECONNRESET** (subes una foto grande, se rechaza bien, y lo siguiente falla). Ahora se drena el cuerpo con tope y se responde. **(4)** `nodo_sync_estado.hasta` era `timestamptz` con cursores compuestos → el catálogo no sincronizaba nada (ver fila de abajo). Y **dos pruebas que MENTÍAN**: `prueba-rls` cantaba «❌ FUGA» cuando en realidad nadie veía nada (401 a todo), y `superficie-lan` daba por bueno «token ajeno → 401» **porque TODO era 401**. Ahora `ayuda.mjs` tiene `exigirNodoVivo()`/`noConcluyente()` (exit 2 ≠ fallo real) y el principio: **si el caso legítimo no funciona, los resultados negativos no prueban nada**. Arreglados también dos andamiajes: `barDePrueba` no enlazaba `app_user.auth_user_id` (→ `operario_permite` fail-closed denegaba escribir en el propio bar: parecía fallo de RLS y no lo era) y `prueba-auth-sin-gotrue` le **cambiaba la contraseña a un usuario cualquiera** del nodo. ⚠ Arranca el nodo desde consola NORMAL: elevado, ningún script sin privilegios puede reiniciar servicios. | `supabase/nodo/arrancar-nodo.ps1`, `apps/nodo/{gateway,media}.mjs`, `apps/nodo/pruebas/*` |
| Claude (chat) | **Sincronización nodo↔nube ARREGLADA y verificada con datos reales (20-07).** Tres fallos encadenados, ninguno daba error donde se mira: **(1)** `nodo_sync_estado.hasta` era `timestamptz` pero desde los **cursores compuestos (0120)** la marca es `{"t":fecha,"k":[pk]}` → **cada checkpoint del catálogo moría** y el pase acababa diciendo «Listo» con **0 bajadas / 0 subidas**: la carta simplemente no viajaba. Arreglado con alter idempotente en `supabase/nodo/04_sync_nodo.sql` (los nodos ya instalados se quedaron con la columna vieja). **(2)** `sincronizar.mjs` resolvía el bar con `select id from tenant limit 1` — **sin ORDER BY**: con dos tenants podía sincronizar **la PLANTILLA de producción**. Ahora manda `NODO_TENANT` y si no está es **fail-closed** (plantilla excluida; con más de un candidato, para). TRAMPAS §14. **(3)** Drift real nodo vs nube: **solo faltaba `combinable`** (0126) en `product` y `family` → el catálogo bajaba filas con esa columna y reventaba. **0126 aplicada al nodo**; contrastadas todas las columnas de product/family/category/location/app_user/payment_method: ahora idénticas. ✅ `prueba-catalogo` **verde entera** (baja, quieto, sube, borra, y lo creado en el bar no se borra solo). ✅ Ciclo completo con datos reales: el «Restaurante de pruebas» sube a la nube (**72 productos, 8 familias, 13 categorías, 3 ventas, 3 facturas**) **sin tocar la plantilla** (75/4/13 antes y después). ⚠ Ojo: el nodo NO crea empresas en la nube (por diseño) — el bar debe existir allí primero o el sync rebota con FK. ⚠ NO ejecutar `scripts/verificar-migraciones-nodo.mjs`: hace `DROP SCHEMA` sobre el nodo. | `supabase/nodo/04_sync_nodo.sql`, `apps/nodo/sincronizar.mjs`, `apps/nodo/pruebas/*` |
| Claude (chat) | **Banco de pruebas: «Restaurante de pruebas» en el nodo — HECHO (20-07).** ⚠ **Aviso gordo**: el nodo de esta máquina estaba atado al tenant **«Plantilla base»**, que es **el que la nube CLONA en cada empresa nueva** — meterle una carta de prueba contamina a todos los bares futuros. Importé 72 productos ahí por error, lo detecté antes de sincronizar y **lo dejé a 0 otra vez**; la nube quedó intacta (75 productos, 0 míos). `nodo_instancia` y `nodo_sync_estado` están **vacías** (el sync nunca ha corrido en esta máquina). **No uses nunca el tenant plantilla como banco de pruebas.** Ahora hay `scripts/sembrar-restaurante.mjs`: crea un tenant APARTE completo (empresa + local + 4 operarios con PIN + formas de pago por la RPC real + 72 productos), idempotente y con `--rehacer`. La dirección es canaria a propósito (CP 38002) para que **el territorio se DEDUZCA** y las pruebas salgan con **IGIC**: verificado 7 % GENERAL / 3 % REDUCIDO con la base desglosada hacia atrás. `verificar-empresa.mjs` da «Lista para operar» y `prueba-facturas-a-la-vez` pasa contra él (6 cobros, correlativos, cadena de huellas sin bifurcar). Tenant: `4c792677-c66b-4af8-bd3f-8c2e32031db8`. | `scripts/sembrar-restaurante.mjs`, `scripts/plantillas/carta-restaurante.csv` |
| Claude (chat) | **Importador de CARTA por CSV — HECHO (20-07).** Dar de alta un bar real dejaba de ser viable a mano (una carta de 200 productos = horas de formulario). `scripts/importar-catalogo.mjs` lee el CSV que exporta cualquier TPV del mercado (Ágora/Glop/Revo/SumUp…) y crea **familias → categorías → productos**. Detecta el separador solo (`;` `,` tab `|`), aguanta comillas con el separador dentro, cabeceras con acentos y **sinónimos** (`PVP`/`precio`, `Artículo`/`producto`, `Categoría`/`subfamilia`…), y precios en formato ES (`1.234,56`) y EN (`1,234.56`). El **% de impuesto NO se importa**: se guarda `clase_fiscal` (GENERAL/REDUCIDO/SUPERREDUCIDO/EXENTO) y el porcentaje lo pone la BD con `resolver_iva(clase, territorio)` → **el IGIC canario sale solo** y no se puede desincronizar de `tax_rate`. **Idempotente** (2º pase: 0 cambios, como `prueba-catalogo`), **transaccional** y en **SIMULACIÓN por defecto** (escribe solo con `--aplicar`). Guarda de **REGLA Nº1**: si `DIRECT_URL` es local y el puerto no es 55432, aborta (no toca el Postgres del sistema). Autotest sin BD: `node scripts/importar-catalogo.mjs --autotest`. Plantilla para rellenar: `scripts/plantillas/carta-ejemplo.csv`. ⚠ Pendiente: probarlo contra un tenant real (hasta ahora solo parser + plantilla verificados). | `scripts/importar-catalogo.mjs`, `scripts/plantillas/carta-ejemplo.csv` |
| Claude (chat) | **SPA TPV (19-07): contraste del Inicio ARREGLADO + Configuración con mapa real — HECHO.** Contraste: `--color-muted` estaba **redefinido dos veces** en `@theme inline` (la 2ª, de `7d0afd7`, lo convertía en lavado al 10%) → los 63 `text-muted` de la SPA casi invisibles en claro Y oscuro. Quitada la redefinición (aviso en el propio `index.css`); el único `bg-muted` (badge P: del Ticket) pasa a `bg-surface-muted`. ⚠ El fix viajó en el commit `2f135a3` del escritorio (working tree compartido). **Configuración (F2) v2 tras análisis de huecos contra el panel Next**: el mapa pasa a **8 dominios × 26 secciones** — se añadieron los que faltaban: **Marca** (personalizar: logo/colores/ofertas; el propio index.css promete presets desde Configuración), **Terminales** y **Módulos y pantallas** (de `/modulos` + `tpv/config/terminales`), **Puntos de venta**, **Periodos de servicio**, **Etiquetas** de impresión (`plantilla_etiqueta`), y los settings sueltos de `/ajustes` que son del TPV (orden de funciones → Botones; categoría de combinados → Familias; `etiqueta_producto` → Productos). Diseño pro: **buscador** (título+desc+alcance, sin acentos; Esc limpia antes de salir), **vista general** por dominios (portada con tarjetas), **badge de estado** por sección («Funciona en este terminal» / «Hoy, en el panel web»); «Preferencias» funcional (tema del terminal). Reparto del hub: empresa/local/territorio, seguridad (bloqueo TPV), clientes → Administrador; zona técnica → Visor Node; proveedores/almacenes → Compras (placeholder también en Next). Build+typecheck verdes. **Credencial REAL (19-07)**: `acceso/operarios.ts` habla el contrato del nodo (`listar_operarios` 0024 + `validar_pin` 0007/0054 vía gateway, con la sesión de dispositivo en `localStorage[gluuh_sesion_dispositivo]` que escribirá el emparejado F4; entonces pasar a `validar_pin_terminal` 0117 con device_id). Sin sesión → equipo demo MARCADO («Equipo de ejemplo — terminal sin emparejar») y pulsera solo simulada en demo (sin lector real no hay botón: era una puerta abierta). Modal de **UNA vista táctil** (la gente a la izquierda + teclado del PIN a la derecha a la vez, sin pasos; elegir persona es opcional y se des-elige tocando; 2xl). ⚠ `CabeceraModal` gana `tono="suave"` (cabecera neutra con línea inferior, para puertas/modales frecuentes donde la banda morada cansa; por defecto sigue "marca" y el resto de modales NO cambia). Alineado v3: **puntos del PIN en la misma fila que el rótulo** (así las teclas arrancan al nivel de las tarjetas, no empujadas por los puntos), **fichas de gente COMPACTAS de alto fijo** (`h-16`) en lista con scroll (10+ personas se desplazan, no deforman), y **pulsera como pie a todo el ancho** (no descuadra las columnas); el error se muestra en el rótulo del PIN (sin línea extra). **v4**: quitado el `pt-3` que aún dejaba las teclas 12px por debajo de las tarjetas (ahora ambos cuerpos arrancan a ras del rótulo, a la misma altura), y la **placa del icono va en el color del apartado con icono blanco** — `CabeceraModal` gana un prop `color` (opcional; sin él, tono por defecto, el resto de modales no cambia). **v5: `modo` con 3 presentaciones** (prop de `CredencialModal`, lógica compartida): `"pin"` (solo teclado; también el fallback sin lista de gente), `"lado"` (gente+teclado a la vez, el diseño de v4, se conserva) y `"pasos"` (gente primero; al pulsar un trabajador aparece el teclado centrado con su avatar+nombre y «Cambiar de trabajador», en modal de **tamaño fijo** `h-136`×`sm` que no salta). App usa `"pasos"`; a futuro puede ser un ajuste del terminal. ⚠ De paso, arreglado un typecheck roto ajeno: `CobrarModal.tsx` (commit escritorio `68f4540`) tenía `useState(tiposDoc[0]!)` que infería el literal de un `as const` y rompía el `onChange` → ensanchado a `useState<string>`, quien no llega al rol de la puerta sale atenuado con candado, `cumpleRol` en nav.ts (admin ≥ técnico ≥ trabajador; PROPIETARIO/ENCARGADO→admin, CAMARERO/COCINA→operario). ⚠ `.git/objects/1a` quedó con ACL DENY de una sesión Codex (`CodexSandboxUsers`): si git da «Permission denied» ahí, ejecutar fuera del sandbox o `icacls .git\objects\1a /reset`. | `apps/tpv/src/{index.css, apartados/config/*, apartados/inicio/Inicio.tsx, apartados/tpv/venta/Ticket.tsx}` |
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
   *(19-07: la SPA `apps/tpv` ya imprime DE PRUEBA — ticket de cliente al cobrar (F10/F11) y
   comanda al marchar (parcial, solo lo nuevo, por estación). En navegador cae a **PDF con
   logo de Gluuh** (`apps/tpv/src/lib/impresion.ts`, jspdf); en Electron irá por la térmica.
   Falta la config real de impresoras + `print_route` por zona.)*
   **Formas de pago y división** analizadas → `docs/plan/formas-de-pago-y-division.md`
   (pago múltiple, `payment_method`, los 3 modos de división, y las decisiones abiertas).
3. **Envío a la AEAT desde la nube.** El nodo ya le manda la factura, su desglose y su huella
   (`prueba-sync-fiscal.mjs` lo demuestra). Falta que la nube las remita.
4. **Un nodo por LOCAL, no por empresa.** Hoy `provisionar.mjs` se baja el `tenant` entero.
   Una cadena con tres bares necesita tres nodos, cada uno con lo suyo.
5. **Cuenta de servicio por bar** (en vez de reusar la cuenta del titular).
6. **Condiciones de uso** — el instalador va **sin página de licencia a propósito**: una
   licencia inventada que el cliente ACEPTA es peor que no tener ninguna.

---

## 🔢 Migraciones

**Siguiente número libre: `0133`.**

- `0132` — **RESERVADA 20-07 (sesión chat, precios de Ágora: añadido y menú)**:
  `precio_anadido_y_suplemento_menu` — cierra el triángulo que hace que
  `product.es_anadido` deje de ser un flag muerto. En Ágora un artículo **no es**
  un menú: lo que tiene es **Supl. Menú** (lo que suma si entra en un menú) y
  **Precio Añadido** (lo que cuesta vendido como extra de otro), **los dos por
  tarifa** (`docs/referencia/09-…/productos/producto.md` §8). Y un extra ES un
  producto, no un texto: por eso `modifier.product_ref_id`. Añade
  `product_price.precio_anadido`, `product_price.suplemento_menu` y
  `modifier.product_ref_id`. Con eso, elegir «extra de queso» en una pizza suma
  el precio añadido del producto queso y hereda su clase fiscal, en vez de un
  número tecleado a mano que no cuadra con nada.

- `0131` — **RESERVADA 20-07 (sesión chat, tarifas que SÍ se cobran)**:
  `tarifa_por_sala` — hasta ahora `product_price` tenía **75 precios de tarifa
  guardados que no ha cobrado nadie nunca**: `valorar_linea_pedido` (0053)
  valoraba SIEMPRE con `product.precio`. Y la tarifa solo se podía asignar a un
  cliente (`customer.tarifa_id`, 0 filas), así que el «precio de terraza» —que
  es lo que pide un bar— no tenía forma de expresarse. Añade `room.tarifa_id`
  (la sala elige tarifa) y hace que la valoración use `product_price` **con
  vuelta atrás a `product.precio`**: sin precio de tarifa se cobra el de
  siempre, nunca 0 ni null. ⚠️ Ruta del dinero: probado sobre el nodo con
  pedidos reales en transacción.

- `0130` — **RESERVADA 20-07 (sesión chat, compras desde el TPV)**:
  `compras_y_stock` — lo que falta para poder **gestionar compras**, no solo
  anotar entradas. Hoy `stock_move` es un apunte suelto (`ingredient_id, tipo,
  cantidad, motivo`) sin albarán, sin proveedor, sin precio y sin fecha de
  factura; y las 5 tablas del módulo (`ingredient`, `recipe_item`, `stock_move`,
  `warehouse`, `supplier`, `unit_of_measure`) están **a cero y sin pantalla**.
  Añade, todo aditivo: `purchase_doc` (albarán/factura: proveedor, fecha, número,
  estado, totales) y `purchase_line` (qué, cuánto, a qué precio, qué impuesto),
  con la línea apuntando **a un artículo O a un ingrediente** — un bar compra
  cajas de cerveza (que se venden tal cual) *y* kilos de tomate (que se
  transforman), y obligar a inventarse un ingrediente por cada referencia de
  vino es papeleo inútil. Más `product.stock`/`stock_minimo` (stock por artículo,
  que hoy no existe) y `stock_move.purchase_line_id`/`product_id`/`warehouse_id`
  para poder trazar de dónde salió cada entrada. Ver `docs/plan/17`.

- `0129` — **RESERVADA 20-07 (sesión chat, columnas de la lista estilo Glop)**:
  `producto_carta_digital` — separa **ECOM** (pedidos por internet) de
  **C_DIGITAL** (la carta por QR de la mesa), que en Glop son dos casillas
  distintas y aquí estaban fundidas en `ecommerce`. Aditiva: `product.carta_digital`,
  y se **arranca copiando** `ecommerce` para que ningún artículo que ya salía en
  la carta QR desaparezca de ella al desplegar.

- `0128` — **RESERVADA 20-07 (sesión chat, ficha de artículo del TPV nuevo)**:
  `articulo_aspecto_y_parametros` — cierra el hueco entre la ficha de artículo de
  `apps/tpv` (estilo Glop) y el esquema real. **Todo aditivo, `if not exists`.**
  · `product.color` / `product.icono` — aspecto del botón en la botonera (icono
  guarda el NOMBRE lucide, misma convención que `category.icono` de `0060`).
  · Seis parámetros que la ficha ya pinta y no tenían dónde guardarse:
  `controla_stock`, `no_imprimir_si_cero`, `descripcion_libre`, `preguntar_precio`,
  `ecommerce`, `es_menu_del_dia`.
  · `product_format.coste` y `.raciones` — margen y escandallo por formato.
  ⚠️ **Las TARIFAS (precio por sala: barra/salón/terraza) NO entran aquí**: la
  ficha las enseña pero el modelo bueno es una tabla `tarifa`, no tres columnas
  con las salas incrustadas. Queda decidido a propósito y **avisado en pantalla**
  para que nadie teclee un precio de terraza creyendo que se guarda.

- `0127` — **RESERVADA 20-07 (sesión chat, limpieza de modelos duplicados)**:
  `retirar_stubs_alergenos_y_plantilla_ticket` — retira 4 stubs del CRUD genérico
  que nunca se usaron y que competían con el modelo real: `product_allergen`,
  `allergen`, `alergeno` (los alérgenos viven en `product.alergenos[]`, **110
  productos** los usan) y `plantilla_ticket` (el diseño del ticket vive en
  `setting` clave `impresion.config.ticket`). Las 4 con **0 filas** verificadas y
  sin referencias, salvo `plantilla_ticket` en la consola de plataforma (grupo
  "tickets" del alta y contador de la plantilla), que se retira en el mismo commit.
  ⚠️ **`printer`/`print_route`/`print_job` NO se tocan**: no son stubs, son la
  impresión compartida de `0079` con código vivo (`print-routing.ts`,
  `PrintDispatcher`); están vacías solo porque ningún bar las ha configurado aún.

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
