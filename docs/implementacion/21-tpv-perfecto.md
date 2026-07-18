# 17 — TPV perfecto: rendimiento instantáneo y completitud

> Guía ejecutable del análisis [`docs/plan/tpv-perfecto-analisis.md`](../plan/tpv-perfecto-analisis.md).
> Orden pensado para que cada fase deje el TPV **mejor y probado** antes de la
> siguiente. Tras cada fase: `pnpm typecheck` verde + humo manual de
> `docs/estado/PRUEBAS-TPV.md` + push.

## F1 — Latencia: cero viajes en serie evitables ⚡ (EMPEZADA 18-07)

**Hecho**: `cobrarAparcadoEnSitio`, `recuperarAparcado` y las recargas de `cobrar()`
ya van en `Promise.all` (3–5 viajes → 1).

**Pendiente** (mismo patrón, `apps/web/app/tpv/page.tsx`):
1. `cargarCuentaMesa`: tras obtener el id del pedido, lanzar **en paralelo**
   `recargarPartes(oid)` + `cargarLineas`/notas (hoy partes va detrás).
2. Revisar `guardarActual`/`pasarAMesa`/`traspasos`: paralelizar updates
   independientes (mesa origen/destino, recargas).
3. `recargarMesas`: cachear en módulo qué variante de select funciona
   (`color`/`sprite`) para no reintentar el fallback en cada refresco.

**Criterio de aceptación**: desde Aparcados, tocar «Cobrar» abre el modal en
< 350 ms contra nube (< 50 ms contra nodo). Ninguna función de UI encadena dos
`await` de red que no dependan entre sí.

## F2 — UI optimista: el modal se abre ANTES que la red

1. `cobrarAparcadoEnSitio`: abrir `COBRAR` **inmediatamente** usando el total de la
   tarjeta (`o.total`) y cargar líneas/partes por debajo; si aún cargan al
   confirmar, esperar ahí (con spinner en el botón), no antes.
   - Cuidado: `pendienteCuenta` deriva de la comanda → pasar un `totalInicial` al
     modal o esperar solo `recargarPartes` (1 viaje) si hay divisiones.
2. Botones de estado (llevar: marchar/listo/camino; reservas: confirmar/sentar…):
   pintar el cambio local al toque y **revertir con toast** si el update falla.
3. Velo `busy`: nunca a pantalla completa por operaciones de fondo; solo bloquear
   el control tocado.

**Criterio**: percepción de apertura instantánea (< 100 ms) en cobro y cambios de
estado, también con red lenta simulada (throttling).

## F3 — Render: terminar la migración a la store

1. Completar `useTpvStore` (comanda, precios, notas, invitadas…) y consumir con
   **selectores** finos; `page.tsx` deja de poseer ese estado.
2. `memo` en `TileProducto`, `TileCategoria`, filas de listas de las vistas.
3. Aislar el plano SVG: que teclear en el ticket o abrir modales NO re-renderice
   `PlanoSvg` (props estables, componente memo).
4. Partir `page.tsx` por módulos (venta / cobro / división / llevar-reservas
   handlers) sin cambiar rutas.

**Criterio**: React DevTools Profiler — teclear un producto no repinta plano ni
rails; ningún commit > 16 ms en interacciones de venta.

## F4 — Configuración DENTRO del TPV como rutas propias

Estructura: `apps/web/app/tpv/config/{articulos,menu,terminales,empleados,ajustes}/page.tsx`
(layout compartido con el navbar morado; guardia de permisos de operario).

1. **Empleados** (mockup `gluuh-empleados.html`) — desbloquea el alta de PIN.
2. **Mantenimiento de artículos** (`gluuh-mantenimiento-articulos.html`).
3. **Configuración del menú** (`gluuh-pantalla-configuracion-menu.html`) →
   `menu`/`menu_group`/`menu_choice`.
4. **Terminales** (`gluuh-pantalla-mantenimiento-terminales.html`) → `device`.
5. **Ajustes del terminal** (completar el existente).

**Criterio**: se llega desde Utilidades; volver al TPV no pierde la cuenta en
curso; cada pantalla funciona táctil y guarda en Supabase con RLS.

