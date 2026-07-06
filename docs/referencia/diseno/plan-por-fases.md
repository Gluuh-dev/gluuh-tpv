# Plan de implementación por fases — Gluuh TPV (igualar y superar a Ágora)

> Documento **construible** y unificado: funde la **referencia** del configurador Ágora
> ([`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/)) con nuestras
> **mejoras** ([`../mejoras/`](../mejoras/)) en un plan de ejecución por fases **F0–F8**, ajustado al
> **estado real del repo**. Es consistente con el [roadmap 08](../08-roadmap-de-implementacion/) (mismas
> fases y módulos) y lo aterriza al "cómo se construye", priorizando el **camino crítico de venta legal**.
>
> Estado de partida real: `apps/web` (Next.js 16) muy avanzada (TPV, comandera, kiosko, cocina, kds,
> backoffice con 11 informes reales y Visor VERIFACTU); `@gluuh/core` con motor fiscal **probado contra el
> vector oficial AEAT**; `apps/api` (NestJS), `packages/sync` (PowerSync) y móvil/escritorio en **esqueleto**.

---

## 0. Principios rectores (no negociables)

1. **Vendible y legal antes que bonito.** El eje es venta → cobro → factura VERIFACTU → ticket impreso.
2. **No reinventar el núcleo.** Toda lógica fiscal vive en `@gluuh/core`; las apps importan, no duplican.
   El sync se **compra** (PowerSync), no se construye a mano.
3. **Una base de código React (`apps/web`)** sirve backoffice + TPV + comandera + KDS + carta; Tauri/Expo
   solo envuelven donde hay hardware.
4. **Backend valida toda escritura** (NestJS): RBAC, fiscalidad y numeración legal. Nada "sucio" entra en
   Postgres. La verdad de permisos vive en **RLS**, la UI solo refleja.
5. **Configurable sin migraciones.** Casi todo ajuste es una fila en `setting` (ámbito GLOBAL/LOCAL/DEVICE),
   no una columna nueva por casilla. Ver [mejoras 01](../mejoras/01-diseno-y-experiencia.md).
6. **Offline‑first de serie.** Diseñado desde F0 (dominio como eventos), encendido en F5. El local **nunca**
   se cae: cobra y emite VERIFACTU sin internet.
7. **Usabilidad medible.** "Fácil de usar" es un criterio de aceptación (toques/comanda, tiempo de cobro),
   no una opinión.

---

## 1. Mapa de módulos y diagrama de dependencias

| # | Módulo | Referencia Ágora | Mejora | Estado repo |
|---|--------|------------------|--------|-------------|
| M0 | Plataforma: monorepo, datos, multi‑tenant/RLS, auth/PIN, `setting`, CI | [09 administración](../09-referencia-configurador-agora/) | [mejoras 06](../mejoras/06-fiscalidad-plataforma-informes-y-negocio.md) | 🟢 base sólida |
| M1 | Catálogo: familias/categorías/productos/menús, nombres múltiples | [producto.md](../09-referencia-configurador-agora/productos/producto.md) | [mejoras 02](../mejoras/02-catalogo-carta-y-precios.md) | 🟢 web hecho |
| M2 | Modificadores, alérgenos (14 UE), tarifas/promos | [producto.md](../09-referencia-configurador-agora/productos/producto.md) | [mejoras 02](../mejoras/02-catalogo-carta-y-precios.md) | 🟡 parcial |
| M3 | Impuestos IVA/IGIC/IPSI (motor + tabla `tax_rate`) | [impuestos.md](../09-referencia-configurador-agora/administracion/impuestos.md) | [mejoras 06](../mejoras/06-fiscalidad-plataforma-informes-y-negocio.md) | 🟢 core probado |
| M4 | TPV táctil: sala/plano/mesas, comanda, pases, división | [planos-mesas.md](../09-referencia-configurador-agora/herramientas/planos-mesas.md) | [mejoras 03](../mejoras/03-operativa-tpv-mesas-y-cobro.md) | 🟡 UI avanzada, sin persistencia |
| M5 | Cobro + formas de pago + caja (Z/X) | [formas-de-pago.md](../09-referencia-configurador-agora/administracion/formas-de-pago.md) | [mejoras 03](../mejoras/03-operativa-tpv-mesas-y-cobro.md) | 🟡 caja sí, cobro real no |
| M6 | Impresión y tickets (3 documentos, enrutado, cajón) | [plantillas-ticket.md](../09-referencia-configurador-agora/administracion/plantillas-ticket.md) | [mejoras 04](../mejoras/04-cocina-kds-y-comanderas.md) | 🔴 esqueleto `hardware` |
| M7 | Cocina/KDS + comandera + tiempo real | [monitores-cocina.md](../09-referencia-configurador-agora/cocina/monitores-cocina.md) | [mejoras 04](../mejoras/04-cocina-kds-y-comanderas.md) | 🟡 UI sin backend live |
| M8 | Offline‑first (PowerSync) + serie por terminal | [series.md](../09-referencia-configurador-agora/administracion/series.md) | [mejoras 06](../mejoras/06-fiscalidad-plataforma-informes-y-negocio.md) | 🔴 esqueleto `sync` |
| M9 | Compras/proveedores/inventario/escandallo/mermas + app almacén | [inventario.md](../09-referencia-configurador-agora/) | [mejoras 05](../mejoras/05-compras-e-inventario.md) | 🔴 no existe |
| M10 | Configuración/multi‑local/perfiles/permisos/auditoría | [usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md) | [mejoras 01](../mejoras/01-diseno-y-experiencia.md) | 🟡 ajustes sí, permisos finos no |
| M11 | VERIFACTU completo (persistencia + envío AEAT + certificación) | [verifactu.md](../09-referencia-configurador-agora/herramientas/verifactu.md) | [mejoras 06](../mejoras/06-fiscalidad-plataforma-informes-y-negocio.md) | 🟡 motor + visor, falta envío |
| M12 | Carta digital/online + informes de rentabilidad | [carta-digital.md](../09-referencia-configurador-agora/herramientas/carta-digital.md) · [config-pago-pedidos.md](../09-referencia-configurador-agora/herramientas/config-pago-pedidos.md) | [mejoras 06](../mejoras/06-fiscalidad-plataforma-informes-y-negocio.md) | 🟢 informes base, online 🔴 |

Leyenda: 🟢 hecho/sólido · 🟡 parcial · 🔴 por construir.

```
                         ┌─────────────────────────────┐
                         │  M0 PLATAFORMA / DATOS / RLS │  (cimiento — bloquea todo)
                         │  auth+PIN · setting · CI     │
                         └──────────────┬──────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ M1      │    │ M3       │    │ M10      │    │ M8       │    │ M12      │
   │CATÁLOGO │    │IMPUESTOS │    │CONFIG/   │    │OFFLINE   │    │CARTA ON +│
   │+nombres │    │(core ✓)  │    │PERMISOS  │    │PowerSync │    │INFORMES  │
   └────┬────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └─────┬────┘
        │              │               │              │                │
        ▼              │               │              │                │
   ┌─────────┐         │               │              │                │
   │ M2 MODIF│◄────────┘               │              │      (carta online y rentabilidad
   │ALÉRGENOS│  (precio = base+clase   │              │       cuelgan de venta+escandallo)
   │TARIFAS  │   fiscal × territorio)  │              │                │
   └────┬────┘                         │              │                │
        │                              │              │                │
        └──────────────┬──────────────┘              │                │
                       ▼                              │                │
                 ┌──────────┐                         │                │
                 │ M4 TPV   │─────────────────────────┤ (la comanda    │
                 │ TÁCTIL   │                         │  se sincroniza)│
                 │ +PLANO   │                         │                │
                 └────┬─────┘                         │                │
            ┌─────────┼──────────┐                    │                │
            ▼         ▼          ▼                    │                │
      ┌─────────┐ ┌────────┐ ┌────────┐               │                │
      │ M5 COBRO│ │ M6     │ │ M7     │◄──────────────┘                │
      │ + CAJA  │ │IMPRES. │ │KDS/COC.│  (KDS por sync/realtime)        │
      └────┬────┘ └────────┘ └────────┘                                │
           ▼                                                           │
      ┌──────────┐                                                     │
      │ M11      │  (el cobro persiste invoice → huella VERIFACTU       │
      │VERIFACTU │   encadenada → serie por terminal en offline)        │
      │COMPLETO  │──────────────────────────────────────────────────────┘
      └──────────┘

   M9 COMPRAS/INVENTARIO ── depende de M1 (productos) y M3 (impuestos de compra);
                            el escandallo descuenta stock desde M5 (ventas). Módulo
                            en gran parte AISLADO del camino crítico → paralelizable.
```

**Lecturas clave**

- **M0 bloquea todo.** Sin datos + RLS + auth no hay nada.
- **M3 ya está resuelto en `@gluuh/core`** → desbloquea M2 y M5 sin coste de motor.
- **M4 (TPV) es el cuello de botella central**: depende de M1+M2+M3 y habilita M5, M6, M7.
- **M11 cuelga de M5**: la huella encadenada se genera al **persistir** la factura del cobro
  (ya iniciado en el commit `097da8b`).
- **M8 (offline) atraviesa M4/M5/M7**: se diseña pronto (eventos), se enciende en F5; aporta la
  **serie por terminal** que hace legal el offline.
- **M9 (compras) es el módulo más aislado**: puede ir en paralelo por otra persona.

---

## 2. Fases F0–F8

Cada fase es un **incremento demostrable** ante un local piloto. El orden respeta dependencias y
aprovecha lo ya hecho. Camino crítico del MVP legal: **F0 → F1 → F2 → (F3 ‖ F4) → F8**, con **F5
(offline) antes del piloto**. F6 y F7 se solapan con personal adicional.

| Fase | Objetivo | Módulos | Bloqueada por |
|------|----------|---------|---------------|
| **F0** | Cimientos, `setting`, RLS, auth/PIN, CI | M0 | — |
| **F1** | Catálogo + modificadores + impuestos por territorio | M1, M2, M3 | F0 |
| **F2** | TPV táctil + plano de sala + cobro real + caja | M4, M5 (+arranque M11) | F1 |
| **F3** | Impresión + tickets (3 nombres) + enrutado + cajón | M6 | F2 |
| **F4** | Cocina/KDS + comandera + tiempo real | M7 | F2 |
| **F5** | Offline‑first PowerSync + serie por terminal | M8 (sobre M4/M5/M7) | F2 (ideal F4) |
| **F6** | Compras/proveedores/inventario + escandallo + app almacén | M9 | F1 (paralelizable) |
| **F7** | Configuración/multi‑local/permisos/auditoría | M10 | F0 (refuerzo en F2+) |
| **F8** | VERIFACTU completo + carta digital/online + informes rentabilidad | M11, M12 | F2, F5 |

---

### F0 — Cimientos, `setting`, RLS, auth/PIN, CI

- **Objetivo:** monorepo, datos multi‑tenant, auth y CI **sólidos y reproducibles**, con el patrón
  `setting` (GLOBAL/LOCAL/DEVICE) como mecanismo universal de configuración.
- **Módulos:** M0.
- **Entregables:**
  - Migraciones `supabase/migrations/*.sql` como **única fuente canónica**; `apps/api/db/schema.sql`
    sincronizado o marcado explícitamente como espejo de referencia.
  - RLS por `tenant_id` (`current_tenant_id()`) verificada con tests de aislamiento.
  - Tabla **`setting`** (clave/valor por ámbito) + helper de resolución con precedencia DEVICE>LOCAL>GLOBAL.
  - Auth (Supabase) + sesión de empleado por **PIN** y rol.
  - CI verde: `pnpm build`, `pnpm typecheck`, `pnpm test` en todos los paquetes vía Turbo.
  - `.env.example` completo; secretos fuera del repo.
- **Se reutiliza:** estructura del monorepo, `@gluuh/core` y su suite de tests; backoffice web existente.
- **Definition of Done:**
  - [ ] Tenant A no puede leer datos de tenant B (test automatizado de tenancy).
  - [ ] `pnpm install && pnpm build && pnpm typecheck && pnpm test` pasa en limpio.
  - [ ] El **vector oficial AEAT** (`verifactu.test.ts`) sigue verde.
  - [ ] Resolver un `setting` por ámbito devuelve el valor correcto según precedencia (test).
  - [ ] Seed reproducible de un local de demo.
- **Riesgos:** deriva `schema.sql` ↔ migraciones (→ CI que falla si divergen); RLS mal aplicada
  (→ suite de tenancy obligatoria antes de cerrar fase).

---

### F1 — Catálogo + modificadores + impuestos por territorio

- **Objetivo:** carta completa, fiscalmente correcta y lista para alimentar el TPV, con **nombres
  múltiples** por producto (carta/botón/ticket/comanda/etiqueta).
- **Módulos:** M1, M2, M3.
- **Entregables:**
  - Familias/categorías/productos/menús consolidados con `tenant_id` y **clase fiscal** por producto.
  - **Nombres múltiples** (`nombre_carta`, `texto_boton`, `nombre_ticket`, `nombre_cocina`,
    `texto_etiqueta[1..5]`) — ver [producto.md §3](../09-referencia-configurador-agora/productos/producto.md).
  - **Modificadores** (grupos obligatorios/opcionales, mín/máx, suplementos, "producto como añadido")
    y **alérgenos** (14 UE).
  - Página **Impuestos** (`/impuestos`): ver/editar `tax_rate` por territorio; coherencia
    `resolver_iva()` SQL ↔ `ivaAuto` de `@gluuh/core` (test cruzado).
  - **Tarifas/promociones** por sala/horario/centro de venta.
- **Se reutiliza:** páginas de catálogo ya en `apps/web`; motor fiscal `@gluuh/core` (M3 sin coste).
- **Definition of Done:**
  - [ ] Producto con clase fiscal X en territorio canario calcula **IGIC** correcto y desglosa la base
        "hacia atrás" (`calcularImpuestosIncluidos`).
  - [ ] `resolver_iva()` y `ivaAuto` devuelven el mismo % para los mismos inputs (test cruzado).
  - [ ] Producto con modificadores obligatorios no se añade a comanda sin elegirlos.
  - [ ] Cada producto declara alérgenos (o "ninguno" explícito).
  - [ ] Cada destino (ticket/comanda/etiqueta) resuelve su propio nombre.
- **Riesgos:** divergencia tabla SQL ↔ core (→ core como verdad lógica, SQL como espejo testeado);
  modificadores mal modelados (→ modelar grupos/opciones desde el dominio en `@gluuh/core`).

---

### F2 — TPV táctil + plano de sala + cobro real + caja ★ (camino crítico)

- **Objetivo:** cerrar el **camino crítico**: abrir mesa, comandar, cobrar y **persistir** la venta con
  su factura y huella fiscal. Es la fase que convierte la app en **vendible**.
- **Módulos:** M4, M5 (y arranque de M11).
- **Entregables:**
  - **Plano de sala** (editor DnD: suelos, mesas, ubicaciones) y estados de mesa (libre/ocupada/cobrando);
    unir/mover/transferir mesa — ver [planos-mesas.md](../09-referencia-configurador-agora/herramientas/planos-mesas.md).
  - Comanda con líneas + modificadores + **pases** (1º, 2º, postre).
  - **Cobro real**: formas de pago (efectivo con cambio, tarjeta, **mixto**, propina); persistir
    `invoice` + `tax_line` + `verifactu_record` (huella encadenada) — continuación de `097da8b`.
  - **División de cuenta** (por ítem/asiento/partes) y cobros parciales.
  - Caja: apertura, arqueo, **cierre Z/X** (ya presente) conectado a las ventas reales.
  - Diseño de dominio como **eventos/operaciones** pensando ya en F5 (offline).
- **Se reutiliza:** UI de TPV/comandera y de caja ya en `apps/web`; huella VERIFACTU de `@gluuh/core`
  e iniciada en `097da8b`.
- **Definition of Done:**
  - [ ] Una venta completa genera `invoice` con líneas de impuesto correctas y **huella encadenada**
        verificable (factura N referencia N‑1).
  - [ ] El cierre Z cuadra con la suma de cobros del turno.
  - [ ] Cobro en **≤ 5 toques** de "mesa abierta" a "cobrado" (efectivo simple).
  - [ ] Dividir una cuenta en 2 produce 2 facturas coherentes.
- **Riesgos:** persistir mal la huella (→ reusar core; tests de encadenamiento); concurrencia en mesa
  (→ bloqueo optimista por versión, diseñado ya para F5).

---

### F3 — Impresión + tickets + enrutado + cajón

- **Objetivo:** imprimir el documento correcto en la impresora correcta, con cajón portamonedas.
- **Módulos:** M6 (`packages/hardware`).
- **Entregables:**
  - Soporte **ESC/POS** por red (`IP:9100`) y USB; ancho 58/80 mm.
  - **Tres documentos**: (1) **ticket de cliente** (factura simplificada con QR VERIFACTU + leyenda),
    (2) **comanda/impacto** por estación (usa `nombre_cocina`), (3) **informe Z/X**.
  - **Enrutado** producto→centro de producción→impresora (cocina, barra, plancha…) por `Tipo Prep.`.
  - Apertura de **cajón** al cobrar en efectivo; reimpresión y prueba de impresora.
  - Página `/impresoras` (IP/USB, ancho, centro de producción) y editor de **plantillas de ticket**.
- **Se reutiliza:** nombres múltiples de F1 (cada destino su nombre); huella/QR de `@gluuh/core`.
- **Definition of Done:**
  - [ ] Cobrar en efectivo imprime ticket cliente **y** abre el cajón.
  - [ ] Un producto de "plancha" se imprime en la impresora de plancha, no en la de barra.
  - [ ] El ticket lleva QR VERIFACTU válido + leyenda obligatoria.
  - [ ] Cola/reintento ante impresora caída **sin perder la venta**.
- **Riesgos:** hardware heterogéneo (→ módulo `hardware` aislado tras interfaz; probar en Epson/Sunmi
  reales **pronto**); impresora caída en hora punta (→ cola con reintento; la venta nunca depende de imprimir).

---

### F4 — Cocina/KDS + comandera + tiempo real

- **Objetivo:** que cocina vea las comandas al instante y gestione su ciclo (nuevo→en marcha→listo).
- **Módulos:** M7.
- **Entregables:**
  - KDS por estación con estados de pase, **tiempos** (cronómetro/preaviso) y avisos ("voz").
  - Comandera (móvil) que envía comanda y dispara pases a KDS.
  - **Tiempo real**: Supabase Realtime (online); el canal se diseña para que F5 lo sustituya por sync.
- **Se reutiliza:** UI KDS/cocina ya en `apps/web`; tiempos de preparación de la ficha de producto (F1).
- **Definition of Done:**
  - [ ] Una línea comandada aparece en el KDS de su estación en **< 2 s** (online).
  - [ ] Marcar un pase "listo" se refleja en TPV/comandera.
  - [ ] Tiempos por pase visibles (control de hora punta).
- **Riesgos:** latencia/pérdida de eventos (→ idempotencia por id de evento; reconciliación al reconectar);
  acoplar KDS a online (→ diseñar el canal para que F5 lo reemplace sin reescribir UI).

---

### F5 — Offline‑first (PowerSync) + serie por terminal

- **Objetivo:** operar el servicio completo **sin internet** y reconciliar al volver, con numeración
  legal **por terminal** que hace válido el cobro offline.
- **Módulos:** M8 (`packages/sync`) atravesando M4/M5/M7.
- **Entregables:**
  - SQLite local + reglas de sync bidireccional + **idempotencia** por evento.
  - Dominio como **eventos/operaciones** (ver `domain/operations.test.ts`).
  - **Serie por terminal** (numeración legal continua por dispositivo) — ver
    [series.md](../09-referencia-configurador-agora/administracion/series.md).
  - Resolución de conflictos definida (última‑escritura‑gana por defecto, reglas por entidad).
- **Se reutiliza:** modelo de eventos diseñado en F2; PowerSync (comprado, no construido).
- **Definition of Done:**
  - [ ] Cortar internet a mitad de servicio: se sigue comandando, cobrando e imprimiendo.
  - [ ] Al reconectar, **> 99,9 %** de tickets conciliados sin duplicados.
  - [ ] **Cero** pérdidas de cobro por caída de red (criterio de hora punta).
  - [ ] Cada terminal mantiene su serie continua sin huecos ni colisiones.
- **Riesgos:** conflictos de sync mal modelados (riesgo #1 del proyecto → **comprar PowerSync**; dominio
  como eventos; pruebas de partición de red).

---

### F6 — Compras/proveedores/inventario + escandallo + app almacén (paralelizable)

- **Objetivo:** controlar coste y stock; conectar ventas con consumo de materia prima.
- **Módulos:** M9 (independiente del camino crítico; equipo adicional).
- **Entregables:**
  - Almacenes (PMP), proveedores, **Pedido→Albarán→Factura** de proveedor, recepción.
  - **Inventario** con variaciones (ajuste/traspaso/recuento), fabricación, mermas y cierres.
  - **Escandallos** (receta → coste → margen) y **descuento de stock** al vender.
  - **App de almacén** (PWA táctil): recepción/recuento/mermas/traspasos.
  - Informe de **menu engineering** (margen × rotación).
- **Se reutiliza:** productos (M1) y motor de impuestos (M3, para impuestos de compra).
- **Definition of Done:**
  - [ ] Vender un plato con escandallo descuenta sus ingredientes del stock.
  - [ ] Un inventario detecta diferencias y genera regularización trazable.
  - [ ] Coste y margen por producto visibles en informe.
- **Riesgos:** sobre‑ingeniería (→ empezar por escandallo simple + descuento de stock; albaranes/mermas
  después); impuesto de compra ≠ venta (→ reusar M3).

---

### F7 — Configuración/multi‑local/permisos/auditoría

- **Objetivo:** administrar varios locales y permisos finos por rol sin tocar código, con auditoría.
- **Módulos:** M10.
- **Entregables:**
  - Datos de empresa/local fiscales (ya en `/ajustes`).
  - **Perfiles y permisos** finos por rol mapeados a RLS (`/perfiles`); empleados con editar/reset PIN.
  - **Multi‑local**: selección de local, datos por sede, consolidación en informes.
  - **Auditoría**: registro de acciones sensibles (anulaciones, reset PIN, purga ⚠ fiscal).
  - Marca/cartelería por local (`/personalizar`).
- **Se reutiliza:** `setting` de F0 (config por ámbito); ajustes ya en web; RLS de F0.
- **Definition of Done:**
  - [ ] Un rol "camarero" no ve informes ni configuración fiscal (verificado en UI **y** RLS).
  - [ ] Cambiar de local cambia carta/impresoras/caja sin recargar credenciales.
  - [ ] Reset de PIN y anulaciones quedan **auditados**.
- **Riesgos:** permisos solo en UI (→ la verdad vive en RLS; la UI solo refleja).

---

### F8 — VERIFACTU completo + carta digital/online + informes de rentabilidad

- **Objetivo:** cerrar el cumplimiento legal (envío real AEAT) y abrir los **canales online** y la
  **rentabilidad** que nos diferencian de Ágora.
- **Módulos:** M11, M12.
- **Entregables:**
  - Persistencia de factura con huella encadenada (de F2) + **visor VERIFACTU** (`/verifactu`) con estado AEAT.
  - Cliente AEAT **mTLS** (certificado) en `apps/api` (`/fiscal/enviar`) contra `prewww2.aeat.es`.
  - Registro de eventos fiscales y manejo de errores/reintentos AEAT.
  - **Carta digital/online**: modos Scan&Pay, Pedido en Mesa, Delivery, Take Away — ver
    [config-pago-pedidos.md](../09-referencia-configurador-agora/herramientas/config-pago-pedidos.md).
  - **Informes de rentabilidad**: menu engineering, márgenes, "qué hacer" (no solo "cuánto vendí").
  - Declaración responsable y casos IGIC confirmados con asesor.
- **Se reutiliza:** visor VERIFACTU iniciado en `097da8b`; informes reales ya en web; escandallo (F6)
  alimenta la rentabilidad.
- **Definition of Done:**
  - [ ] Una factura se **acepta** en el entorno de pruebas de la AEAT.
  - [ ] La cadena de huellas es continua y verificable a lo largo de un día de ventas.
  - [ ] El QR del ticket resuelve a la URL de cotejo AEAT.
  - [ ] Un cliente escanea el QR de mesa, pide y paga (Scan&Pay) y la venta entra fiscalizada.
  - [ ] El **vector oficial** (`verifactu.test.ts`) permanece **innegociablemente verde**.
- **Riesgos:** cumplimiento incorrecto (riesgo #2 → motor en backend desde día 1; asesoría; XSD
  reconfirmado; no improvisar el algoritmo, está en core probado).

---

## 3. Checklist maestro "TPV completo ES"

> Una casilla marcada = implementado **y** verificado en local real.

### Catálogo
- [ ] Familias, categorías, productos, menús/combos
- [ ] Nombres múltiples (carta/botón/ticket/comanda/etiqueta)
- [ ] Foto y descripción por producto
- [ ] Clase fiscal por producto (resuelve % por territorio)
- [ ] Disponibilidad (activar/ocultar, por horario, 86/agotado)

### Modificadores / alérgenos / tarifas
- [ ] Grupos de modificadores (obligatorio/opcional, mín/máx)
- [ ] Producto vendible como añadido de otro
- [ ] Suplementos con precio e impuesto correcto
- [ ] 14 alérgenos UE por producto
- [ ] Notas libres de cocina
- [ ] Tarifas por centro de venta + promociones por horario

### Mesas / salas
- [ ] Salas y mesas (alta/edición)
- [ ] Plano visual de sala (editor DnD)
- [ ] Estados de mesa (libre/ocupada/cobrando)
- [ ] Unir/mover/transferir mesa

### Comanda / pases
- [ ] Añadir líneas con modificadores
- [ ] Pases (1º, 2º, postre) y envío por pase a cocina
- [ ] Anular/invitar línea con motivo y permiso
- [ ] Tiempos de pase visibles

### Cobro y formas de pago
- [ ] Efectivo (cálculo de cambio) + apertura de cajón
- [ ] Tarjeta (datáfono; Stripe Terminal/Redsys en evolución)
- [ ] Pago mixto y propina
- [ ] División de cuenta (ítem/asiento/partes) y cobros parciales
- [ ] Apertura/arqueo/cierre Z y X

### Impresión
- [ ] Ticket cliente (factura simplificada + QR + leyenda VERIFACTU)
- [ ] Comanda/impacto por estación
- [ ] Informe Z/X
- [ ] Enrutado producto→centro de producción→impresora
- [ ] Cola/reintento ante impresora caída

### Cocina / KDS
- [ ] KDS por estación con estados de pase
- [ ] Tiempo real (online) y vía sync (offline)
- [ ] Avisos/voz y control de hora punta
- [ ] Comandera móvil

### Compras / inventario
- [ ] Proveedores, almacenes, pedidos, albaranes
- [ ] Inventario + regularizaciones + mermas + cierres
- [ ] Escandallos (coste/margen) y descuento de stock al vender
- [ ] App de almacén (PWA)
- [ ] Menu engineering

### Informes
- [ ] Ventas diarias, top productos, formas de pago (ya reales)
- [ ] Resumen fiscal, evolución de ventas, rendimiento por usuario
- [ ] Diario de ventas/pedidos, movimientos de caja, cancelaciones/invitaciones
- [ ] Rentabilidad (menu engineering, márgenes)
- [ ] Libro IVA/IGIC y export contabilidad

### Fiscalidad
- [ ] IVA/IGIC/IPSI por clase fiscal × territorio
- [ ] Precios con impuesto incluido y desglose "hacia atrás"
- [ ] Huella VERIFACTU encadenada al cobrar
- [ ] Serie por terminal (offline legal)
- [ ] Visor VERIFACTU + QR + estado AEAT
- [ ] Envío mTLS a AEAT (pruebas → producción)
- [ ] Vector oficial AEAT verde

### Online / carta digital
- [ ] Carta QR (SmartMenu)
- [ ] Scan & Pay, Pedido en Mesa, Delivery, Take Away
- [ ] Notificaciones y horarios/áreas de reparto

### Configuración
- [ ] Empresa/local fiscal
- [ ] Empleados, roles y PIN (editar/reset)
- [ ] Perfiles y permisos finos → RLS
- [ ] Multi‑local y consolidación
- [ ] Auditoría de acciones sensibles
- [ ] Marca/cartelería por local · `setting` por ámbito

### Hardware
- [ ] Impresora ESC/POS red + USB
- [ ] Cajón portamonedas
- [ ] Datáfono (evolución)
- [ ] Pantallas KDS/kiosko/cartelería

### Offline
- [ ] Comandar/cobrar/imprimir sin internet
- [ ] Sync bidireccional idempotente
- [ ] Reconciliación > 99,9 % al reconectar
- [ ] Cero pérdidas de cobro por red

---

## 4. Métricas de éxito y usabilidad

| Métrica | Objetivo | Cómo se mide |
|---------|----------|--------------|
| **Toques por comanda** (caso simple) | ≤ 4 toques añadir producto, ≤ 5 cobrar | Instrumentación UI |
| **Tiempo de cobro** (efectivo simple) | < 8 s de "cobrar" a "ticket impreso" | Telemetría de evento |
| **Caídas en hora punta** | **0** caídas de caja por falta de internet | Logs offline/sync |
| **Tickets conciliados** | > 99,9 % sin duplicados | Reconciliación post‑sync |
| **Aprendizaje de camarero** | < 1 h hasta operar solo | Onboarding piloto |
| **VERIFACTU aceptado** | 100 % facturas aceptadas (pruebas) | Respuesta AEAT |
| **Latencia comanda→KDS** | < 2 s online | Métrica realtime |
| **Disponibilidad de cobro** | 100 % aunque caigan red/impresora | Pruebas de partición |

---

## 5. Riesgos transversales y mitigaciones

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|------------|
| 1 | **Sincronización offline mal hecha** | Crítico | Comprar PowerSync; dominio como eventos; pruebas de partición (F5 diseñado desde F0) |
| 2 | **Cumplimiento fiscal incorrecto** | Crítico/legal | Motor en `@gluuh/core` (probado AEAT); asesoría; vector oficial innegociable; XSD reconfirmado |
| 3 | **Impresión en hardware heterogéneo** | Alto | Módulo `hardware` aislado; probar en Epson/Sunmi reales pronto; cola/reintento |
| 4 | **Conectividad inestable en locales** | Alto | Offline‑first real (F5); la venta nunca depende de red o impresora |
| 5 | **Integración del datáfono** | Medio | Empezar por Stripe Terminal; Redsys después; no bloquear MVP |
| 6 | **Formación del personal** | Medio | UX medida (toques/tiempo); onboarding < 1 h; piloto 5–10 locales |
| 7 | **Alcance grande, equipo pequeño** | Medio | MVP enfocado al camino crítico; F6/F7 paralelos; comprar lo que es riesgo |

---

## 6. Decisión y siguiente paso

| Aspecto | Decisión |
|---------|----------|
| **Camino crítico (MVP legal)** | F0 → F1 → F2 → (F3 ‖ F4) → F8, con **F5 antes del piloto** |
| **Aprovechar lo existente** | No reescribir `apps/web`; conectar al backend real y persistir cobro/factura |
| **Núcleo intocable** | `@gluuh/core` es la única fuente de verdad fiscal; vector AEAT siempre verde |
| **Paralelizable** | F6 (compras/inventario) y F7 (multi‑local/permisos) con equipo adicional |
| **Comprar, no construir** | PowerSync (sync) y pasarela de pago (Stripe Terminal) |
| **"Perfecto" = medible** | ≤5 toques cobro, 0 caídas en hora punta, >99,9 % conciliación, 100 % VERIFACTU aceptado |

**Siguiente paso accionable:** cerrar **F2 ★ cobro real + persistencia de factura VERIFACTU**
(continuación directa de `097da8b`): desbloquea impresión (F3), cierra el camino legal con F8 y convierte
la app en **vendible**. En paralelo, arrancar F6 si hay segunda persona.

> Relacionados: [roadmap 08](../08-roadmap-de-implementacion/) ·
> [referencia configurador Ágora](../09-referencia-configurador-agora/) ·
> [mejoras sobre Ágora](../mejoras/) ·
> [modelo de datos unificado](modelo-de-datos.md) · [arquitectura](arquitectura.md).
