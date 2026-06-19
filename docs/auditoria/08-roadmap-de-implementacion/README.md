# 08 · Roadmap de implementación — construir el TPV "perfecto y fácil de usar" por fases

> Este documento convierte toda la auditoría (01 plataforma, 02 interfaz táctil, 03 catálogo y
> modificadores, 04 impresión y tickets, 05 cocina/KDS, 06 compras/inventario, 07 configuración)
> en un **plan de ejecución por fases**, con entregables, criterios de aceptación (Definition of
> Done) y riesgos por fase. Complementa y es consistente con
> [`docs/13-roadmap-mvp-y-equipo.md`](../../13-roadmap-mvp-y-equipo.md) (visión MVP/equipo/coste) y
> [`docs/19-plan-construccion.md`](../../19-plan-construccion.md) (construcción página a página del
> backoffice web). Aquí priorizamos sobre el **estado real del repo**: `apps/web` está muy avanzada,
> `packages/core` (motor fiscal) está probado contra el vector oficial AEAT, y el grueso del trabajo
> pendiente es **persistencia del cobro, impresión real, KDS en tiempo real, offline-first y el
> módulo de compras/inventario**.

---

## 1. Filosofía y principios rectores

1. **Vendible y legal antes que bonito.** Un TPV que no cobra, no imprime o no cumple VERIFACTU no
   sirve. El "camino feliz" venta→cobro→factura→ticket impreso es el eje vertebrador.
2. **Lo difícil, pronto.** Offline-first y fiscalidad no se "añaden después": condicionan el modelo
   de datos. Se diseñan desde F0 aunque se completen más tarde.
3. **No reinventar el núcleo.** Toda lógica fiscal vive en `@gluuh/core`; las apps importan, no
   duplican. El sync se compra (PowerSync), no se construye a mano.
4. **Usabilidad medible.** Cada fase define métricas (toques por comanda, tiempo de cobro). "Fácil de
   usar" es un criterio de aceptación, no una opinión.
5. **Incremental sobre lo existente.** No reescribir `apps/web`; consolidarla y conectarla al
   backend real. Cada fase deja el producto en estado **demostrable** ante un local piloto.

---

## 2. Alcance completo y mapa de dependencias

### 2.1 Módulos del producto

| # | Módulo | Auditoría | Estado actual (repo) |
|---|--------|-----------|----------------------|
| M0 | Plataforma: monorepo, datos, multi-tenant/RLS, auth, CI | 01 | 🟢 base sólida |
| M1 | Catálogo: familias/categorías/productos/menús | 03 | 🟢 web hecho |
| M2 | Modificadores, alérgenos, clases fiscales, tarifas/promos | 03 | 🟡 parcial |
| M3 | Impuestos IVA/IGIC/IPSI (motor + tabla `tax_rate`) | 03 | 🟢 core probado |
| M4 | TPV táctil: sala/mesas, comanda, pases, división de cuenta | 02 | 🟡 UI avanzada, sin persistencia |
| M5 | Cobro + formas de pago + caja (Z/X) | 02 | 🟡 caja sí, cobro real no |
| M6 | Impresión y tickets (3 documentos, enrutado, cajón) | 04 | 🔴 esqueleto `hardware` |
| M7 | Cocina/KDS + comandera + tiempo real | 05 | 🟡 UI KDS/cocina, sin backend live |
| M8 | Offline-first (PowerSync) | 01 | 🔴 esqueleto `sync` |
| M9 | Compras/proveedores/inventario/escandallo/mermas | 06 | 🔴 no existe |
| M10 | Configuración/multi-local/perfiles y permisos | 07 | 🟡 ajustes sí, permisos finos no |
| M11 | Fiscal VERIFACTU completo (persistencia + envío AEAT + certificación) | — | 🟡 motor + visor, falta envío real |
| M12 | Informes | — | 🟢 informes reales ya en web |

Leyenda: 🟢 hecho/sólido · 🟡 parcial · 🔴 por construir.

### 2.2 Diagrama de dependencias (qué bloquea a qué)

