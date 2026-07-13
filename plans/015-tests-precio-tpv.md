# Plan 015: Red de tests del camino del dinero del TPV (extraer `precio.ts` puro + vitest en apps/web)

> **Instrucciones para el ejecutor**: sigue este plan paso a paso, verifica cada
> paso, respeta las "Condiciones de STOP" y actualiza tu fila en
> `plans/README.md` al terminar.
>
> **Comprobación de deriva (ejecutar primero)**:
> `git diff --stat 9c959d1..HEAD -- apps/web/app/tpv/`
> Plan escrito contra el árbol de trabajo del 2026-07-11 **asumiendo el plan 010
> aplicado** (existe `prodPorId: Map` en `page.tsx`). Si 011-013 también se
> aplicaron, los números de línea habrán bajado/subido — compara por contenido.

## Estado

- **Prioridad**: P2
- **Esfuerzo**: M
- **Riesgo**: MED (mueve el cálculo de precio a un módulo; mitigado por tests de caracterización primero)
- **Depende de**: `plans/010-indice-catalogo-o1.md`
- **Categoría**: tests
- **Planificado en**: commit `9c959d1` (+ working tree), 2026-07-11

## Por qué importa

Lo que se le cobra al cliente — `precioEfectivo` (peso, formato, precio manual,
suplementos de modificadores, DTO %/€ con clamps a 0) — vive como closure dentro
del componente de 2755 líneas y **no tiene ni un test**. El único helper extraído
(`clave-linea.ts`) trae un auto-check `demo()` que ningún runner ejecuta: es
verificación muerta. `packages/core` demuestra el estándar de la casa (vector
oficial AEAT en vitest); este plan lleva ese estándar al motor de precios del
TPV: primero tests de caracterización del comportamiento actual, luego la
extracción a módulo puro. Además deja `pnpm test` cubriendo `apps/web` (hoy
"tests verdes" = solo core).

## Estado actual

- `apps/web/app/tpv/page.tsx:501-521` — el cálculo a extraer (tras el plan 010,
  `catalogoConMenus.find` ya es `prodPorId.get`):
  ```ts
  const precioEfectivo = useMemo(() => (id: string): number => {
    const [pid, fid, mods] = claveBase(id).split("|");
    const prod = /* prodPorId.get(pid!) tras 010 */;
    if (!prod) return 0;
    let calc: number;
    if (fid?.startsWith("@")) calc = prod.precio * (parseFloat(fid.slice(1)) || 0);   // €/kg × peso
    else {
      const fmt = fid ? (formatos[pid!] ?? []).find((f) => f.id === fid) : undefined;
      calc = fmt ? fmt.precio : prod.precio;
    }
    let base = preciosManuales[id] ?? calc;
    if (mods) for (const m of mods.split(",")) base += modById[m]?.precio_extra ?? 0;
    const desc = descuentos[id];
    if (!desc) return base;
    if (desc.tipo === "PCT") return Math.max(0, base * (1 - desc.valor / 100));
    return Math.max(0, base - desc.valor);
  }, [/* deps */]);
  ```
- `apps/web/app/tpv/clave-linea.ts` — módulo puro ya extraído, con `demo()`
  basado en asserts (líneas 44-89) que hoy no corre en ningún sitio.
- `apps/web/package.json` — NO tiene script `test` (por eso `turbo run test` lo
  salta). `packages/core/package.json` es el patrón: `"test": "vitest run"`,
  devDependency `"vitest": "^4.1.9"`, tests junto al fichero con sufijo `.test.ts`.
- Ejemplar de estilo de test: `packages/core/src/fiscal/tax.test.ts`
  (describe/it/expect, casos con valores exactos en euros).
- Tipos que necesita el módulo extraído (ya exportados):
  `Prod`, `Formato`, `ModOpcion` desde `apps/web/app/lib/catalogo-store.ts`;
  `claveBase` desde `apps/web/app/tpv/clave-linea.ts`;
  el tipo local `ModoDescuento = { tipo: "PCT" | "EUR"; valor: number }`
  (está duplicado en `page.tsx:89` y `hooks/useTpvStore.ts:3` — usa el del store).

## Comandos necesarios

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Tests web | `pnpm --filter @gluuh/web test` | todos pasan |
| Tests monorepo | `pnpm test` | core + web pasan |
| Typecheck | `pnpm --filter @gluuh/web typecheck` | exit 0 |

## Ámbito

