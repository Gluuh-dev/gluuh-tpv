# Planes de implementación

Índice generado por la skill `improve`. Tres tandas:

- **001–009** — auditoría del 2026-06-15 (commit `09857da`). Todas DONE; notas abajo.
- **010–015** — auditoría del 2026-07-11 (commit `9c959d1` + árbol de trabajo),
  motivada por: *"el TPV no va todo lo fluido que debería"*. Foco: fluidez de
  `apps/web/app/tpv` + bugs del camino del dinero encontrados por el camino.
  Selección hecha en modo autónomo: los 6 hallazgos con más palanca
  (impacto ÷ esfuerzo, ponderado por confianza); el resto queda documentado en
  las secciones de abajo para no re-auditar.
- **016–026** — auditoría integral del 2026-07-17, planificada sobre `4d11ee5`.
  Selección: todos los hallazgos confirmados con impacto de seguridad, dinero,
  fiscalidad, pérdida de datos, operación o coste estructural. No aplica cambios:
  esta tanda es el mapa ejecutable de reparación.

Cada ejecutor: lee el plan completo antes de empezar, respeta sus "Condiciones
de STOP" y actualiza tu fila al terminar.

## Orden de ejecución y estado — tanda 2026-07-17

| Plan | Título | Prioridad | Esfuerzo | Depende de | Estado |
|------|--------|-----------|----------|------------|--------|
| 016 | Verificar esquema vivo y activar tipos Supabase | P0 | M | — | TODO |
| 017 | Cerrar RPC privilegiadas y contexto tenant | P0 | M | 016 | TODO |
| 018 | Convertir RBAC/panel a fail-closed | P0 | M–L | 016; coordinar 017 | TODO |
| 019 | Venta atómica, idempotente y server-authoritative | P0 | L | 016, 018 | TODO |
| 023 | Cerrar superficie LAN, diagnósticos y media | P0 | M–L | 017 | TODO |
| 020 | Emisión fiscal, huella y outbox AEAT | P0 | L | 019 | TODO |
| 021 | Reparar sync, cursores y falso ACK | P0 | L | 016, 019 | TODO |
| 024 | Identidad de dispositivo y mínimo IPC | P0 | L | 017, 018, 023 | TODO |
| 022 | Provisionado, updater y cola de impresión durables | P1 | L | 021 | TODO |
| 025 | Gates CI y pruebas adversariales | P1 | M–L | 017, 018, 019, 021, 023 | TODO |
| 026 | Coste del panel y deuda estructural | P2 | L | 019, 020, 025 | TODO |

### Ruta crítica y paralelismo seguro

- Ruta principal: **016 → 017 → 018 → 019 → 020**. Es la secuencia que pasa de
  verdad del esquema a identidad, autorización, dinero y finalmente fiscalidad.
- Tras 017 puede arrancar 023 en paralelo con 018, siempre que no editen la misma
  migración de credenciales. 024 espera a que ambas fronteras queden definidas.
- Tras 019, 020 y 021 pueden desarrollarse en paralelo: 020 es fiscal; 021 es
  transporte/sync. 022 espera al protocolo de 021.
- 025 empieza preparando harness/baseline, pero no se marca DONE hasta incorporar
  las regresiones de sus dependencias. 026 es deliberadamente el último.
- Cada ejecución crea rama `codex/NNN-slug`, reserva migración en `AHORA.md` cuando
  corresponda y comprueba rutas sucias antes de tocar nada.

### Reconciliación con planes y decisiones anteriores

- El plan 013 resolvió sustitución atómica de líneas en una **cuenta existente**.
  El 019 no lo duplica: cubre alta nueva, pagos, autoridad de precios y cierre de
  escrituras directas, que siguen fuera de aquella RPC.
- La antigua conclusión genérica “RLS floja” continúa rechazada. 017/018 se apoyan
  en fallos específicos verificados: funciones `SECURITY DEFINER`, grants y defaults
  permisivos; no proponen rehacer toda la RLS.
