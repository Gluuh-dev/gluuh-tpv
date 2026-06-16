# Plan 002: Una sola fuente de la verdad para los tipos fiscales (clase × territorio) en `@gluuh/core`

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de continuar. Si ocurre algo de
> "STOP conditions", detente e informa — no improvises. Al terminar, actualiza la fila
> de este plan en `plans/README.md`.
>
> **Drift check (ejecútalo primero)**:
> `git diff --stat 09857da..HEAD -- packages/core/src/fiscal/tax.ts packages/core/src/index.ts apps/web/lib/fiscal-clases.ts supabase/migrations/0012_catalogo_fiscal.sql`
> Si algún fichero en alcance cambió, compara los extractos de "Current state" con el
> código real antes de proceder; si no coinciden, trátalo como STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-tests-impuestos-y-estados.md (debe estar DONE primero)
- **Category**: tech-debt
- **Planned at**: commit `09857da`, 2026-06-15

## Why this matters

Hoy existen **tres** definiciones de los tipos impositivos por clase fiscal y territorio,
y **no coinciden**:

1. `apps/web/lib/fiscal-clases.ts` — `TIPOS_POR_TERRITORIO` (usado en write-time por la web; es lo que se guarda en `product.tipo_impositivo` y acaba en la línea de VERIFACTU).
2. `supabase/migrations/0012_catalogo_fiscal.sql` — tabla `tax_rate` + función `resolver_iva()` (fuente en la BD).
3. `packages/core/src/fiscal/tax.ts` — `TIPOS_IVA`/`TIPOS_IGIC` + `tipoHosteleria()`.

(1) y (2) **coinciden** (p. ej. IGIC REDUCIDO = 3 %). Pero (3) usa otro modelo y
**contradice** los valores: `TIPOS_IGIC.REDUCIDO = 5`. Lo peligroso: en un producto
fiscal, el día que algo consuma `tipoHosteleria()` facturará un tipo equivocado. Hoy
`tipoHosteleria`/`TIPOS_IGIC`/`TIPOS_IVA` **no se usan en ningún sitio** (verificado), así
que son código huérfano divergente.

Este plan consolida la lógica de tipos en `@gluuh/core` (el paquete que existe
precisamente para no duplicar lógica entre plataformas), hace que la web la reexporte, y
elimina el huérfano contradictorio. **Es behavior-preserving en el runtime**: los valores
del path real (modelo clase_fiscal de la web/SQL) se conservan EXACTAMENTE.

## Current state

### Definición de la web (la fuente correcta a centralizar)
```ts
// apps/web/lib/fiscal-clases.ts  (completo)
export const CLASES_FISCALES = [
  { v: "GENERAL", t: "General" },
  { v: "REDUCIDO", t: "Reducido" },
  { v: "SUPERREDUCIDO", t: "Superreducido" },
  { v: "EXENTO", t: "Exento (sin impuesto)" },
] as const;

export const TIPOS_POR_TERRITORIO: Record<string, Record<string, number>> = {
  PENINSULA_BALEARES: { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
  CANARIAS:           { GENERAL: 7,  REDUCIDO: 3,  SUPERREDUCIDO: 0, EXENTO: 0 },
  CEUTA_MELILLA:      { GENERAL: 10, REDUCIDO: 4,  SUPERREDUCIDO: 1, EXENTO: 0 },
  FORAL_PV:           { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
  FORAL_NAVARRA:      { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
};

export function ivaAuto(clase: string, territorio: string): number {
  const t = TIPOS_POR_TERRITORIO[territorio] ?? TIPOS_POR_TERRITORIO.PENINSULA_BALEARES;
  return t[clase] ?? 0;
}
export function nombreImpuesto(territorio: string): string {
  if (territorio === "CANARIAS") return "IGIC";
  if (territorio === "CEUTA_MELILLA") return "IPSI";
  return "IVA";
}
```
Estos valores **deben coincidir** con el seed SQL:
```sql
-- supabase/migrations/0012_catalogo_fiscal.sql:38-43  (mismos números)
('CANARIAS','GENERAL',7),('CANARIAS','REDUCIDO',3),('CANARIAS','SUPERREDUCIDO',0),('CANARIAS','EXENTO',0), ...
```

### Consumidor en la web (sus imports NO deben romperse)
```ts
// apps/web/app/(panel)/carta/page.tsx:11
import { CLASES_FISCALES, ivaAuto, nombreImpuesto } from "@/lib/fiscal-clases";
// ...usa ivaAuto(f.clase, territorio) en carta/page.tsx:134,142 y nombreImpuesto(territorio)
```

