# Plan 001: Cubrir con tests el cálculo de impuestos y la máquina de estados de comanda

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de pasar al siguiente paso.
> Si ocurre algo de la sección "STOP conditions", detente e informa — no improvises.
> Al terminar, actualiza la fila de estado de este plan en `plans/README.md`.
>
> **Drift check (ejecútalo primero)**:
> `git diff --stat 09857da..HEAD -- packages/core/src/fiscal/tax.ts packages/core/src/domain/order-state.ts`
> Si alguno de esos ficheros cambió desde que se escribió este plan, compara los
> extractos de "Current state" con el código real antes de continuar; si no
> coinciden, trátalo como STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `09857da`, 2026-06-15

## Why this matters

Este es un producto de TPV con cumplimiento fiscal (VERIFACTU/IGIC). El cálculo de
impuestos (`calcularImpuestosIncluidos`) atraviesa **cada venta** de todas las
plataformas, y la máquina de estados de la comanda (`order-state.ts`) es el audit
trail que la normativa exige inalterable. Hoy **ninguna de las dos tiene tests**: un
error de redondeo de céntimos o una transición ilegal (p. ej. reabrir una comanda ya
cobrada) pasaría sin detección. Estos tests son baratos, sin riesgo, y son la red de
seguridad que habilita el refactor del Plan 002.

## Current state

- `packages/core/src/fiscal/tax.ts` — motor de impuestos. La función a testear:
  ```ts
  // packages/core/src/fiscal/tax.ts:85-112
  export function calcularImpuestosIncluidos(
    lineas: LineaFiscal[],
    territorio: Territorio,
  ): ResultadoImpuestos {
    const porTipo = new Map<number, { base: number; cuota: number; importe: number }>();
    for (const l of lineas) {
      const base = redondear(l.importe / (1 + l.tipo / 100));
      const cuota = redondear(l.importe - base);
      // ...acumula por tipo...
    }
    // desglose ordenado por tipo asc; baseTotal/cuotaTotal/importeTotal sumados
  }
  ```
  - `LineaFiscal = { importe: number; tipo: number }` (importe lleva impuesto INCLUIDO).
  - `ResultadoImpuestos = { impuesto, desglose: {tipo,base,cuota,importe}[], baseTotal, cuotaTotal, importeTotal }`.
  - `redondear` redondea a 2 decimales (`tax.ts:78`).
  - `Territorio = "PENINSULA_BALEARES" | "CANARIAS" | "CEUTA_MELILLA"` (`domain/types.ts:10`).
  - `IMPUESTO_POR_TERRITORIO` mapea PENINSULA_BALEARES→"IVA", CANARIAS→"IGIC", CEUTA_MELILLA→"IPSI" (`tax.ts:15-19`).

- `packages/core/src/domain/order-state.ts` — máquina de estados. Estado actual completo:
  ```ts
  // packages/core/src/domain/order-state.ts:16-23
  export const TRANSICIONES: Record<EstadoComanda, readonly EstadoComanda[]> = {
    ABIERTA: ["ENVIADA_COCINA", "POR_COBRAR", "ANULADA"],
    ENVIADA_COCINA: ["SERVIDA", "POR_COBRAR", "ANULADA"],
    SERVIDA: ["POR_COBRAR", "ANULADA"],
    POR_COBRAR: ["COBRADA", "ABIERTA", "ANULADA"],
    COBRADA: [],   // estado final
    ANULADA: [],   // estado final
  };
  // puedeTransicionar(desde, hacia) -> boolean
  // transicionar(desde, hacia) -> EstadoComanda | throws TransicionInvalidaError
  // esEstadoFinal(estado) -> boolean (true si no hay transiciones salientes)
  ```

### Convención de tests (síguela)

Los tests del repo usan **Vitest** y viven **junto al fichero** que prueban, con
sufijo `.test.ts`. Las importaciones usan extensión `.js` (ESM). Modela los nuevos
tests sobre este exemplar existente:

```ts
// packages/core/src/domain/operations.test.ts:1-19
import { describe, it, expect } from "vitest";
import { generaFactura, implicaCobro, PREPARACION_SIGUIENTE, type TipoOperacion } from "./operations.js";

describe("Tipos de operación — solo la VENTA factura", () => {
  it("solo VENTA genera factura y cobro", () => {
    /* ... expect(...).toBe(...) ... */
  });
});
```

No hay fichero de configuración de Vitest; descubre automáticamente los `*.test.ts`.

## Commands you will need

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Tests de core | `pnpm --filter @gluuh/core test` | todos pasan (hoy 12; tras este plan, más) |
| Typecheck de core | `pnpm --filter @gluuh/core typecheck` | exit 0, sin errores |

## Scope

**In scope** (los únicos ficheros que debes crear/modificar):
- `packages/core/src/fiscal/tax.test.ts` (crear)
- `packages/core/src/domain/order-state.test.ts` (crear)

**Out of scope** (NO tocar):
- `packages/core/src/fiscal/tax.ts` — solo se testea, no se modifica (eso es el Plan 002).
- `packages/core/src/domain/order-state.ts` — solo se testea.
- `packages/core/src/fiscal/tax.ts` funciones `tipoHosteleria`/`TIPOS_IVA`/`TIPOS_IGIC` — **NO** escribas tests para ellas: el Plan 002 las va a eliminar. Testear solo `calcularImpuestosIncluidos` y `formatImporte`.

## Git workflow

- Rama: `advisor/001-tests-impuestos-y-estados`
- Estilo de commit: conventional commits (el repo los usa, p. ej. `test(core): ...`). Ejemplo del log: `feat(catalogo): familias + clase fiscal...`.
- No hagas push ni abras PR salvo que el operador lo indique.

## Steps

