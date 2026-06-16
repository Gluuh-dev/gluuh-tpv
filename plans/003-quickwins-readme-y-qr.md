# Plan 003: Quick wins — corregir el puerto del README y revisar el encoding del QR VERIFACTU

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada verificación y
> confirma el resultado esperado antes de continuar. Si ocurre algo de "STOP conditions",
> detente e informa — no improvises. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Drift check (ejecútalo primero)**:
> `git diff --stat 09857da..HEAD -- README.md packages/core/src/fiscal/verifactu.ts packages/core/src/fiscal/verifactu.test.ts apps/web/package.json`
> Si algún fichero en alcance cambió, compara los extractos con el código real; si no
> coinciden, trátalo como STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (Paso 1) / MED (Paso 2 — toca lógica fiscal; ver abajo)
- **Depends on**: none
- **Category**: docs + bug
- **Planned at**: commit `09857da`, 2026-06-15

## Why this matters

Dos arreglos pequeños e independientes:

1. **Puerto del README**: el README dice que la web corre en `localhost:3000`, pero el
   script de dev usa `-p 3100`. Un desarrollador nuevo abre 3000, no ve nada y se frustra.
   Arreglo trivial y sin riesgo.
2. **Encoding del QR VERIFACTU**: `construirUrlQR` concatena los parámetros sin
   `encodeURIComponent`. Hoy es inocuo (NIF/serie/fecha/importe son formatos restringidos),
   pero un carácter inesperado produciría un QR de cotejo malformado. **OJO**: el test del
   **vector oficial de la AEAT** afirma deliberadamente que el `/` del nº de serie va **sin
   codificar**, y el comentario del código lo justifica citando la especificación. Por eso
   el Paso 2 es **una investigación con decisión**, no un "envolver en encodeURIComponent"
   a ciegas — eso rompería el vector oficial y posiblemente la validación de la AEAT.

## Current state

### Paso 1 — puerto
```
README.md:84  →  #   /tpv  /kiosko  /kds  /pantalla  /ofertas   (en http://localhost:3000)
apps/web/package.json:7  →  "dev": "next dev -p 3100",
```

### Paso 2 — QR
```ts
// packages/core/src/fiscal/verifactu.ts:109-117
export function construirUrlQR(i: QRInput): string {
  const base = URL_COTEJO_AEAT[i.entorno ?? "produccion"];
  const query =
    `nif=${i.nif}` +
    `&numserie=${i.numSerieFactura}` +
    `&fecha=${i.fechaExpedicion}` +
    `&importe=${i.importeTotal}`;
  return `${base}?${query}`;
}
```
El comentario inmediatamente anterior (`verifactu.ts:101-108`) dice: *"La AEAT documenta los
parámetros sin codificar el separador '/' del número de serie, por lo que se interpolan
directamente para reproducir el formato oficial."*

El test que **bloquea** un cambio ingenuo:
```ts
// packages/core/src/fiscal/verifactu.test.ts:44-55
it("genera la URL de cotejo del QR (entorno de pruebas)", () => {
  const url = construirUrlQR({ nif:"89890001K", numSerieFactura:"12345678/G33",
    fechaExpedicion:"01-01-2024", importeTotal:"241.4", entorno:"pruebas" });
  expect(url).toBe(
    "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678/G33&fecha=01-01-2024&importe=241.4",
  );
});
```
Es decir: el `/` de `12345678/G33` **debe** quedar literal según este vector. `encodeURIComponent("12345678/G33")` daría `12345678%2FG33`, rompiendo el test.

## Commands you will need

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Tests de core | `pnpm --filter @gluuh/core test` | todos pasan |
| Typecheck de core | `pnpm --filter @gluuh/core typecheck` | exit 0 |

## Scope

**In scope**:
- `README.md` (Paso 1)
- `packages/core/src/fiscal/verifactu.ts` (Paso 2, solo si procede tras investigar)
- `packages/core/src/fiscal/verifactu.test.ts` (Paso 2, si se añade caso de borde)

**Out of scope**:
- `apps/web/package.json` — el puerto 3100 es intencional (commit lo fijó); NO lo cambies a 3000.
- La lógica de la huella (`construirCadenaHuella`/`calcularHuella`) — el encoding del QR es
  independiente de la huella; NO toques la cadena de la huella.

## Git workflow