**Dentro**:
- `apps/web/package.json` (script `test` + devDependency `vitest`)
- `apps/web/vitest.config.ts` (crear, mínimo)
- `apps/web/app/tpv/precio.ts` (crear)
- `apps/web/app/tpv/precio.test.ts` (crear)
- `apps/web/app/tpv/clave-linea.test.ts` (crear)
- `apps/web/app/tpv/page.tsx` (solo: `precioEfectivo` delega en el módulo)
- `apps/web/app/tpv/clave-linea.ts` (solo: borrar `demo()` una vez portado)

**Fuera** (NO tocar):
- `desgloseCobro`, `total`, `cobrar` — extraerlos es continuación natural, no
  parte de este plan.
- `packages/core` y su suite.
- Cualquier componente o el store.

## Flujo git

- Rama: `advisor/015-tests-precio`.
- Commits: `test(web): vitest + caracterización de precioEfectivo`,
  `refactor(tpv): precioEfectivo extraído a precio.ts (puro)`.

## Pasos

### Paso 1: vitest en apps/web

1. `apps/web/package.json`: añade `"test": "vitest run"` a scripts y
   `"vitest": "^4.1.9"` a devDependencies (misma major que core).
2. Crea `apps/web/vitest.config.ts`:
   ```ts
   import { defineConfig } from "vitest/config";
   // Solo módulos puros (lógica de TPV). Nada de jsdom ni componentes: los
   // ficheros bajo test no importan React.
   export default defineConfig({ test: { include: ["app/**/*.test.ts"] } });
   ```
3. `pnpm install`.

**Verificar**: `pnpm --filter @gluuh/web test` → "no test files found" aún es
aceptable en este punto SOLO si vitest sale con código 0; si falla por "no
tests", añade primero el paso 2 y verifica entonces.

### Paso 2: portar `demo()` de clave-linea a un test real

Crea `apps/web/app/tpv/clave-linea.test.ts` transcribiendo los asserts de
`demo()` (clave-linea.ts:44-89) a `describe/it/expect` — un `it` por bloque:
fusión normal, no-contagio de descuento (`p` → dto → `p#2`), `claveBase`,
`claveDeLinea` ordena mods. Después borra `demo()` de `clave-linea.ts` (y su
comentario de cabecera sobre cómo ejecutarla).

**Verificar**: `pnpm --filter @gluuh/web test` → 1 fichero, todos los tests pasan.

### Paso 3: caracterizar `precioEfectivo` ANTES de extraerlo

Crea `apps/web/app/tpv/precio.test.ts` contra el módulo AÚN INEXISTENTE
`./precio` (TDD de caracterización: el paso 4 lo hace compilar). Fixture mínima:

```ts
const prod = (id: string, precio: number): Prod => ({ id, nombre: id, precio, tipo_impositivo: 10, category_id: null, estacion: "COCINA", foto_url: null, agotado_hasta: null, vendido_por_peso: false });
const ctx = {
  prodPorId: new Map([["cafe", prod("cafe", 1.5)], ["jamon", prod("jamon", 60)]]),
  formatos: { cafe: [{ id: "f1", product_id: "cafe", nombre: "Doble", precio: 2.2 }] },
  modById: { extra1: { id: "extra1", nombre: "Sirope", precio_extra: 0.5 } },
  preciosManuales: {} as Record<string, number>,
  descuentos: {} as Record<string, ModoDescuento>,
};
```

Casos (valores exactos, estilo `tax.test.ts`):
1. Base: `precioEfectivo(ctx, "cafe")` → 1.5.
2. Formato: `"cafe|f1"` → 2.2. Formato inexistente `"cafe|fX"` → 1.5 (cae al precio base — comportamiento actual).
3. Peso: `"jamon|@0.250"` → 15. Peso ilegible `"jamon|@abc"` → 0 (`parseFloat||0` actual).
4. Modificadores: `"cafe|f1|extra1,extra1"` → 3.2 (2 uds del extra suman).
5. Precio manual: ctx con `preciosManuales: { "cafe": 1 }` → 1; con mods, el manual sustituye la BASE y los extras se suman encima (`"cafe||extra1"` con manual 1 → 1.5).
6. DTO %: 50 % sobre 2 → 1; DTO € mayor que la base → 0 (clamp).
7. Sufijo `#n`: `"cafe#2"` → 1.5 (la clave única no altera el precio) PERO el
   precio manual/descuento se busca por la clave COMPLETA (`preciosManuales["cafe#2"]`), no la base — replica el código: `preciosManuales[id]` usa `id` sin `claveBase`.