```
                         ┌─────────────────────────────┐
                         │  M0 PLATAFORMA / DATOS / RLS │  (cimiento — bloquea todo)
                         └──────────────┬──────────────┘
                                        │
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ M1      │    │ M3       │    │ M10      │    │ M8       │    │ M12      │
   │CATÁLOGO │    │IMPUESTOS │    │CONFIG/   │    │OFFLINE   │    │INFORMES  │
   │         │    │(core ✓)  │    │PERMISOS  │    │PowerSync │    │          │
   └────┬────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    └──────────┘
        │              │               │               │
        ▼              │               │               │
   ┌─────────┐         │               │               │
   │ M2 MODIF│◄────────┘               │               │
   │ALÉRGENOS│  (precio = base+clase   │               │
   └────┬────┘   fiscal × territorio)  │               │
        │                              │               │
        └──────────────┬──────────────┘               │
                       ▼                               │
                 ┌──────────┐                          │
                 │ M4 TPV   │                          │
                 │ TÁCTIL   │──────────────────────────┤ (la comanda se sincroniza)
                 └────┬─────┘                          │
            ┌─────────┼──────────┐                     │
            ▼         ▼          ▼                     │
      ┌─────────┐ ┌────────┐ ┌────────┐                │
      │ M5 COBRO│ │ M6     │ │ M7     │◄───────────────┘ (KDS recibe pases por sync/realtime)
      │ + CAJA  │ │IMPRES. │ │KDS/COC.│
      └────┬────┘ └────────┘ └────────┘
           ▼
      ┌──────────┐
      │ M11      │  (el cobro persiste invoice → dispara huella VERIFACTU)
      │VERIFACTU │
      │COMPLETO  │
      └──────────┘

   M9 COMPRAS/INVENTARIO  ── depende de M1 (productos) y M3 (impuestos compra);
                             escandallo descuenta stock desde M5 (ventas). Módulo
                             en gran parte independiente del camino crítico TPV.
```

**Lecturas clave del diagrama**

- **M0 bloquea todo.** Sin datos + RLS + auth no hay nada.
- **M3 (impuestos) ya está resuelto en `@gluuh/core`** → desbloquea M2 y M5 sin coste.
- **M4 (TPV) es el cuello de botella central**: depende de M1+M2+M3 y habilita M5, M6, M7.
- **M11 (VERIFACTU completo) cuelga de M5**: la huella encadenada se genera al **persistir** la
  factura del cobro (ya iniciado en el commit `097da8b`).
- **M8 (offline) atraviesa M4/M5/M7**: por eso se diseña pronto, aunque se "encienda" en F5.
- **M9 (compras) es el módulo más aislado**: puede ir en paralelo por otra persona sin bloquear el
  camino crítico de venta.

---

## 3. Fases de implementación

Cada fase es un **incremento demostrable**. El orden respeta dependencias y aprovecha lo ya hecho:
priorizamos cerrar el **camino crítico de venta legal** (F0→F4 + F8) y dejamos compras/inventario
(F6) y multi-local (F7) en paralelo o posteriores.

| Fase | Objetivo | Módulos | Bloqueada por |
|------|----------|---------|---------------|
| **F0** | Cimientos y datos consolidados | M0 | — |
| **F1** | Catálogo + modificadores + impuestos coherentes | M1, M2, M3 | F0 |
| **F2** | TPV táctil + cobro real + caja | M4, M5 | F1 |
| **F3** | Impresión y tickets (3 documentos, enrutado, cajón) | M6 | F2 |
| **F4** | Cocina/KDS + comandera + tiempo real | M7 | F2 |
| **F5** | Offline-first con PowerSync | M8 (sobre M4/M5/M7) | F2 (idealmente F4) |
| **F6** | Compras / proveedores / inventario / escandallo | M9 | F1 (paralelizable) |
| **F7** | Configuración / multi-local / perfiles y permisos | M10 | F0 (refuerzo en F2+) |
| **F8** | VERIFACTU completo y certificación AEAT | M11 | F2, F5 |

> **Decisión de priorización:** F0→F1→F2→F3/F4 (paralelos)→F8 forman el **MVP vendible y legal**.
> F5 (offline) es bloqueante para vender a locales con internet inestable y debe entrar antes del
> piloto. F6 y F7 se solapan con personal adicional. F8 se cierra contra el entorno de pruebas AEAT
> en paralelo a F3/F4 y se "promociona" a producción al final.

---

### F0 — Cimientos y datos

- **Objetivo:** que el monorepo, los datos multi-tenant, la autenticación y CI/CD estén sólidos y
  reproducibles, de modo que todo lo demás se apoye sin sobresaltos.