- Rama: `advisor/003-quickwins-readme-y-qr`
- Conventional commits, p. ej. `docs: corregir puerto de la web (3100)` y `fix(core): ...`.
- No push ni PR salvo indicación.

## Steps

### Step 1: Corregir el puerto en el README (hazlo)

En `README.md:84`, cambia `http://localhost:3000` por `http://localhost:3100`.
Revisa que no haya otras menciones a `localhost:3000` para la web: `grep -n "localhost:3000" README.md`.
(Si aparece en contexto del backend/api, déjalo: el api usa `PORT=3001`; solo la web es 3100.)

**Verify**: `grep -n "localhost:3100" README.md` → al menos 1 coincidencia; y la línea 84 ya no dice 3000.

### Step 2: QR — investigar y decidir (NO cambies a ciegas)

El objetivo es robustez sin romper cumplimiento. Procede así:

1. Lee el comentario `verifactu.ts:101-108` y el test `verifactu.test.ts:44-55`. Confirma
   que el formato oficial mantiene `/` literal en `numserie`.
2. **Decisión por defecto (segura)**: NO uses `encodeURIComponent` global. En su lugar,
   codifica de forma que se preserve el formato del vector oficial — es decir, deja `nif`,
   `numSerieFactura`, `fechaExpedicion` e `importeTotal` tal cual (son formatos AEAT
   restringidos) y **solo** añade defensa si encuentras evidencia en `docs/07-facturacion-y-cumplimiento-legal.md`
   de que la AEAT exige percent-encoding. Lee `docs/07` §3.4 (QR) antes de decidir.
3. Si `docs/07` **confirma** que los valores van percent-encoded EXCEPTO el `/`: implementa
   un encoding que codifique cada valor pero restaure `/` en `numserie` (p. ej.
   `encodeURIComponent(i.numSerieFactura).replace(/%2F/gi, "/")`), y añade un test de borde
   con un carácter que sí deba codificarse (p. ej. un espacio → `%20`). El vector oficial
   existente DEBE seguir pasando.
4. Si `docs/07` **no aclara** o sugiere que el formato actual (todo literal) es el correcto:
   **no cambies el código**. Deja una nota en el cuerpo del PR / informe explicando que el
   encoding actual reproduce el vector oficial y que cambiarlo requiere confirmar la spec
   vigente de la AEAT. Marca el Paso 2 como "no aplicado por ambigüedad de cumplimiento".

**Verify (en cualquier rama de la decisión)**: `pnpm --filter @gluuh/core test` → **todos
los tests pasan, incluido el vector oficial de la AEAT** (`verifactu.test.ts`). Si el vector
oficial falla, has roto el cumplimiento: revierte.

## Test plan

- Paso 1: sin tests (cambio de documentación); verificación por `grep`.
- Paso 2: si se implementa encoding, añadir en `verifactu.test.ts` un caso de borde
  (valor con carácter que requiera codificación) y **conservar intacto** el test del vector
  oficial. Si no se implementa, no se añaden tests.
- Verificación: `pnpm --filter @gluuh/core test`.

## Done criteria

ALL deben cumplirse:

- [ ] `README.md` ya no dice `localhost:3000` para la web; dice `3100`.
- [ ] `pnpm --filter @gluuh/core test` exit 0 con el **vector oficial de la AEAT pasando**.
- [ ] Si se modificó `verifactu.ts`: existe un test de borde nuevo y el vector oficial sigue verde.
- [ ] Si NO se modificó `verifactu.ts`: el informe/PR explica por qué (ambigüedad de spec).
- [ ] Solo ficheros en "In scope" modificados (`git status`).
- [ ] Fila de estado actualizada en `plans/README.md`.

## STOP conditions

Detente e informa si:

- Cualquier cambio en `verifactu.ts` hace fallar el test del vector oficial de la AEAT y no
  logras un encoding que lo preserve → revierte el Paso 2 y reporta.
- `docs/07` describe reglas de encoding del QR que contradicen tanto el código actual como
  la opción 3 → es una decisión de cumplimiento para el responsable, no la tomes tú.

## Maintenance notes

- Para el revisor: el criterio innegociable es que el **vector oficial de la AEAT**
  (`verifactu.test.ts`) siga pasando. Cualquier cambio de encoding que lo altere es un
  regreso de cumplimiento.
- A futuro, confirmar las reglas de codificación del QR contra la especificación técnica
  vigente del portal de desarrolladores de la AEAT antes de producción (lo dice el propio
  comentario de `verifactu.ts`).
