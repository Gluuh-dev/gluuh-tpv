# TPV perfecto — análisis de rendimiento, completitud y arquitectura

> 18-07-2026. El TPV es la parte más importante de la aplicación: todo lo que toca el
> camarero debe ser **instantáneo, fluido y sin errores**. Este documento separa lo
> **verificado en el código** de lo que es **hipótesis a medir**, inventaría lo que
> **falta** y decide la **arquitectura de páginas**. La guía ejecutable está en
> [`docs/implementacion/21-tpv-perfecto.md`](../implementacion/21-tpv-perfecto.md).

## 1. Rendimiento — diagnóstico

### 1.1 El factor dominante: viajes de red EN SERIE (verificado)

El TPV en desarrollo habla con Supabase **en la nube** (~100–300 ms por viaje); en
producción hablará con el **nodo local** (<5 ms). Pero el código encadenaba viajes
**en serie** en los caminos calientes, y eso multiplica cualquier latencia:

| Camino | Viajes en serie | Estado |
|---|---|---|
| Cobrar desde Aparcados (`cobrarAparcadoEnSitio`) | 3 (versión → partes → líneas) | ✅ **corregido 18-07**: `Promise.all` → 1 |
| Recuperar aparcado (`recuperarAparcado`) | 5 | ✅ **corregido 18-07**: 4 en paralelo + refresco en 2º plano |
| Tras cobrar (`cobrar()` recargas) | 3 (mesas → llevar → aparcados) | ✅ **corregido 18-07**: `Promise.all` |
| Abrir mesa (`cargarCuentaMesa`) | 2–3 (pedido → partes; notas/líneas ya en paralelo) | 🟡 pendiente (F1) |
| Cobrar/dividir mesa desde el plano | `cargarCuentaMesa` + abrir modal | 🟡 hereda lo anterior |
| Cobro por artículos (`confirmarCobroArticulos`) | fiscal → carve → pagos (serie **necesaria**: cada paso depende del anterior) | ✅ correcto así; ver 1.2 |

**Regla**: todo lo independiente, en paralelo; solo es aceptable la serie cuando hay
dependencia real (p. ej. calcular fiscal ANTES de tocar la BD).

### 1.2 UI optimista (pendiente — la mejora que se SIENTE)

Aunque quede 1 viaje, el modal espera a la red para abrirse. El dato clave (el
**total** de la cuenta) ya está en la tarjeta que el camarero acaba de tocar:

- Abrir el modal **al instante** con el total conocido y cargar líneas/partes por
  debajo; si la red tarda, un "cargando…" **dentro** del modal ya abierto.
- Los botones de estado (marchar/listo/sentada/…) deben pintar el cambio **antes**
  de confirmar el servidor (optimista con rollback si falla).

### 1.3 Carga de código (verificado, en buen estado)

- Los 4 modales pesados van con `dynamic()` + precarga en idle (✅ ya existe).
- 🟡 Añadir a esa precarga: `CerrarDiaModal` y las vistas nuevas si se separan en
  chunks; asegurar que la precarga corre también entrando directo a la rama salas.

### 1.4 Coste de render (verificado el tamaño; efecto a medir)

- `page.tsx` ≈ 4.500 líneas y `PlanoSalas.tsx` ≈ 1.900: cada `setState` re-evalúa
  árboles grandes. Mitigado a medias (rails memoizados, migración parcial a
  `useTpvStore`/zustand — 46 usos ya).
- 🟡 Pendiente: terminar la migración a la store con **selectores** (que teclear no
  repinte el plano), `memo` en `TileProducto`/filas de listas, y aislar el SVG del
  plano de estados que no le afectan.
- `recargarMesas` hace 2 consultas (+1 de partes cobradas, añadida para el
  "pendiente" del plano) y un fallback triple de columnas (`color`/`sprite`) que en
  el peor caso son 3 viajes: cachear qué variante funciona la primera vez.

### 1.5 Lo que está BIEN y no hay que tocar

- `aparcadosLineas` va en **un** lote (`.in(order_id)`), no N+1 (verificado).
- Sin suscripciones realtime en la página (verificado): refrescos por acción,
  simple y predecible. (Realtime selectivo solo si se necesita multi-terminal vivo.)
