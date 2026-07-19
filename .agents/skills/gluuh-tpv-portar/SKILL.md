---
name: gluuh-tpv-portar
description: >-
  OBLIGATORIA antes de crear, reescribir o "mejorar" cualquier pantalla,
  componente o modal del TPV en Vite (apps/tpv). El TPV de Next
  (apps/web/app/tpv) es un trabajo grande de diseño y funcionalidad YA HECHO y es
  la FUENTE DE VERDAD: el de Vite debe ser igual (mejor solo en lo que el usuario
  pida), no una imitación simplificada. Esta skill dice qué leer del original,
  cómo portarlo 1:1, qué adaptar al pasar de Next a Vite y qué NO tocar. Úsala
  siempre que vayas a escribir en apps/tpv algo que ya exista en apps/web/app/tpv
  (Cobrar, Dividir, Modificadores, Menú, Cliente, Utilidades, Ticket, teclado,
  plano de mesas, navbar…). Para el lenguaje de diseño táctil usa
  gluuh-ux-operativa; para el estado del trabajo, docs/estado/AHORA.md.
---

# Portar el TPV de Next → Vite (1:1)

**Regla nº1 de esta skill: NO escribas una línea de una pantalla del TPV en
`apps/tpv` sin haber ABIERTO Y LEÍDO ENTERO su original en `apps/web/app/tpv`.**
El de Next no es un borrador: es diseño + funcionalidad ya pulidos con el
usuario. Reinventarlo "a ojo" produce una imitación peor — y al usuario le cuesta
tiempo y confianza pedir que lo devuelvas al original. Portar ≠ imaginar.

Se creó tras devolver el teclado del modal Cobrar a su verde original después de
"mejorarlo" a neutro sin mirar el Next. Coste: dos reescrituras evitables.

## Antes de tocar (checklist, en orden)

1. **Localiza el original.** `apps/web/app/tpv/` — la página es `page.tsx`; los
   modales/piezas están en `apps/web/app/tpv/components/`; helpers puros en
   `apps/web/app/tpv/*.ts` (p. ej. `efectivo.ts`, `nombres.ts`). Busca por nombre:
   `Glob "apps/web/app/tpv/**/<Algo>*"`.
2. **Léelo ENTERO** con Read (no en trozos): estructura JSX, clases Tailwind
   exactas, colores (`text-success`, `bg-warning`, `bg-brand`…), tamaños
   (`min-h-13`, `text-[17px]`…), estados (`useState`), atajos de teclado, y las
   guardas fiscales/lógicas que trae en comentarios.
3. **Localiza el equivalente en Vite** (`apps/tpv/src/apartados/tpv/...` o
   `apps/tpv/src/ui/...`). Compara. Si ya existe, la tarea suele ser "acercarlo al
   original", no reescribir.
4. **Comprueba los tokens.** Los colores del Next (`text-success`, `bg-cobro`,
   `bg-surface-2`…) tienen que existir en `apps/tpv/src/index.css` (`@theme inline`).
   Si falta uno, defínelo AHÍ — no cambies el color del componente para esquivarlo.
5. **Porta clase por clase.** Copia las mismas utilidades. Si cambias una,
   escribe por qué en una línea. "No me gustó" no vale contra el original.

## Qué SÍ se adapta al pasar de Next a Vite (lo único)

- **`"use client"`**: fuera (Vite no lo usa).
- **Imports**: `@/app/lib/money` → `../../../lib/dinero`; `./ModalTPV` → el
  `Modal`/`CabeceraModal` de `apps/tpv/src/ui`. Las rutas relativas cambian de
  profundidad — cuéntalas.
- **Datos**: en Next llegan por props/servidor; en la demo de Vite salen del store
  `useVenta` y de `datos.ts`. Cablea a esos, pero **respeta la forma** (mismos
  nombres de campo, misma lógica de cálculo).
- **`hover:`**: se ELIMINA (regla del TPV: sin hover, solo `active:`; ver
  gluuh-ux-operativa y las reglas de `apps/tpv/src/index.css`). Es el único caso en
  que quitar clases del original es correcto — porque es una regla explícita del
  proyecto, no un gusto.
- **Sombras**: al mínimo (regla del proyecto). Si el Next abusa de `shadow-*`,
  déjalo en la sombra imprescindible (p. ej. el CTA de dinero) y quita el resto.

## Qué NO se toca (se copia idéntico)

- **Colores y su semántica**: verde = teclado/formas de pago (`text-success`);
  ámbar/`warning` = descuento/propina/CTA cobrar; morado `brand` = visor y acentos;
  naranja `cobro` = único botón Cobrar de la pantalla de venta. No los "unifiques"
  por estética: cada color significa algo (gluuh-ux-operativa, principio 2).
- **Disposición de botones**: memoria muscular. No muevas de sitio lo que el Next
  ya coloca (principio 5).
- **Opciones y textos**: si el Next tiene 31 utilidades, van las 31; si el footer
  tiene Cancelar/Dividir/email/F10/F11/F12, van todos, con sus etiquetas.
- **Lógica fiscal y guardas**: factura completa exige NIF, la tarjeta no da
  cambio, MAX_PAGOS=3, base/impuesto "hacia atrás"… se portan tal cual.

## Después

- `pnpm --filter @gluuh/tpv build` verde antes de commit.
- Commit conventional (`feat(tpv)`/`fix(tpv)`) y **push** (se trabaja desde dos
  sitios; ver AHORA.md).
- Si el original y la copia divergen por decisión del usuario, anótalo (comentario
  en el componente o en `docs/sesiones/`), para que la próxima sesión no "corrija"
  de vuelta.

## Mapa rápido (original → destino)

| Pieza            | Original (Next)                                   | Destino (Vite)                                    |
|------------------|---------------------------------------------------|---------------------------------------------------|
| Página de venta  | `apps/web/app/tpv/page.tsx`                        | `apps/tpv/src/apartados/tpv/*`                     |
| Cobrar           | `.../components/CobrarModal.tsx`                   | `.../tpv/venta/CobrarModal.tsx`                    |
| Dividir cuenta   | `.../components/DividirCuentaModal.tsx`            | (pendiente)                                        |
| Modificadores    | `.../components/ModificadoresModal.tsx`            | (pendiente)                                        |
| Menú             | `.../components/*Menu*.tsx`                        | (pendiente)                                        |
| Cliente          | `.../components/ClienteModal.tsx`                  | `.../tpv/venta/ClienteModal.tsx`                   |
| Utilidades       | `.../components/UtilidadesModal.tsx`               | `.../tpv/venta/UtilidadesModal.tsx`                |
| Helpers efectivo | `apps/web/app/tpv/efectivo.ts`                     | `.../tpv/venta/efectivo.ts`                        |
| Modal contenedor | `.../components/ModalTPV.tsx`                      | `apps/tpv/src/ui/Modal.tsx` + `CabeceraModal.tsx` |

Si una fila dice "(pendiente)", léela del Next y pórtala siguiendo esta skill.