## F5 — Utilidades completas (con su sistema de módulos)

Por orden de valor operativo (cablear función o dejar atenuado por módulo):
1. Zonas de impresión (toggle ya existe en cobro — mover a función global).
2. Descuento de línea · Cambio de precio · Cambio de unidades (línea seleccionada).
3. Buscar documento + Último ticket (histórico y reimpresión).
4. Apunte de caja · Resumen de caja · Cobros pendientes.
5. Re. cocina · Grupo cocina · Desactivar imp. cocina.
6. Agenda · Selección de tarifa · Control de presencia · Canjeo de regalos ·
   Conversor de documentos · Enviar por email.
7. Integraciones (CashKeeper/CashLogy/SafePay/Bip/balanza): SOLO el enganche de
   módulo (atenuado hasta que exista el módulo real).

**Criterio**: ningún botón muerto — o funciona, o explica qué módulo necesita.

## F6 — Modales de venta restantes

1. **Comentarios/extras v2** (dos columnas con checkbox/±, mockup a refinar con el
   cliente).
2. **Combinar artículos** (copas) — completar `gluuh-modal-formato-combinado.html`.
3. **Artículo rápido** fiel al mockup.
4. División: **bloquear edición de líneas con partes cobradas** (decisión 18-07).

## F7 — Medición y pruebas (lo que mantiene el "perfecto")

1. Marcas `performance.now` (dev): abrir modal, cobrar, cambiar de vista →
   `console.table` con presupuesto (100/350/50 ms) y aviso si se supera.
2. Añadir a `docs/estado/PRUEBAS-TPV.md` el guion: cobrar aparcada in situ,
   dividir (3 modos), llevar (estados), reservas (ciclo completo + auto-cierre).
3. `pnpm typecheck` + humo tras cada fase; push (dos sesiones trabajando).

---

### Estado

| Fase | Estado |
|---|---|
| F1 | ✅ **HECHA 18-07**: cobrarAparcadoEnSitio, recuperarAparcado, recargas de cobrar(), cargarCuentaMesa (partes ∥ líneas), pasarAMesa (3 updates ∥) y caché de variante en recargarMesas |
| F2 | 🟡 núcleo hecho 18-07: cobro de aparcada abre AL INSTANTE (total provisional + guarda anti-pérdida de pago en cobrarDesdeModal); botones de estado optimistas con rollback en Llevar y Reservas. Falta: optimista en más acciones (alias, sentar mesa desde plano) |
| F7 | 🟡 primera marca de medición (carga de aparcada, consola en dev) |
| F3 | 🟡 tiles ya memoizados (verificado); la migración a useTpvStore se coordina con la sesión de escritorio |
| F4 | ✅ **HECHA 18-07** — hub `/tpv/config` + 5 pantallas: **Empleados** (alta con PIN, pulsera, perfil), **Artículos** (lista+ficha: precio, clase de IVA con recálculo por territorio, categoría, zona de impresión, visible, al peso, textos de botón/ticket/cocina), **Menús** (crear menú, precio/clase/activo, grupos y opciones marcando productos, optimista), **Terminales** (estado en línea por latido, editar nombre/estación; el alta sigue en el panel — su API depende del hook de claims pendiente), **Ajustes** (tema, modo zurdo). "Ajustes del terminal" de Utilidades abre el hub. Pendiente fino: fotos en artículos (subida), horarios de menú |
| F5 | 🟡 Empleados en Utilidades (rejilla a 7 filas) + **Descuento de línea cableado** (abre Invitaciones y descuentos); resto según guía |
| F6 | 🟡 extras ± HECHO · **bloqueo de líneas con partes cobradas HECHO** (anular línea, eliminar desde modificadores, invitar y borrar cuenta quedan bloqueados con aviso; añadir sigue permitido) · **artículo rápido rediseñado** al mockup (nombre botón, precio, IVA, categoría, zona de impresión, visible, al peso, foto, Guardar / Guardar y vender; sin tarifas por zona ni báscula: pendientes de esquema). Falta: combinar copas (necesita decidir qué categoría hace de "con qué") |