### El huérfano a eliminar (en core)
```ts
// packages/core/src/fiscal/tax.ts:21-60  (NADIE fuera de tax.ts importa esto)
export const TIPOS_IVA  = { GENERAL: 21, RESTAURACION: 10, REDUCIDO: 10, SUPERREDUCIDO: 4, CERO: 0 } as const;
export const TIPOS_IGIC = { GENERAL: 7, INCREMENTADO: 15, REDUCIDO: 5, RESTAURACION: 7, CERO: 0 } as const;
export function tipoHosteleria(territorio, regimen, esAlcohol = false): number { /* ... */ }
```
**Lo que NO se toca en `tax.ts`**: `Impuesto`, `IMPUESTO_POR_TERRITORIO`, `LineaFiscal`,
`ResultadoImpuestos`, `redondear`, `calcularImpuestosIncluidos`, `formatImporte`. Esas se quedan.

### Barrel de core
```ts
// packages/core/src/index.ts:13-19
export * from "./domain/types.js";
export * from "./domain/order-state.js";
export * from "./domain/operations.js";
export * from "./fiscal/tax.js";
export * from "./fiscal/verifactu.js";
export * from "./fiscal/qr.js";
export * from "./fiscal/verifactu-xml.js";
```

### Convención de core
- ESM con extensión `.js` en imports (`from "./tax.js"`).
- `noUncheckedIndexedAccess: true` (tsconfig.base) → el acceso por índice devuelve `T | undefined`; maneja el `undefined` (usa `?? 0` como hace `ivaAuto`).
- Tests con Vitest junto al fichero (`*.test.ts`); exemplar: `packages/core/src/domain/operations.test.ts`.

## Commands you will need

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Build de core | `pnpm --filter @gluuh/core build` | exit 0, genera `dist/` |
| Tests de core | `pnpm --filter @gluuh/core test` | todos pasan |
| Typecheck de core | `pnpm --filter @gluuh/core typecheck` | exit 0 |
| Typecheck de web | `pnpm --filter @gluuh/web typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/core/src/fiscal/tax-rates.ts` (crear)
- `packages/core/src/fiscal/tax-rates.test.ts` (crear)
- `packages/core/src/index.ts` (añadir un export)
- `packages/core/src/fiscal/tax.ts` (eliminar SOLO el huérfano: `TIPOS_IVA`, `TIPOS_IGIC`, `tipoHosteleria` y el comentario asociado)
- `apps/web/lib/fiscal-clases.ts` (convertir en reexport de core, manteniendo su API pública)

**Out of scope** (NO tocar):
- `packages/core/src/fiscal/tax.ts` salvo el huérfano indicado — `calcularImpuestosIncluidos` y compañía se quedan idénticas.
- `supabase/migrations/0012_catalogo_fiscal.sql` — la tabla `tax_rate` y `resolver_iva()` siguen siendo la fuente server-side; NO se borran (este plan no migra la BD).
- `apps/web/app/(panel)/carta/page.tsx` y cualquier otro consumidor — sus imports deben seguir funcionando sin cambios.
- El tipo `Territorio` (3 valores) en `domain/types.ts` — no lo amplíes aquí (ver Maintenance notes).

## Git workflow

- Rama: `advisor/002-unificar-tipos-fiscales`
- Conventional commits, p. ej. `refactor(core): centralizar tipos fiscales por clase/territorio`.
- No push ni PR salvo indicación.

## Steps

### Step 0 (bloqueante): confirmar que el huérfano no se usa