- El cálculo fiscal SIEMPRE antes de tocar la BD — eso no se "optimiza": es la
  garantía de no cobrar sin ticket.

### 1.6 Medición (sin esto no hay "perfecto")

Presupuesto propuesto: **interacción → pintado < 100 ms** con datos locales;
**< 350 ms** con 1 viaje a nube; **< 50 ms** en nodo local. Añadir marcas
(`performance.now`) en: abrir cada modal, cobrar, cambiar de vista — y volcarlas a
consola en dev para cazar regresiones (F7).

## 2. Completitud — lo que falta para el TPV completo

### 2.1 Utilidades (mockup `gluuh-modal-utilidades.html`) — botones atenuados

Cada uno necesita o bien su función, o bien su **módulo/integración** (el patrón
"atenuado si el módulo no está activo" ya existe y es correcto):

- **Operativa**: Re. cocina, Grupo cocina, Zonas de impresión, Buscador de artículos,
  Buscar documento, Desactivar imp. cocina, Descuento de línea, Cambio de precio,
  Cambio de unidades, Selec. forma de pago, Enviar por email, Conversor de documentos.
- **Caja**: Apunte de caja, Resumen de caja, Cobros pendientes, Canjeo de regalos.
- **Gestión**: Agenda, Selección de tarifa, Control de presencia.
- **Integraciones** (módulos de pago/hardware): CashKeeper, CashLogy, SafePay, Bip,
  balanza.
- Ya activos: Cerrar turno/día, Nuevo artículo, Cambiar de usuario, Invitación,
  Ajustes del terminal, Módulos, Último ticket, Abrir cajón (función existe).

### 2.2 Pantallas de CONFIGURACIÓN dentro del TPV (mockups ya dibujados)

- `gluuh-mantenimiento-articulos.html` — config táctil de artículos.
- `gluuh-pantalla-configuracion-menu.html` — crear/componer menús.
- `gluuh-mantenimiento-terminales.html` / `gluuh-pantalla-mantenimiento-terminales.html` — dispositivos.
- Empleados (mockup `gluuh-empleados.html`) — el TPV ya remite a ella y no existe.
- Ajustes del terminal (existe botón; pantalla por completar).

### 2.3 Modales de venta pendientes

- **Comentarios/extras v2** (dos columnas, el cliente quería mejorarlo).
- **Combinar artículos** (copas: producto→formato→con qué) — la mitad que falta del
  formato-combinado.
- **Artículo rápido** fiel al mockup (hoy hay un alta simple).
- Divisiones: bloquear edición de líneas ya cobradas (decisión tomada, sin aplicar).

## 3. Arquitectura — ¿una página o varias?

**Decisión recomendada: híbrido.**

- La **OPERATIVA** (ticket, salones/terraza, aparcados, para llevar, reservas y
  todos los modales de venta/cobro) **sigue en UNA página** con estado vivo.
  Motivo: cambiar de vista debe ser instantáneo y **sin perder la cuenta en curso**;
  rutas separadas significan remount + re-fetch + estado global complejo. Lo que
  hoy da fluidez (todo montado, transiciones por estado) es la arquitectura buena
  para un TPV.
- La **CONFIGURACIÓN** dentro del TPV va en **rutas propias** (`/tpv/config/…`:
  artículos, menú, terminales, empleados, ajustes). No es camino caliente, se
  beneficia del code-splitting, de URL directa y de no engordar la página de venta.
- El problema real de "todo en la misma página" no son las vistas: es que
  `page.tsx` lo contiene **todo como un monolito**. La solución es **partir en
  módulos** (stores + componentes por vista, como ya se empezó con `useTpvStore` y
  `VistasOperativa`) manteniendo un único mount — no partir en páginas.

## 4. Riesgos y deudas señaladas

- Migración a `useTpvStore` a medias: dos fuentes de verdad temporales — terminarla
  antes de más features grandes (F3).
- `dividir_cuenta` (RPC 0095) ya no se usa desde la UI; se conserva en BD.
- "Juntar con otra" (aparcadas) deshabilitado a propósito: falta flujo de fusión.
- Alta rápida de Para llevar no captura hora/dirección (se ponen desde el detalle).
- Prueba de humo manual tras cada tanda: `docs/estado/PRUEBAS-TPV.md`.