- El `/sync/upload` stub ya figuraba como dirección pendiente. 021 lo convierte en
  una decisión verificable: implementación durable o 501; nunca ACK ficticio.
- `apps/api/db/schema.sql` no se sincroniza. La fuente canónica sigue siendo
  `supabase/migrations`; 016 contrasta contra la BD viva y tipos generados.
- Los cambios visuales/TPV ya presentes en el working tree pertenecen al usuario.
  019 y 026 incluyen STOP para no mezclarlos.

### Hallazgos considerados y no convertidos en reparación

- Cleanup de Realtime: los subscriptions revisados sí devuelven cleanup; no se
  confirmó fuga genérica.
- “Todas las tablas carecen de RLS”: falso; el problema confirmado es puntual.
- Mantener un espejo manual en `apps/api/db/schema.sql`: rechazado por decisión
  vigente del repositorio.
- Migración masiva del panel a Server Components o activar React Compiler: sin
  medición y con demasiado alcance; 026 exige perfil antes de decidir.
- PowerSync como solución obligatoria: no consta activo. 021 exige primero elegir
  un write-path y deshabilitar cualquier falso éxito.

### Condición global de despliegue

Ningún plan puede escribir en otra base: solo Supabase `gxcqihslbicrszgzudjs` y
el Postgres del nodo `.nodo/pgdata`, puerto **55432**, base **gluuh**. Los planes
016 y preflights usan MCP en lectura; toda migración requiere reserva y revisión.

## Orden de ejecución y estado — tanda 2026-07-11

| Plan | Título | Prioridad | Esfuerzo | Depende de | Estado |
|------|--------|-----------|----------|------------|--------|
| 013 | Blindar el camino del dinero (cobro sin crash, sin doble pago, líneas atómicas) | P1 | M | — | DONE (11-07, aplicado en working tree sin commit; **migración 0094 pendiente de aplicar en Supabase**) |
| 010 | Índice O(1) del catálogo + memoizar derivadas de la comanda | P1 | S | — | DONE (11-07, working tree; 0 escaneos lineales) |
| 011 | Cortar los re-renders por pulsación (buffer fuera de la raíz + memo) | P1 | M | 010 | DONE (11-07, working tree; typecheck+tests verdes) |
| 012 | Arranque del TPV y carga de mesas en paralelo | P1 | S-M | — | DONE (11-07, working tree; 1 Promise.all de 8 + mesas/elementos en paralelo + finally anti-cuelgue) |
| 015 | Tests del camino del dinero (precio.ts puro + vitest en web) | P2 | M | 010 | DONE (11-07, working tree; 17 tests, `pnpm test` cubre web) |
| 014 | Miniaturas de fotos de producto + carga perezosa | P2 | M | — | DONE (11-07, working tree; resize al subir + lazy en tiles/kiosko/ofertas; fotos antiguas sin backfill) |

**Ejecutados el 2026-07-11 en el árbol de trabajo (sin commits) a petición del usuario
("haz todos los cambios"). Verificación: `pnpm typecheck` 12/12, `pnpm test` core 44 +
web 17 en verde. Pendiente del operador: aplicar `supabase/migrations/0094_reemplazar_lineas_orden.sql`
al proyecto Supabase (el TPV degrada al camino antiguo mientras tanto) y el humo manual
en el TPV real (teclear/cobrar/dividir/traspasar).**

### Notas de dependencia (tanda 2)

- **013 primero**: es el único que arregla bugs (un fallo de `/api/ticket` hoy
  deja la venta COBRADA y rompe la pantalla). Además toca `cobrar`/`crearOrden`
  en `page.tsx`, igual que 010/011 — ejecutar 013, 010 y 011 **en serie** (mismo
  fichero), nunca en paralelo.
- **011 requiere 010**: la memoización asume lookups O(1) (`prodPorId`).
- **015 requiere 010**: el módulo extraído `precio.ts` recibe `prodPorId`.
- 012 y 014 son independientes y pueden intercalarse en cualquier momento.
- La suma esperada de 010+011+012 es la respuesta directa al "no va fluido":
  teclear deja de re-renderizar la página entera, cada render deja de escanear
  el catálogo por línea, y el arranque pasa de ~11 round-trips en escalera a 2-3 olas.