### Step 1: Tests de `calcularImpuestosIncluidos` y `formatImporte`

Crea `packages/core/src/fiscal/tax.test.ts`. Importa desde `./tax.js`. Cubre estos
casos (los valores esperados ya están calculados y verificados — úsalos tal cual):

1. **IVA hostelería 10 %, una línea** (PENINSULA_BALEARES): `lineas=[{importe:11.00,tipo:10}]`
   → `impuesto="IVA"`, desglose `[{tipo:10,base:10.00,cuota:1.00,importe:11.00}]`,
   `baseTotal=10.00`, `cuotaTotal=1.00`, `importeTotal=11.00`.
2. **IGIC 7 %, una línea** (CANARIAS): `lineas=[{importe:10.70,tipo:7}]`
   → `impuesto="IGIC"`, desglose `[{tipo:7,base:10.00,cuota:0.70,importe:10.70}]`.
3. **Multi-tipo en un ticket** (CANARIAS, 7 % + 15 %): `lineas=[{importe:10.70,tipo:7},{importe:11.50,tipo:15}]`
   → desglose ordenado por tipo asc: `[{tipo:7,base:10.00,cuota:0.70},{tipo:15,base:10.00,cuota:1.50}]`,
   `baseTotal=20.00`, `cuotaTotal=2.20`, `importeTotal=22.20`.
4. **Agrupación de líneas del mismo tipo**: `lineas=[{importe:11.00,tipo:10},{importe:5.50,tipo:10}]` (PENINSULA_BALEARES)
   → desglose con **una sola** entrada: `[{tipo:10,base:15.00,cuota:1.50,importe:16.50}]`.
5. **Lista vacía**: `lineas=[]` → `desglose=[]`, `baseTotal=0`, `cuotaTotal=0`, `importeTotal=0`.
6. **Invariante por grupo**: para cualquier desglose, `base + cuota` debe ser igual a
   `importe` de ese grupo (usa `toBeCloseTo` con 2 decimales si lo prefieres, o `toBe`
   con los valores exactos de arriba).
7. **`formatImporte`**: `formatImporte(10)` → `"10.00"`; `formatImporte(1.5)` → `"1.50"`;
   `formatImporte(0)` → `"0.00"`.

**Verify**: `pnpm --filter @gluuh/core test` → todos pasan, incluyendo el nuevo fichero `tax.test.ts`.

### Step 2: Tests de la máquina de estados (`order-state.ts`)

Crea `packages/core/src/domain/order-state.test.ts`. Importa desde `./order-state.js`
(`puedeTransicionar`, `transicionar`, `esEstadoFinal`, `TransicionInvalidaError`, `TRANSICIONES`, `type EstadoComanda`). Cubre:

1. **Transiciones válidas**: para cada estado, `puedeTransicionar(estado, destino)` es `true`
   exactamente para los destinos listados en `TRANSICIONES`. (Itera sobre las entradas de `TRANSICIONES`.)
2. **Transición ilegal crítica**: `puedeTransicionar("COBRADA", "ABIERTA")` → `false`; y
   `transicionar("COBRADA", "ABIERTA")` lanza `TransicionInvalidaError`.
3. **Reapertura legítima antes de cobrar**: `puedeTransicionar("POR_COBRAR", "ABIERTA")` → `true`.
4. **`transicionar` válido** devuelve el estado destino: `transicionar("ABIERTA","ENVIADA_COCINA")` → `"ENVIADA_COCINA"`.
5. **`transicionar` inválido** lanza `TransicionInvalidaError` (usa `expect(() => ...).toThrow(TransicionInvalidaError)`)
   y la instancia tiene `.desde` y `.hacia` correctos.
6. **Estados finales**: `esEstadoFinal("COBRADA")` y `esEstadoFinal("ANULADA")` → `true`;
   `esEstadoFinal("ABIERTA")` → `false`.

**Verify**: `pnpm --filter @gluuh/core test` → todos pasan, incluyendo `order-state.test.ts`.

## Test plan

- Nuevos ficheros: `packages/core/src/fiscal/tax.test.ts` y `packages/core/src/domain/order-state.test.ts`.
- Casos: los 7 de tax + los 6 de order-state listados arriba.
- Patrón estructural: modela sobre `packages/core/src/domain/operations.test.ts`.
- Verificación: `pnpm --filter @gluuh/core test` → todos pasan; el recuento de tests aumenta respecto a los 12 actuales.

## Done criteria

ALL deben cumplirse:

- [ ] `pnpm --filter @gluuh/core test` exit 0; existen y pasan `tax.test.ts` y `order-state.test.ts`.
- [ ] `pnpm --filter @gluuh/core typecheck` exit 0.
- [ ] No se modificó `tax.ts` ni `order-state.ts` (`git status` solo muestra los dos `.test.ts` nuevos).
- [ ] Fila de estado de este plan actualizada en `plans/README.md`.

## STOP conditions

Detente e informa si:

- Los extractos de "Current state" no coinciden con el código real (deriva del repo).
- Un test que escribiste según los valores dados falla y, al inspeccionar, el código
  produce un resultado distinto al esperado documentado aquí: **NO ajustes el test para
  que pase a ciegas** — puede ser un bug real en `tax.ts`. Informa con el valor obtenido vs. esperado.
- `calcularImpuestosIncluidos` o `order-state.ts` ya tienen un `.test.ts` (otro trabajo solapado).

## Maintenance notes

- Para el revisor: confirma que los valores esperados de impuestos son los que dicta el
  redondeo "hacia atrás" desde el PVP (base = importe / (1 + tipo/100)), no inventados.
- El Plan 002 reorganiza los tipos fiscales; estos tests de `calcularImpuestosIncluidos`
  NO deberían cambiar (esa función no se toca). Si 002 los rompe, es señal de regresión.