```
grep -rn "tipoHosteleria\|TIPOS_IVA\|TIPOS_IGIC" --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v "/dist/"
```
**Esperado**: las únicas coincidencias están dentro de `packages/core/src/fiscal/tax.ts`.
Si aparece CUALQUIER otra (en apps/, packages/*, o tests fuera de tax.ts), **STOP**: alguien
lo consume y eliminarlo rompería ese código — informa antes de seguir.

### Step 1: Crear el módulo autoritativo en core

Crea `packages/core/src/fiscal/tax-rates.ts` con la tabla clase × territorio (mismos
valores exactos que la web/SQL hoy), más `ivaAuto` y `nombreImpuesto`. Forma objetivo:

```ts
/** Clases fiscales y resolución del % por territorio. Fuente única para web/escritorio/móvil. */

export type ClaseFiscal = "GENERAL" | "REDUCIDO" | "SUPERREDUCIDO" | "EXENTO";

/** Territorio fiscal a efectos de tipo impositivo (más amplio que `Territorio` del motor VERIFACTU). */
export type TerritorioFiscal =
  | "PENINSULA_BALEARES" | "CANARIAS" | "CEUTA_MELILLA" | "FORAL_PV" | "FORAL_NAVARRA";

export const CLASES_FISCALES = [
  { v: "GENERAL", t: "General" },
  { v: "REDUCIDO", t: "Reducido" },
  { v: "SUPERREDUCIDO", t: "Superreducido" },
  { v: "EXENTO", t: "Exento (sin impuesto)" },
] as const;

/** % por (territorio, clase). DEBE coincidir con el seed de la tabla SQL `tax_rate`
 *  en supabase/migrations/0012_catalogo_fiscal.sql. */
export const TIPOS_POR_TERRITORIO: Record<string, Record<string, number>> = {
  PENINSULA_BALEARES: { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
  CANARIAS:           { GENERAL: 7,  REDUCIDO: 3,  SUPERREDUCIDO: 0, EXENTO: 0 },
  CEUTA_MELILLA:      { GENERAL: 10, REDUCIDO: 4,  SUPERREDUCIDO: 1, EXENTO: 0 },
  FORAL_PV:           { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
  FORAL_NAVARRA:      { GENERAL: 21, REDUCIDO: 10, SUPERREDUCIDO: 4, EXENTO: 0 },
};

/** % automático según clase fiscal y territorio (cae a PENINSULA_BALEARES si no se reconoce). */
export function ivaAuto(clase: string, territorio: string): number {
  const t = TIPOS_POR_TERRITORIO[territorio] ?? TIPOS_POR_TERRITORIO.PENINSULA_BALEARES!;
  return t[clase] ?? 0;
}

/** Nombre del impuesto según territorio (para mostrar en UI). */
export function nombreImpuesto(territorio: string): string {
  if (territorio === "CANARIAS") return "IGIC";
  if (territorio === "CEUTA_MELILLA") return "IPSI";
  return "IVA";
}
```
(Mantén `Record<string, Record<string, number>>` para no romper a los llamadores que
pasan `string`. El `!` tras `PENINSULA_BALEARES` es por `noUncheckedIndexedAccess`.)

**Verify**: `pnpm --filter @gluuh/core typecheck` → exit 0.

### Step 2: Exportar el módulo desde el barrel

En `packages/core/src/index.ts` añade, junto a los demás `export *` de `fiscal/`:
```ts
export * from "./fiscal/tax-rates.js";
```
**Verify**: `pnpm --filter @gluuh/core build` → exit 0 y `dist/index.d.ts` contiene `ivaAuto`
(`grep -n "ivaAuto" packages/core/dist/index.d.ts` → al menos una coincidencia).

### Step 3: Eliminar el huérfano de `tax.ts`

En `packages/core/src/fiscal/tax.ts`, elimina **solo** `TIPOS_IVA` (líneas ~21-28),
`TIPOS_IGIC` (~30-37) y la función `tipoHosteleria` (~39-60) con su bloque de comentario.
Si `RegimenConsumo` quedara importado pero sin usar tras esto, elimina ese import.
**No toques** nada más del fichero.

**Verify**:
- `grep -rn "tipoHosteleria\|TIPOS_IVA\|TIPOS_IGIC" packages/core/src` → **sin coincidencias**.
- `pnpm --filter @gluuh/core typecheck` → exit 0 (sin "unused import" ni referencias rotas).

### Step 4: Convertir `fiscal-clases.ts` de la web en reexport de core

Reescribe `apps/web/lib/fiscal-clases.ts` para que reexporte de `@gluuh/core` sin
redeclarar valores (así desaparece la divergencia):
```ts
/** Clases fiscales y resolución del tipo por territorio. Fuente única: @gluuh/core. */
export { CLASES_FISCALES, TIPOS_POR_TERRITORIO, ivaAuto, nombreImpuesto } from "@gluuh/core";
export type { ClaseFiscal, TerritorioFiscal } from "@gluuh/core";
```
Los consumidores (`carta/page.tsx` importa `CLASES_FISCALES, ivaAuto, nombreImpuesto`
desde `@/lib/fiscal-clases`) siguen funcionando sin cambios.

**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 5: Test de coherencia de valores

Crea `packages/core/src/fiscal/tax-rates.test.ts` (modela sobre `operations.test.ts`).
Cubre:
1. `ivaAuto("REDUCIDO","CANARIAS")` → `3`; `ivaAuto("GENERAL","CANARIAS")` → `7`;
   `ivaAuto("GENERAL","PENINSULA_BALEARES")` → `21`; `ivaAuto("EXENTO","CANARIAS")` → `0`.
2. Territorio desconocido cae a PENINSULA_BALEARES: `ivaAuto("GENERAL","ZZZ")` → `21`.
3. Clase desconocida → `0`: `ivaAuto("NOPE","CANARIAS")` → `0`.
4. `nombreImpuesto`: CANARIAS→"IGIC", CEUTA_MELILLA→"IPSI", PENINSULA_BALEARES→"IVA", FORAL_PV→"IVA".
5. **Guardia anti-deriva con el seed SQL**: incluye en el test, como literal, el conjunto
   de valores esperados para CANARIAS `{GENERAL:7,REDUCIDO:3,SUPERREDUCIDO:0,EXENTO:0}` y
   compáralos con `TIPOS_POR_TERRITORIO.CANARIAS`. Añade un comentario:
   `// Si cambias estos valores, actualiza también supabase/migrations/0012_catalogo_fiscal.sql (tabla tax_rate).`

**Verify**: `pnpm --filter @gluuh/core test` → todos pasan, incluido `tax-rates.test.ts`.

## Test plan

- Nuevo: `packages/core/src/fiscal/tax-rates.test.ts` (5 grupos arriba).
- Los tests del Plan 001 sobre `calcularImpuestosIncluidos` deben **seguir pasando sin cambios**
  (esa función no se toca) — es la verificación de que el refactor es behavior-preserving.
- Patrón estructural: `packages/core/src/domain/operations.test.ts`.
- Verificación global: `pnpm --filter @gluuh/core test && pnpm --filter @gluuh/web typecheck`.

## Done criteria

ALL deben cumplirse:

- [ ] `pnpm --filter @gluuh/core build` exit 0.
- [ ] `pnpm --filter @gluuh/core test` exit 0; existe y pasa `tax-rates.test.ts`.
- [ ] `pnpm --filter @gluuh/core typecheck` exit 0 y `pnpm --filter @gluuh/web typecheck` exit 0.
- [ ] `grep -rn "tipoHosteleria\|TIPOS_IVA\|TIPOS_IGIC" packages/core/src` → sin coincidencias.
- [ ] `apps/web/lib/fiscal-clases.ts` ya no declara `TIPOS_POR_TERRITORIO` con literales (solo reexporta): `grep -c "21\|GENERAL: " apps/web/lib/fiscal-clases.ts` → 0.
- [ ] Solo ficheros en la lista "In scope" modificados (`git status`).
- [ ] Fila de estado actualizada en `plans/README.md`.

## STOP conditions

Detente e informa si:

- Step 0 encuentra usos de `tipoHosteleria`/`TIPOS_IVA`/`TIPOS_IGIC` fuera de `tax.ts`.
- Los extractos de "Current state" no coinciden con el código real (deriva).
- Al convertir `fiscal-clases.ts` en reexport, el typecheck de web falla por un símbolo que
  el reexport no cubre (algún consumidor importa algo más de ese fichero) — informa qué falta.
- Descubres que el valor de IGIC REDUCIDO en la web/SQL (3 %) y el de core (5 %) **no** son
  un huérfano sino que ambos se usan en runtime: en ese caso es una decisión fiscal, no un
  refactor mecánico — para e informa.

## Maintenance notes

- **Deuda relacionada NO resuelta aquí**: la tabla SQL `tax_rate` (migración 0012) sigue
  siendo una cuarta copia de los mismos números. El test del Step 5 vigila la deriva, pero
  lo ideal a futuro es generar el seed SQL desde el módulo de core o un test que lea ambos.
- **`Territorio` (3) vs `TerritorioFiscal` (5)**: el motor VERIFACTU (`calcularImpuestosIncluidos`,
  `IMPUESTO_POR_TERRITORIO`) solo conoce 3 territorios; los forales (FORAL_PV/NAVARRA) usan IVA
  pero no están en `IMPUESTO_POR_TERRITORIO`. Pasar un territorio foral a `calcularImpuestosIncluidos`
  daría `impuesto` undefined. Es un hueco preexistente, fuera de alcance; documéntalo si lo tocas.
- Para el revisor: confirmar que ningún valor de runtime cambió (los % del modelo clase_fiscal
  son idénticos a antes) y que la web compila importando desde el reexport.