## Quick wins sin plan (una línea cada uno; hacer cuando convenga)

- `pnpm --filter @gluuh/web remove @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot shadcn`
  — verificado: cero imports de `@radix-ui/*` (el código usa el paquete `radix-ui`
  monolítico) y `shadcn` es una CLI, no runtime.
- `.env.example`: renombrar `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`
  (es la variable que lee el código, 7 rutas API) y documentar `DEVICE_JWT_SECRET`,
  `PLATAFORMA_HOSTS`, `GLUUH_URL`, `AEAT_CERT_PFX`.
- Verificar la procedencia de `lucide-react@1.18.0` (el paquete oficial versionaba
  0.x): `npm view lucide-react versions`. Si es legítima, nada; si no, fijar la oficial.
- `apps/web/app/(panel)/layout.tsx:39-42`: `tenant` y `app_user` en un
  `Promise.all` (hoy en serie) — quita un round-trip a TODO el backoffice.
- Sustituir los 2 usos de `@tabler/icons-react` en `components/ui/{select,dialog}.tsx`
  por equivalentes lucide y evaluar quitar la dependencia (quedan `IconGift` en
  `tpv/page.tsx` y `TileCategoria` — 4 ficheros en total).

## Hallazgos documentados SIN plan (decisión del responsable / siguiente tanda)

**Seguridad — bloqueantes ANTES de producción/exponer la API** (hoy VERIFACTU
está desactivado por decisión 06-07-2026 y `apps/api` no está desplegada):

- `apps/api` `/fiscal/*` sin guard de auth ni `ValidationPipe`, y `enableCors()`
  abierto (`apps/api/src/fiscal/fiscal.controller.ts:26-39`, `main.ts:6-7`).
  `/fiscal/enviar` remite a la AEAT con el certificado mTLS de la empresa.
  **No exponer esa API sin cerrar esto.**
- Permisos de operario solo en cliente y fail-open (`tpv/page.tsx:232-234`,
  fetch sin rama de error en 609-617): descuentos/precio manual/borrados se
  autorizan en el navegador. Cierre real = límites en servidor (RPC), junto con:
- Precios/total escritos por el navegador (techo CONOCIDO y documentado en
  `apps/web/app/api/factura/route.ts:117-124`): el cierre es la RPC de pedido
  con precios de servidor, ligada a activar VERIFACTU.
- `/api/ticket` en modo PERMISIVO (documentado en `route.ts:19-25`): enviar el
  Bearer desde `cobrar()` y poner `PERMISIVO=false` cuando se toque ese flujo.

**Corrección — deferidos con el mismo patrón que el plan 013**:

- `dividirAceptar` (page.tsx:1312-1362): inserts sin comprobar; una porción de la
  cuenta puede perderse en silencio al dividir.
- `ejecutarTraspaso` (page.tsx:1101-1137): mueve unidades claveadas por
  `product_id` cuando la UI selecciona por clave de línea (formatos/modificadores
  traspasan mal), y sin transacción.

**Rendimiento — siguiente tanda si el TPV sigue sin ir fino tras 010-014**:

- Realtime recarga el catálogo COMPLETO (9 queries) ante cualquier cambio de
  product/category/family (page.tsx:338-348 + catalogo-store.cargar), y un
  "agotado" local dispara refetch local + realtime (doble). Fix: aplicar el
  payload por fila al store. (Tras 010/011 el re-render derivado ya es barato.)
- Sin code-splitting (`next/dynamic`): modales + `PlanoSalas` hidratan de golpe.
  Medir con bundle-analyzer antes de trocear.
- `PlanoSvg` inyecta un SVG inline (fetch + innerHTML) por CADA mesa; el resize
  del editor hace `setState` por pointermove (`PlanoSalas.tsx:800-812`). Modo
  edición, no ruta caliente del camarero.
