# Dividir y cobrar — flujo de interacción (decidido entre los dos)

> Decidido el 18-07-2026, pregunta a pregunta, con el usuario. Este documento manda
> sobre el comportamiento pantalla a pantalla. El modelo de datos y lo fiscal están en
> [`dividir-cuenta-y-ciclo.md`](dividir-cuenta-y-ciclo.md) (decisiones §6). Es una de
> las partes más importantes de la app: **no improvisar fuera de esto**.

## Principios (los tres que mandan)

1. **El modal Dividir es el centro de mando.** Cualquier cobro de una parte se abre
   **encima** del modal, y al confirmar **se vuelve al modal** (mientras quede
   pendiente). Nunca te deja tirado en otra pantalla.
2. **Nunca se pierde nada**: ni el sitio (siempre vuelves a donde estabas), ni un
   cobro hecho (lo cobrado jamás se borra), ni el reparto (persiste en `cuenta_parte`).
3. **Σ cobrado + pendiente = total**, en todo momento y en todas las pantallas.

## Flujo pantalla a pantalla (decidido ✅)

### 1) Cobrar una parte (A partes iguales / Por importe)
- Pulsas **Cobrar** en la Parte N → se abre la **pantalla de cobro encima del modal**
  con **solo ese importe** (ej. 2,75 €): efectivo con cambio, tarjeta, mixto.
- Al confirmar: **pago parcial real** contra el pedido de la mesa (la mesa NO se
  cierra), la parte pasa a verde **"Cobrada"**, el pendiente baja, y **vuelves al
  modal Dividir**.
- **Impresión (decisión 18-07, sustituye al "F10/F11")**: cada cobro de una división
  imprime **siempre** su ticket (lo que pagó esa persona). Y al **saldar** la cuenta
  sale además el **ticket completo** de la mesa (la factura del remanente impresa).
  El botón **Imprimir** de la tarjeta sigue sirviendo para sacarlo antes de cobrar.
- **Regla de orden (decisión 18-07)**: con partes de dinero **ya cobradas**, la
  pestaña **"Por productos" se deshabilita** (sacar artículos medio pagados
  descuadraría la cuenta). El orden bueno sí vale: artículos primero, y el reparto
  de dinero opera sobre lo que queda. Tras un cobro por artículos, el reparto de
  dinero PENDIENTE se regenera sobre el pendiente nuevo (lo cobrado jamás se toca).

### 2) Cobrar una cuenta (Por productos)
- Pulsas **Cobrar cuenta N** → esos artículos **salen de la mesa** (RPC
  `separar_cuenta`) → pantalla de cobro **encima** con solo esos artículos → se
  cobran con **su propia factura**.
- Al confirmar: **vuelves al modal Dividir**. Esos artículos ya no aparecen (ni en
  la mesa ni en "sin asignar") y el total del modal ha bajado.
- ⛔ **Prohibido lo de hoy**: cargar el sub-ticket como ticket activo y dejarte ahí.
  No se navega a ningún sitio; el sub-pedido se cobra "por debajo".

### 3) Botón del pie "Cobrar la cuenta"
- Con partes definidas, cobra **todo el pendiente de una** (abre el cobro con lo que
  falta). Caso real: "déjalo, pago yo el resto". Al confirmar → pendiente 0 → cierre.

### 4) Pendiente llega a 0 €
- **Cierre automático**: factura del remanente (una), mesa **LIBRE**, sonido de
  éxito, y navegación:
  - era una **mesa** → al **plano de mesas**;
  - era **venta directa** (sin mesa) → **ticket en blanco**.

### 5) Cerrar el modal a medias (X / Cancelar)
- Cerrar el modal **no borra nada**: partes cobradas y pendientes **se conservan**
  (`cuenta_parte`) y **reaparecen** al entrar en la mesa o reabrir Dividir.
- Para deshacer un reparto pendiente: botón **"Quitar división"** (con confirmación),
  que borra **solo** las partes NO cobradas. Lo cobrado jamás se toca.
- Consecuencia de texto: el botón "Cancelar" del pie pasa a llamarse **"Cerrar"**
  (no debe sugerir que deshace cobros).

### 6) La mesa en el plano, a medias
- Una mesa con partes cobradas a medias muestra **el pendiente** (no el total
  original) y una **señal de división** (badge/icono). Estado `POR_COBRAR`.

### 7) Entradas al reparto
- El botón **Dividir** de siempre **y además** un acceso **"Dividir"** dentro de la
  pantalla de cobro (para el "mejor divídelo" a mitad de cobro). Dos caminos, el
  mismo modal.

## Hoy vs. objetivo

| Acción | Hoy (mal) | Objetivo (decidido) |
|---|---|---|
| Cobrar parte (iguales/importe) | Marca visual, **no cobra** | Cobro parcial real + vuelta al modal |
| Cobrar cuenta (productos) | Carga un ticket nuevo y te deja ahí | Cobra por debajo y **vuelve al modal** |
| Pendiente = 0 | No pasa nada especial | Cierre automático + factura + a mesas |
| Cerrar el modal | Se pierde el reparto (estado local) | Persistido en `cuenta_parte`, reaparece |
| Mesa en el plano | Muestra el total | Muestra **pendiente** + señal de división |
| Entrada | Solo botón Dividir | Dividir + desde la pantalla de cobro |

## Orden de construcción (para implementar sin romper nada)

1. **Persistencia primero**: guardar/leer `cuenta_parte` al abrir el modal y al
   cambiar el reparto. Reabrir = mismo estado. (Sin esto, el cobro parcial sería
   peligroso: doble cobro.)
2. **Cobro de parte**: CobrarModal encima con el importe de la parte; al confirmar,
   pago parcial (insert en `payment` **sin** cerrar el pedido; mesa `POR_COBRAR`),
   marcar la parte cobrada y volver al modal.
3. **Por productos, vuelta al modal**: tras `separar_cuenta`, cobrar el sub-pedido
   sin tocar el ticket activo; al confirmar, refrescar líneas de la mesa y volver al
   modal.
4. **Cierre a 0**: factura del remanente por el camino de cobro probado + navegación
   (mesas / ticket en blanco).
5. **Plano**: pendiente + badge de división en la mesa.
6. **Entrada desde el cobro** (botón "Dividir" en CobrarModal).

### Notas técnicas (leer antes de codificar)
- El cobro parcial **no puede usar `cobrar()` actual** (cierra el pedido y factura).
  Camino parcial: insertar `payment` + dejar `POR_COBRAR`; la factura del remanente
  solo al saldar. Cuadre fiscal: los pagos parciales de iguales/importe suman
  exactamente el total del pedido de la mesa (cuyas líneas restantes son las que
  factura el cierre) → Σ pagos = factura. Los cobros por artículos facturan aparte
  (sub-pedido por el camino normal).
- El CobrarModal debe poder abrirse **encima del modal Dividir** con un importe
  arbitrario y un callback de vuelta (hoy solo cobra "el total del ticket activo").
- `cuenta_parte` ya existe (migración 0123) y `separar_cuenta` también (0124), ambas
  aplicadas en la nube.
