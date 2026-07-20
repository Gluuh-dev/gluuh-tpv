---
name: gluuh-pantalla-config
description: >-
  Cómo hacer una pantalla de configuración del TPV nuevo (apps/tpv/src/apartados/
  config) COMPLETA y no básica: qué mirar antes de escribir un solo campo, cómo
  cablearla al nodo sin fingir datos, y el checklist para que no se quede corta.
  Úsala SIEMPRE que vayas a crear o ampliar una pantalla de Configuración
  (Familias, Categorías, Productos, Menús, Impresoras, Tarifas, Formas de pago…).
  El error que evita: hacer una versión "básica" con cuatro campos cuando la
  tabla y el panel de Next tienen quince, y meter columnas que nadie lee.
---

# Pantalla de configuración del TPV — hazla completa, no básica

Cada pantalla de `apps/tpv/src/apartados/config/mantenimiento/` gestiona una
tabla del catálogo. El fallo recurrente es hacerla con la mitad de los campos:
la tabla tiene quince columnas y la pantalla enseña cuatro. **Antes de escribir
un campo, se investiga qué se configura de verdad.**

## 1 · Antes de tocar código: las TRES fuentes (obligatorio)

Nunca inventes los campos de memoria. Míralos en las tres, y contrástalas:

1. **La BD real.** `mcp__supabase__execute_sql`:
   `select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='<tabla>' order by ordinal_position;`
   Y para las columnas dudosas (FK de jerarquía, flags), mira si tienen **datos
   reales** con `count(*)` — NO reltuples, que mienten en este repo. Una columna
   a cero en todos los tenants suele ser un stub.

2. **El panel de Next** (`apps/web/app`), que es la versión completa de hoy.
   Busca la pantalla equivalente (`apps/web/app/(panel)/<seccion>` o
   `apps/web/app/tpv/config/<seccion>`) y lista **cada** input, select, toggle,
   color e imagen que el usuario puede tocar. Eso es el mínimo a igualar.

3. **La referencia de diseño**: `docs/referencia/09-referencia-configurador-agora/`
   y `docs/referencia/diseno/modelo-de-datos.md`. Dice qué campos tiene el
   configurador de Ágora (nuestro norte) y cuáles están marcados `[NUEVO]` /
   `[propuesta]` = aún sin modelo.

Y si un TPV de hostelería serio (Ágora, Glop, Revo, Lightspeed…) configura algo
que aquí no aparece —jerarquía de subfamilias, horarios por categoría, impresión
por familia—, anótalo en el plan aunque hoy no haya columna: es el mapa de lo que
falta, no se construye a ciegas.

## 2 · La regla de oro: nada que nadie lea

Es la trampa que más caro sale (ver `docs/estado/TRAMPAS.md` y las columnas
write-only de `product`). Para CADA campo que pongas en la pantalla:

- **Tiene columna** → guárdalo.
- **Alguien lo lee** (al vender, imprimir, cobrar, montar la carta) → tiene
  sentido enseñarlo.
- **Se guarda y NADIE lo lee** → es una casilla que engaña. O lo conectas donde
  se consume, o NO lo pones (y lo dejas anotado en el plan).
- **No tiene columna** → migración aditiva primero (skill `gluuh-base-datos`),
  reservando número en `docs/estado/AHORA.md`. Nunca un campo sin dónde guardar.

Un campo de más que no hace nada es peor que uno de menos: el dueño lo marca, se
queda tranquilo, y el bar se comporta igual.

## 3 · Cablear al nodo (el patrón de todas estas pantallas)

- La capa de datos va en un `.ts` aparte (`clasificacion.ts`, `catalogo.ts`,
  `compra.ts`…), NUNCA en el `.tsx`. Usa `leer`/`escribir`/`haySesion`/
  `tenantId` de `lib/nodo`.
- `cargar*()` devuelve `null` si `!haySesion()` → la pantalla se queda con datos
  de EJEMPLO **marcados como tal** («Ejemplo» / aviso). Datos fingidos vendidos
  como reales es peor que nada.
- `tenant_id` es NOT NULL y sin default en todo el catálogo: cada alta lo lleva,
  sacado de `tenantId()` (claim del token). Si no está, se para: fila huérfana
  que la RLS ya no deja ni leer.
- `numeric` llega como **TEXTO** por JSON (`"3.20"`): convertir con `Number`, o
  los precios se suman como cadenas.
- Los ids son **UUID** (`crypto.randomUUID()`), no `art-0007` — reventaría el
  insert.
- **BORRAR NO SE LLEVA MEDIA CARTA.** Al borrar un padre (familia, categoría),
  los hijos NO se borran: se les quita la referencia (`family_id → null`, o se
  borra la fila de la m2m). Verifícalo.
- Verifica el guardado **contra el nodo real** en transacción + rollback antes de
  darlo por bueno (mismo patrón que en los commits de catálogo/compras).

## 4 · La forma (copia el patrón de Productos/Compras)

- `MarcoMantenimiento` con pestañas **Lista ⇄ Ficha**; `pegado` en la Lista.
- La sección y el registro abierto viven en la **URL**
  (`/config/<seccion>/<id>`) — `useRuta`/`navegar`, ver `docs/plan/16`.
- **Pie adaptativo** (tres modos): Lista (Nuevo/Modificar/Eliminar), Consulta
  (recorrer + acciones), Edición (solo Aceptar/Cancelar/Deshacer + badge). Nada
  de un pie fijo con medio botón en gris.
- Consulta ⇄ Modificar: la ficha se ve en solo lectura y hay que pulsar
  «Modificar». Es lo que espera quien viene de Ágora/Glop.
- Sin barras de scroll: `Desplazable`/`Flechas` (se maneja con el dedo).
- Registra la sección en `config/Configuracion.tsx` (PANTALLAS) y ponla
  `funcional: true` en `config/secciones.tsx`.

## 5 · Checklist antes de dar una pantalla por hecha

- [ ] Investigadas las TRES fuentes (BD, Next, referencia) — nada de memoria.
- [ ] Todos los campos que el Next edita están, o justificado por qué no.
- [ ] Ningún campo write-only (todo lo que se guarda, alguien lo lee).
- [ ] Cableada al nodo; sin sesión, demo marcada como ejemplo.
- [ ] Borrar no arrastra a los hijos.
- [ ] Guardado verificado contra el nodo real (transacción + rollback).
- [ ] URL por registro, pie adaptativo, sin barras de scroll.
- [ ] typecheck 0 · tests · lint limpios.
- [ ] Lo que falta modelo (jerarquías, horarios…) anotado en `docs/plan/`.