- Backoffice: `(panel)/layout.tsx` 100 % cliente con cascada de auth (3 RTT en
  serie) + ~51 páginas con fetch en `useEffect`. El fix de fondo (sesión en
  cookies con `@supabase/ssr` + Server Components) es L y toca el modelo de
  sesión entero — planificar como migración propia cuando el panel duela.
- React Compiler (`reactCompiler`) no activado: probarlo DESPUÉS de 011 para no
  enmascarar la causa raíz; requiere QA de las 56 páginas cliente.

**Deuda/DX — documentados, valen su plan cuando toquen esa zona**:

- `eur()` re-implementado en ~36 ficheros con TRES formatos distintos
  (`1234.50 €` vs `1234,50 €` vs `1.234,50 €` — solo dashboard usa es-ES bien).
  Unificar en `app/lib/money.ts` con `Intl.NumberFormat("es-ES")`; es cambio
  visual masivo → decisión del responsable.
- `apps/api/db/schema.sql` desfasado como espejo (faltan `menu*`, `discount`,
  `tax_rate`, `plano_elemento`…). CLAUDE.md pide "decide cuál es canónico":
  recomendación = declarar `supabase/migrations` canónico y regenerar el espejo
  con `pg_dump --schema-only` o borrarlo.
- Lint inexistente de facto: `next lint` se eliminó en Next 16 y no hay config
  ESLint en el repo; 8 paquetes tienen `"lint": "echo (lint pendiente)"`. Montar
  flat-config + typescript-eslint + paso de CI.
- Carga de catálogo re-implementada en kiosko/comandera (con filtro `agotado_hasta`
  en query; el TPV lo filtra en cliente con el badge 86 — intencional). Unificar
  sobre `catalogo-store` cuando se toque el kiosko.
- Plano implementado dos veces (PlanoSalas TPV 1817 líneas vs editor del panel
  451): extraer un lienzo común es L y con riesgo visual; para después de la
  tanda de fluidez.
- `packages/ui` y `packages/api-client` son placeholders sin importadores
  (`@gluuh/ui` figura como dependencia de web sin usarse); decidir rellenar o borrar.
- Sin pre-commit hooks; `packages/ui` con typecheck stub.
- `page.tsx` (2755 líneas) god component: los planes 010/011/015 ya extraen
  índice+precio y reducen la superficie; seguir extrayendo módulos puros ANTES
  de plantear trocear el componente.

## Hallazgos considerados y RECHAZADOS en la tanda 2026-07-11 (no re-auditar)

- **"El TPV muestra agotados y kiosko no — divergencia"**: intencional. El TPV
  enseña el producto agotado con badge "86" y bloquea el click (`estaAgotado`,
  page.tsx:1535); el kiosko lo oculta en query. Comportamiento correcto de cada canal.
- **"`setSobrePapel` re-renderiza el plano en cada pointermove"**: matizado.
  React descarta el set con valor idéntico; solo re-renderiza al cruzar el umbral
  de la papelera. El `setDimOverride` del RESIZE sí re-renderiza por movimiento
  (queda anotado arriba, modo edición).
- **"jspdf infla el bundle"**: falso — ya se importa dinámicamente (`impresion.ts:275`).
- **"Providers en el layout raíz fuerzan client-render global"**: falso —
  reciben `children` de un layout servidor.
- **"globals.css costoso"**: 132 líneas; el selector universal es el patrón shadcn. Nada.
- **"PIN comparado en cliente"**: desmentido — `validar_pin` es SECURITY DEFINER
  con bcrypt en servidor (`0007_validar_pin.sql`), tenant-scoped.
- **"RLS floja"**: al contrario — aislamiento por tenant aplicado en bucle a
  todas las tablas (0001) + `set_tenant_id` (0004); los únicos `USING(true)` son
  formulario de contacto y tarifas públicas, por diseño.
- **"typescript 6 / vitest 4 sospechosos"**: sin evidencia de problema (ya
  rechazado en la tanda 1); solo queda el quick-win de verificar `lucide-react@1.18.0`.
- **"turbo.json mal cacheado"**: outputs correctos; no hallazgo.

## Hallazgos de dirección (sin cambios desde la tanda 1)