- **Módulos:** M0.
- **Entregables:**
  - Migraciones `supabase/migrations/*.sql` como **única fuente canónica**; `apps/api/db/schema.sql`
    sincronizado o marcado explícitamente como referencia.
  - RLS por `tenant_id` (`current_tenant_id()`) verificada con tests de aislamiento.
  - Auth (Supabase) + sesión de empleado por **PIN** y rol.
  - CI verde: `pnpm build`, `pnpm typecheck`, `pnpm test` en todos los paquetes vía Turbo.
  - `.env.example` completo; secretos fuera del repo.
- **DoD:**
  - [ ] Un tenant A no puede leer datos de tenant B (test automatizado).
  - [ ] `pnpm install && pnpm build && pnpm typecheck && pnpm test` pasa en limpio.
  - [ ] El test del **vector oficial AEAT** (`verifactu.test.ts`) sigue verde.
  - [ ] Seed reproducible de un local de demo.
- **Riesgos y mitigación:**
  - *Deriva schema.sql vs migraciones* → CI que falla si divergen; elegir migraciones como canónicas.
  - *RLS mal aplicada* → suite de tests de tenancy obligatoria antes de cerrar fase.

---

### F1 — Catálogo + modificadores + impuestos

- **Objetivo:** que la carta esté completa, fiscalmente correcta y lista para alimentar el TPV.
- **Módulos:** M1, M2, M3.
- **Entregables:**
  - Familias/categorías/productos/menús (ya en web) consolidados con `tenant_id` y clase fiscal.
  - **Modificadores** (grupos obligatorios/opcionales, mín/máx, suplementos) y **alérgenos** (14 UE).
  - Página **Impuestos** (`/impuestos`): ver/editar `tax_rate` por territorio; coherencia
    `resolver_iva()` SQL ↔ `ivaAuto` de `@gluuh/core` (test cruzado).
  - **Tarifas/promociones** por sala/horario (`/tarifas`).
- **DoD:**
  - [ ] Un producto con clase fiscal X en territorio canario calcula IGIC correcto y desglosa la base
        "hacia atrás" (`calcularImpuestosIncluidos`).
  - [ ] `resolver_iva()` y `ivaAuto` devuelven el mismo % para los mismos inputs (test).
  - [ ] Un producto con modificadores obligatorios no se puede añadir a comanda sin elegirlos.
  - [ ] Cada producto declara sus alérgenos (o "ninguno" explícito).
- **Riesgos y mitigación:**
  - *Divergencia tabla SQL ↔ core* → único punto de verdad lógico en core, SQL como espejo testeado.
  - *Modificadores mal modelados* → modelar grupos/opciones desde el dominio en `@gluuh/core`.

---

### F2 — TPV táctil + cobro real + caja

- **Objetivo:** cerrar el **camino crítico**: abrir mesa, comandar, cobrar y persistir la venta con
  su factura y huella fiscal.
- **Módulos:** M4, M5 (y arranque de M11).
- **Entregables:**
  - Sala/mesas operativas (plano visual deseable), comanda con líneas + modificadores + **pases**.
  - **Cobro real**: formas de pago (efectivo, tarjeta, mixto), cambio, propina; persistir
    `invoice` + `tax_line` + `verifactu_record` (huella encadenada) — ya iniciado en `097da8b`.
  - **División de cuenta** (por ítem/asiento/partes) y cobros parciales.
  - Caja: apertura, arqueo, **cierre Z/X** (ya presente) conectado a las ventas reales.
- **DoD:**
  - [ ] Una venta completa genera `invoice` con líneas de impuesto correctas y **huella encadenada**
        verificable.
  - [ ] El cierre Z cuadra con la suma de cobros del turno.
  - [ ] Cobro en **≤ 5 toques** desde "mesa abierta" hasta "cobrado" (caso simple efectivo).
  - [ ] Dividir una cuenta en 2 y cobrar cada parte produce 2 facturas coherentes.
- **Riesgos y mitigación:**
  - *Persistir mal la huella* → reusar `@gluuh/core`; tests de encadenamiento (factura N referencia N-1).
  - *Concurrencia en mesa* → bloqueo optimista por versión; resolver en diseño pensando ya en F5.

---

### F3 — Impresión y tickets