8. Producto desconocido: `"nope"` → 0.

**Verificar**: `pnpm --filter @gluuh/web test` → los tests de precio FALLAN por
módulo inexistente (rojo esperado).

### Paso 4: extraer `precio.ts` y delegar

1. Crea `apps/web/app/tpv/precio.ts`:
   ```ts
   // Precio efectivo de una línea de comanda (puro, testeable): peso/formato +
   // suplementos de modificadores + precio manual y descuento por línea.
   // Extraído de app/tpv/page.tsx (plan 015); el componente le pasa su contexto.
   import { claveBase } from "./clave-linea";
   import type { Prod, Formato, ModOpcion } from "../lib/catalogo-store";
   import type { ModoDescuento } from "./hooks/useTpvStore";

   export interface CtxPrecio {
     prodPorId: Map<string, Prod>;
     formatos: Record<string, Formato[]>;
     modById: Record<string, ModOpcion>;
     preciosManuales: Record<string, number>;
     descuentos: Record<string, ModoDescuento>;
   }

   export function precioEfectivo(ctx: CtxPrecio, id: string): number {
     // …cuerpo IDÉNTICO al del useMemo de page.tsx:501-521, con ctx.* …
   }
   ```
   (Si `ModoDescuento` no está exportado en `useTpvStore.ts`, expórtalo — ya es
   `export type` en la línea 3.)
2. En `page.tsx`, el `useMemo` queda en una línea:
   ```ts
   const precioEfectivo = useMemo(() => {
     const ctx = { prodPorId, formatos, modById, preciosManuales, descuentos };
     return (id: string) => precioEfectivoPuro(ctx, id);
   }, [prodPorId, formatos, modById, preciosManuales, descuentos]);
   ```
   (import con alias: `import { precioEfectivo as precioEfectivoPuro } from "./precio";`).
3. Borra el cuerpo antiguo del cálculo en `page.tsx`.

**Verificar**: `pnpm --filter @gluuh/web test` → TODO verde (caracterización
cumplida); `pnpm --filter @gluuh/web typecheck` → exit 0; `pnpm test` (raíz) →
core + web verdes.

### Paso 5: humo en el TPV

1. Producto simple, con formato, por peso (si la carta demo tiene) y con
   modificadores → mismos precios que antes en línea y total.
2. DTO% / DTO€ / precio manual sobre una línea → mismos resultados.

## Plan de tests

Es el plan de tests. Modelo estructural: `packages/core/src/fiscal/tax.test.ts`.
Cobertura resultante: `claveDeLinea`/`claveParaAnadir`/`claveBase` (portado de
`demo()`) + `precioEfectivo` (8 casos del paso 3). Deuda anotada, no incluida:
`desgloseCobro` y el reparto de pagos de `cobrarDesdeModal`.

## Criterios de hecho

- [ ] `pnpm --filter @gluuh/web test` exit 0 con ≥12 tests en 2 ficheros
- [ ] `pnpm test` (raíz, vía turbo) ejecuta core Y web, todo verde
- [ ] `pnpm --filter @gluuh/web typecheck` exit 0
- [ ] `grep -n "demo()" apps/web/app/tpv/clave-linea.ts` → 0 resultados
- [ ] `grep -c "catalogoConMenus\|prodPorId" apps/web/app/tpv/precio.ts` → el módulo NO importa el store ni React (puro)
- [ ] Humo del paso 5 sin diferencias
- [ ] Solo los 7 ficheros del ámbito modificados (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## Condiciones de STOP

- El plan 010 no está aplicado (sin `prodPorId` la extracción cambia de forma).
- Algún caso de caracterización del paso 3 revela un valor que te parece un BUG
  (p. ej. el peso ilegible → 0): NO lo "arregles" — el test documenta el
  comportamiento actual; anota la duda en el reporte.
- El humo del paso 5 difiere de los tests (señal de contexto mal cableado).

## Notas de mantenimiento

- Siguiente extracción natural con la misma técnica: `desgloseCobro`
  (page.tsx:533-543) y `nombreDeKey`/`nombreBaseDeKey` → el mismo `precio.ts` o
  un `nombres.ts` hermano.
- El plan 011 asume que `precioEfectivo` sigue siendo una función estable por
  render — la delegación del paso 4 lo mantiene.
- Revisor: los tests deben afirmar VALORES exactos (céntimos), no `toBeCloseTo`
  salvo justificación — el cálculo actual es aritmética simple sin redondeo.