- Write-path de sync (`/sync/upload`) sigue siendo stub — bloqueante nº 1 del
  modo offline-first (decisión "nodo local estándar", 07-07).
- TicketBAI (País Vasco) prometido sin código.
- Impresión ESC/POS real y pagos (Stripe/Redsys/Bizum) son esqueletos.

## Qué NO se auditó a fondo en la tanda 2026-07-11

`apps/desktop` y `apps/mobile` (esqueletos), `packages/{sync,hardware,api-client,ui}`
(solo inventariados), el algoritmo VERIFACTU de `packages/core` (tiene el vector
oficial AEAT como red), el contenido de `docs/`, y no se midió el bundle real
(los hallazgos de tamaño son estáticos, no de analyzer). El backoffice `(panel)`
se auditó a profundidad media (no página a página).

---

## Tanda 2026-06-15 (histórico) — orden y estado

| Plan | Título | Prioridad | Esfuerzo | Depende de | Estado |
|------|--------|-----------|----------|------------|--------|
| 001 | Tests de impuestos y máquina de estados | P1 | S | — | DONE (revisado; pendiente de merge — ver nota) |
| 002 | Unificar tipos fiscales (clase × territorio) en core | P1 | M | 001 | DONE (revisado; en rama de consolidación) |
| 003 | Quick wins: puerto del README + encoding del QR | P3 | S | — | DONE (puerto sí; QR no aplicado — ver nota) |
| 004 | CLAUDE.md + CI (build/typecheck/test) | P2 | M | — | DONE (revisado; en rama de consolidación) |
| 005 | Sistema de diseño: token de acento + primitivos + DESIGN.md | P1 | M | — | DONE (revisado; en rama de consolidación) |
| 006 | Rediseño pantallas operativas + públicas | P1 | L | 005 | DONE (revisado; en rama de consolidación) |
| 007 | Pulido backoffice contra el sistema | P2 | M | 005 | DONE (revisado; en rama de consolidación) |
| 008 | TPV estilo Ágora (layout + teclado + acciones) | P1 | L | 005 | DONE (mergeado en main `8b109f2`) |
| 009 | Navegación del panel con submenús expandibles | P1 | M | 005 | DONE (mergeado en main `79d60a2`) |

Valores de estado: TODO | IN PROGRESS | DONE | BLOCKED (con motivo) | REJECTED (con motivo).

### Notas de ejecución de la tanda 1 (resumen; detalle en el historial git de este fichero)

- **001**: rama `advisor/001-tests-impuestos-y-estados` (commit `f5d8a36`), 18 tests
  nuevos verdes; pendiente de merge por decisión del usuario.
- **002/003/004**: worktrees revisados; 002 behavior-preserving; 003 dejó el QR
  intacto a propósito (reproduce el vector AEAT); 004 añadió CLAUDE.md + CI.
- **005/006/007**: sistema de diseño (`--brand`), 10 pantallas operativas y 7 del
  panel migradas a tokens. Consolidación verificada en `advisor/all-001-004`
  (HEAD `590b4a3`): core 38 tests + builds verdes. **Pendiente de merge a `main`.**
- Hallazgo preexistente al verificar: `pnpm --filter @gluuh/web build` requiere
  `NEXT_PUBLIC_SUPABASE_URL` en el entorno (el CI del plan 004 fallará sin ese
  secret). Sigue vigente.

### Rechazados en la tanda 1 (siguen vigentes)

- "Secretos commiteados en .env": FALSO — solo `.env.example` está en git.
- "IDOR en bucket media": sobredimensionado (lectura pública por diseño; matiz
  menor: `media_update` sin `WITH CHECK`).
- "Memory leak en realtime de cocina": rechazado (cleanup correcto).
- "N+1/refetch total tras cada mutación": rechazado ENTONCES por escala…
  **reabierto en la tanda 2** con evidencia nueva (reporte del usuario + TPV de
  2755 líneas): ahora está cubierto por los planes 010-012 y el hallazgo de
  realtime de la sección "siguiente tanda".