- **Objetivo:** imprimir los documentos correctos en la impresora correcta, con cajón portamonedas.
- **Módulos:** M6 (`packages/hardware`).
- **Entregables:**
  - Soporte **ESC/POS** sobre red (`IP:9100`) y USB; ancho 58/80 mm.
  - **Tres documentos** bien diferenciados: (1) **ticket de cliente** (factura simplificada con QR
    VERIFACTU + leyenda), (2) **comanda/impacto de cocina** por estación, (3) **informe Z/X**.
  - **Enrutado** producto→centro de producción→impresora (cocina, barra, plancha…).
  - Apertura de **cajón** al cobrar en efectivo; reimpresión y prueba de impresora.
  - Página `/impresoras` (configurar IP/USB, ancho, centro de producción).
- **DoD:**
  - [ ] Cobrar en efectivo imprime ticket cliente **y** abre el cajón.
  - [ ] Un producto de "plancha" se imprime en la impresora de plancha, no en la de barra.
  - [ ] El ticket lleva QR VERIFACTU válido y leyenda obligatoria.
  - [ ] Reintento/cola ante impresora caída sin perder la venta.
- **Riesgos y mitigación:**
  - *Hardware heterogéneo* → módulo `hardware` aislado tras interfaz; **probar en Epson/Sunmi reales
    pronto**, no al final.
  - *Impresora caída en hora punta* → cola con reintento y aviso; la venta nunca depende de imprimir.

---

### F4 — Cocina / KDS + comandera + tiempo real

- **Objetivo:** que cocina vea las comandas al instante y gestione su ciclo (nuevo→en marcha→listo).
- **Módulos:** M7.
- **Entregables:**
  - KDS por estación con estados de pase, tiempos y "voz" (avisos).
  - Comandera (móvil) que envía comanda y dispara pases a KDS.
  - **Tiempo real**: Supabase Realtime (online) y, en F5, propagación por PowerSync (offline).
- **DoD:**
  - [ ] Una línea comandada aparece en el KDS de su estación en **< 2 s** (online).
  - [ ] Marcar un pase "listo" se refleja en TPV/comandera.
  - [ ] Tiempos por pase visibles (control de hora punta).
- **Riesgos y mitigación:**
  - *Latencia/perdida de eventos* → idempotencia por id de evento; reconciliación al reconectar.
  - *Acoplar KDS a online* → diseñar el canal para que F5 lo sustituya por sync sin reescribir UI.

---

### F5 — Offline-first (PowerSync)

- **Objetivo:** operar el servicio completo **sin internet** y reconciliar al volver.
- **Módulos:** M8 (`packages/sync`) atravesando M4/M5/M7.
- **Entregables:**
  - SQLite local + reglas de sync bidireccional + **idempotencia** por evento.
  - Modelo de dominio como **eventos/operaciones** (ver `domain/operations.test.ts`).
  - Resolución de conflictos definida (última-escritura-gana por defecto, reglas por entidad).
- **DoD:**
  - [ ] Cortar internet a mitad de servicio: se sigue comandando, cobrando e imprimiendo.
  - [ ] Al reconectar, **> 99,9 %** de tickets conciliados sin duplicados.
  - [ ] Cero pérdidas de cobro por caída de red (criterio de hora punta).
- **Riesgos y mitigación:**
  - *Conflictos de sync mal modelados* (riesgo #1 del proyecto) → **comprar PowerSync**, no construir;
    dominio como eventos; pruebas de partición de red.

---

### F6 — Compras / proveedores / inventario / escandallo

- **Objetivo:** controlar coste y stock; conectar ventas con consumo de materia prima.
- **Módulos:** M9 (paralelizable, equipo adicional).
- **Entregables:**
  - Almacenes, proveedores, pedidos, albaranes, recepción.
  - **Inventario** con regularizaciones y **mermas**.
  - **Escandallos** (receta → coste → margen) y descuento de stock al vender.
  - Informe de **menu engineering** (margen × rotación).
- **DoD:**
  - [ ] Vender un plato con escandallo descuenta sus ingredientes del stock.
  - [ ] Un inventario detecta diferencias y genera regularización trazable.
  - [ ] Coste y margen por producto visibles en informe.
- **Riesgos y mitigación:**
  - *Sobre-ingeniería* → empezar por escandallo simple + descuento de stock; albaranes/mermas después.
  - *Datos de compra con impuesto distinto a venta* → reusar M3 para impuestos de compra.

---

### F7 — Configuración / multi-local / perfiles y permisos

- **Objetivo:** administrar varios locales y permisos finos por rol sin tocar código.
- **Módulos:** M10.
- **Entregables:**
  - Datos de empresa/local fiscales (ya en `/ajustes`).
  - **Perfiles y permisos** finos por rol mapeados a RLS (`/perfiles`); empleados con editar/reset PIN.
  - Multi-local: selección de local, datos por sede, consolidación en informes.
  - Marca/cartelería por local (`/personalizar`).
- **DoD:**
  - [ ] Un rol "camarero" no ve informes ni configuración fiscal (verificado en UI y RLS).
  - [ ] Cambiar de local cambia carta/impresoras/caja sin recargar credenciales.
  - [ ] Reset de PIN auditado.
- **Riesgos y mitigación:**
  - *Permisos solo en UI* → la verdad de permisos vive en **RLS**; la UI solo refleja.

---

### F8 — VERIFACTU completo y certificación

- **Objetivo:** cerrar el cumplimiento legal: huella, QR, XML/SOAP, envío real a AEAT y registro de
  eventos, validado contra el entorno de pruebas.
- **Módulos:** M11 (apoyado en `@gluuh/core` y `apps/api`).
- **Entregables:**
  - Persistencia de factura con huella encadenada (de F2) + **visor VERIFACTU** (`/verifactu`, ya
    iniciado) con estado AEAT.
  - Cliente AEAT **mTLS** (certificado) en `apps/api` (`/fiscal/enviar`) contra `prewww2.aeat.es`.
  - Registro de eventos fiscales y manejo de errores/reintentos AEAT.
  - Declaración responsable y casos IGIC confirmados con asesor.
- **DoD:**
  - [ ] Una factura se **acepta** en el entorno de pruebas de la AEAT.
  - [ ] La cadena de huellas es continua y verificable a lo largo de un día de ventas.
  - [ ] El QR del ticket resuelve a la URL de cotejo AEAT.
  - [ ] El **vector oficial** (`verifactu.test.ts`) permanece innegociablemente verde.
- **Riesgos y mitigación:**
  - *Cumplimiento incorrecto* (riesgo #2) → motor en backend desde día 1; asesoría fiscal; XSD
    reconfirmado; no improvisar el algoritmo (está en core, probado).

---

## 4. Checklist maestro "TPV completo" para hostelería ES

> Lista de comprobación transversal. Una casilla marcada = implementado **y** verificado en local real.

### Catálogo
- [ ] Familias, categorías, productos, menús/combos
- [ ] Foto y descripción por producto
- [ ] Clase fiscal por producto (resuelve % por territorio)
- [ ] Disponibilidad (activar/ocultar, por horario)

### Modificadores / alérgenos
- [ ] Grupos de modificadores (obligatorio/opcional, mín/máx)
- [ ] Suplementos con precio e impuesto correcto
- [ ] 14 alérgenos UE por producto
- [ ] Notas libres de cocina

### Mesas / salas
- [ ] Salas y mesas (alta/edición)
- [ ] Plano visual de sala
- [ ] Estados de mesa (libre/ocupada/cobrando)
- [ ] Unir/mover/transferir mesa

### Comanda / pases
- [ ] Añadir líneas con modificadores
- [ ] Pases (1º, 2º, postre) y envío por pase a cocina
- [ ] Anular/invitar línea con motivo y permiso
- [ ] Tiempos de pase visibles

### Cobro y formas de pago
- [ ] Efectivo (con cálculo de cambio) + apertura de cajón
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
- [ ] Inventario + regularizaciones + mermas
- [ ] Escandallos (coste/margen) y descuento de stock al vender
- [ ] Menu engineering

### Informes
- [ ] Ventas diarias, top productos, formas de pago (ya reales)
- [ ] Resumen fiscal, evolución de ventas, rendimiento por usuario
- [ ] Diario de ventas/pedidos, movimientos de caja, cancelaciones/invitaciones
- [ ] Libro IVA/IGIC y export contabilidad

### Fiscalidad
- [ ] IVA/IGIC/IPSI por clase fiscal × territorio
- [ ] Precios con impuesto incluido y desglose "hacia atrás"
- [ ] Huella VERIFACTU encadenada al cobrar
- [ ] Visor VERIFACTU + QR + estado AEAT
- [ ] Envío mTLS a AEAT (pruebas → producción)
- [ ] Vector oficial AEAT verde

### Configuración
- [ ] Empresa/local fiscal
- [ ] Empleados, roles y PIN (editar/reset)
- [ ] Perfiles y permisos finos → RLS
- [ ] Multi-local y consolidación
- [ ] Marca/cartelería por local

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

## 5. Métricas de éxito y usabilidad

| Métrica | Objetivo | Cómo se mide |
|---------|----------|--------------|
| **Toques por comanda** (caso simple) | ≤ 4 toques añadir producto, ≤ 5 cobrar | Instrumentación UI |
| **Tiempo de cobro** (efectivo simple) | < 8 s de "cobrar" a "ticket impreso" | Telemetría de evento |
| **Caídas en hora punta** | **0** caídas de caja por falta de internet | Logs offline/sync |
| **Tickets conciliados** | > 99,9 % sin duplicados | Reconciliación post-sync |
| **Aprendizaje de camarero** | < 1 h hasta operar solo | Onboarding piloto |
| **VERIFACTU aceptado** | 100 % facturas aceptadas (pruebas) | Respuesta AEAT |
| **Latencia comanda→KDS** | < 2 s online | Métrica realtime |
| **Disponibilidad de cobro** | 100 % aunque caigan red/impresora | Pruebas de partición |

---

## 6. Riesgos transversales y mitigaciones

| # | Riesgo transversal | Impacto | Mitigación |
|---|--------------------|---------|------------|
| 1 | **Sincronización offline mal hecha** | Crítico | Comprar PowerSync; dominio como eventos; pruebas de partición de red (F5 diseñado desde F0) |
| 2 | **Cumplimiento fiscal incorrecto** | Crítico/legal | Motor en `@gluuh/core` (probado AEAT); asesoría; vector oficial innegociable; XSD reconfirmado |
| 3 | **Impresión en hardware heterogéneo** | Alto | Módulo `hardware` aislado tras interfaz; probar en Epson/Sunmi reales pronto; cola/reintento |
| 4 | **Conectividad inestable en locales** | Alto | Offline-first real (F5); la venta nunca depende de red o impresora |
| 5 | **Integración del datáfono** | Medio | Empezar por Stripe Terminal (API moderna); Redsys después; no bloquear MVP |
| 6 | **Formación del personal** | Medio | UX medida (toques/tiempo); onboarding < 1 h; piloto 5–10 locales antes de escalar |
| 7 | **Alcance grande, equipo pequeño** | Medio | MVP enfocado al camino crítico; F6/F7 paralelos con personal adicional; comprar lo que es riesgo |

---

## 7. Resumen y decisión

| Aspecto | Decisión |
|---------|----------|
| **Camino crítico (MVP legal)** | F0 → F1 → F2 → (F3 ‖ F4) → F8, con **F5 (offline) antes del piloto** |
| **Aprovechar lo existente** | No reescribir `apps/web`; conectar al backend real y persistir cobro/factura |
| **Núcleo intocable** | `@gluuh/core` (fiscal VERIFACTU/IGIC) es la única fuente de verdad; vector AEAT siempre verde |
| **Paralelizable** | F6 (compras/inventario) y F7 (multi-local/permisos) con equipo adicional |
| **Comprar, no construir** | PowerSync (sync) y pasarela de pago (Stripe Terminal) — riesgo puro |
| **Definición de "perfecto"** | Métricas de usabilidad (≤5 toques cobro, 0 caídas en hora punta, >99,9 % conciliación) como criterio de aceptación, no como aspiración |

**Siguiente paso accionable:** cerrar **F2 ★ cobro real + persistencia de factura VERIFACTU**
(continuación directa del commit `097da8b`), porque desbloquea impresión (F3), cierra el camino legal
con F8 y convierte la app en **vendible**. En paralelo, arrancar F6 si hay segunda persona.

> Documentos relacionados: [13 · Roadmap, MVP y equipo](../../13-roadmap-mvp-y-equipo.md) ·
> [19 · Plan de construcción página a página](../../19-plan-construccion.md) ·
> [Índice de auditoría](../README.md).
