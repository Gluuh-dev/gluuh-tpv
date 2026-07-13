# Plan 010: Indexar el catálogo (Map O(1)) y memoizar las derivadas de la comanda

> **Instrucciones para el ejecutor**: sigue este plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes del siguiente
> paso. Si ocurre algo de la sección "Condiciones de STOP", para y repórtalo —
> no improvises. Al terminar, actualiza la fila de este plan en `plans/README.md`.
>
> **Comprobación de deriva (ejecutar primero)**:
> `git diff --stat 9c959d1..HEAD -- apps/web/app/tpv/page.tsx`
> Este plan se escribió contra el **árbol de trabajo** del 2026-07-11 (commit base
> `9c959d1` + cambios locales sin commitear). Antes de empezar, compara los
> extractos de "Estado actual" con el código vivo; si no coinciden, es condición
> de STOP.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: S
- **Riesgo**: LOW
- **Depende de**: ninguno
- **Categoría**: perf
- **Planificado en**: commit `9c959d1` (+ working tree), 2026-07-11

## Por qué importa

El usuario reporta que "el TPV no va fluido". Una causa medible: en
`apps/web/app/tpv/page.tsx`, resolver el producto/nombre/precio de cada línea de
la comanda se hace con `Array.find(...)` sobre **todo el catálogo** en cada
llamada, y esas funciones se llaman **por línea y por render** (y el componente
entero re-renderiza en cada pulsación — eso lo ataca el plan 011). Con un ticket
de 15 líneas y una carta de 300-400 productos son decenas de miles de
comparaciones de string por pulsación. Sustituirlo por un índice `Map` es un
cambio pequeño, mecánico y sin cambio de comportamiento que reduce ese coste a
O(1) por lookup.

## Estado actual

Fichero único a tocar: `apps/web/app/tpv/page.tsx` (~2755 líneas, componente
cliente `TPV()`).

Los puntos con búsqueda lineal (números de línea del árbol de trabajo actual):

- `page.tsx:409-419` — `catalogoConMenus` (useMemo): array de `Prod` = productos + menús como pseudo-productos. Es la fuente sobre la que hay que construir el índice.
  ```ts
  const catalogoConMenus = useMemo<Prod[]>(
    () => [
      ...prods,
      ...menus.map((m) => ({ ... })),
    ],
    [prods, menus, territorio],
  );
  ```
- `page.tsx:424` — `prodDeKey`:
  ```ts
  const prodDeKey = (key: string) => catalogoConMenus.find((x) => x.id === claveBase(key).split("|")[0]);
  ```
- `page.tsx:427-443` — `nombreDeKey(key, campo?)`: hace `catalogoConMenus.find((x) => x.id === pid)`.
- `page.tsx:445-453` — `nombreBaseDeKey(key, campo?)`: ídem.
- `page.tsx:478-498` — `obtenerBaseManualSiDifiere(baseKey, precioUnitario)`: hace `prods.find((x) => x.id === pid)`.
- `page.tsx:501-521` — `precioEfectivo` (useMemo que devuelve una función): dentro hace `catalogoConMenus.find((x) => x.id === pid)`.
- `page.tsx:563-570` — `lineasComanda()`: función normal (no memoizada) que mapea `Object.entries(comanda)` llamando `prodDeKey` + `nombreDeKey` + `precioEfectivo` por línea. Se llama desde el efecto del visor (`page.tsx:573-580`), `construirTicketImpresion`, `imprimirRecibo`, `imprimirComandas`, `crearOrden`, `dividirAceptar` y las props de `DividirCuentaModal` (`page.tsx:2421`).
- `page.tsx:915`, `page.tsx:1015`, `page.tsx:1373` — al cargar cuentas: `if (!l.product_id || !prods.some((p) => p.id === l.product_id)) continue;` (O(P) por línea cargada).
- `page.tsx:1028` — `operarios.find(...)` por línea (lista pequeña; NO tocar).
- `page.tsx:1056`, `page.tsx:1074-1075`, `page.tsx:1410` — `prods.find((p) => p.id === l.product_id)` por línea en `imprimirCuentaMesa`, `reimprimirCocinaMesa` y `recargarAparcados`.
- `page.tsx:1743-1753` — `grCocina` (useMemo): llama `prodDeKey` por clave de comanda (se beneficia solo).
- `page.tsx:2115-2119` — render del ticket: por cada línea llama `prodDeKey(id)`, `precioEfectivo(id)`, y dentro `nombreBaseDeKey(id)` y `extraIngredientesDetallados(id)`.

Convenciones del repo que aplican: TypeScript estricto (`noUncheckedIndexedAccess`:
un `map.get(x)` devuelve `T | undefined` — mantén los guards existentes), código
y comentarios en español, sin dependencias nuevas.

## Comandos necesarios

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Typecheck web | `pnpm --filter @gluuh/web typecheck` | exit 0 (verificado en verde antes de este plan) |
| Tests core (no deben verse afectados) | `pnpm --filter @gluuh/core test` | todos pasan |
| Dev server | `pnpm --filter @gluuh/web dev` | TPV en http://localhost:3100/tpv |

## Ámbito

**Dentro** (únicos ficheros a modificar):
- `apps/web/app/tpv/page.tsx`

**Fuera** (NO tocar aunque parezcan relacionados):
- `apps/web/app/lib/catalogo-store.ts` — el store compartido lo usan kiosko/KDS; el índice se construye localmente en la página, no en el store.
- `apps/web/app/tpv/clave-linea.ts` — el formato de claves no cambia.
- `apps/web/app/tpv/components/*` — este plan no toca componentes (eso es el plan 011).
- Cualquier cambio de comportamiento del cálculo de precios: esto es SOLO una optimización de lookup.

## Flujo git

- Rama: `advisor/010-indice-catalogo` (desde el estado actual del trabajo, previa consulta al operador si el árbol está sucio).
- Commits: conventional commits en español, p. ej. `perf(tpv): índice O(1) del catálogo para las derivadas de la comanda`.
- NO hacer push ni abrir PR salvo instrucción del operador.

## Pasos

### Paso 1: crear los índices memoizados

Justo después del `useMemo` de `catalogoConMenus` (page.tsx:409-419), añade:

```ts
// Índices O(1) del catálogo: las derivadas de la comanda (prodDeKey, precioEfectivo,
// nombres) se llaman por línea y por render; con .find() eran O(catálogo) cada una.
const prodPorId = useMemo(() => {
  const m = new Map<string, Prod>();
  for (const p of catalogoConMenus) m.set(p.id, p);
  return m;
}, [catalogoConMenus]);
```

`prods` está contenido en `catalogoConMenus` (los menús van después y no
colisionan con ids de product), así que `prodPorId` sirve también donde hoy se
busca en `prods`, **salvo** en `obtenerBaseManualSiDifiere` (page.tsx:478), que
debe seguir resolviendo SOLO products reales (si `pid` fuera un menú no hay
precio base de formato). Ahí usa `prodPorId.get(pid)` y conserva el guard
`if (!prod) return undefined;` — los menús nunca llegan a esa ruta porque las
líneas de menú se guardan con `product_id NULL` y el bucle que la llama hace
`continue` con `!l.product_id`.

**Verificar**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Paso 2: sustituir todos los `.find`/`.some` lineales por el índice

Mecánico, uno a uno (mantén las firmas y los guards de `undefined`):

1. `prodDeKey` (424): `catalogoConMenus.find((x) => x.id === pid)` → `prodPorId.get(claveBase(key).split("|")[0]!)`.
2. `nombreDeKey` (427-443) y `nombreBaseDeKey` (445-453): el `find` interno → `prodPorId.get(pid!)`.
3. `precioEfectivo` (501-521): el `find` → `prodPorId.get(pid!)`, y añade `prodPorId` a las deps del `useMemo` (sustituyendo `catalogoConMenus` si ya no se usa dentro).
4. `obtenerBaseManualSiDifiere` (478-498): `prods.find` → `prodPorId.get(pid!)` (ver matiz del paso 1).
5. Bucles de carga (915, 1015, 1373): `!prods.some((p) => p.id === l.product_id)` → `!prodPorId.has(l.product_id)`.
6. `imprimirCuentaMesa` (1056), `reimprimirCocinaMesa` (1074-1075), `recargarAparcados` (1410): `prods.find(...)` → `prodPorId.get(l.product_id ?? "")` con el mismo fallback `?? "Producto"` / `?? "COCINA"` actual.

Cuidado con `noUncheckedIndexedAccess`: `split("|")[0]` es `string | undefined`;
usa el patrón ya presente (`pid!` tras el split, como hace el código actual) o un
guard temprano.

**Verificar**: `pnpm --filter @gluuh/web typecheck` → exit 0, y
`grep -n "catalogoConMenus.find\|prods.find\|prods.some" apps/web/app/tpv/page.tsx` → sin resultados.

### Paso 3: memoizar `lineasComanda`

Convierte la función (563-570) en un valor memoizado + un alias de función para
no tocar a los llamadores:

```ts
const lineasComandaMemo = useMemo(
  () => Object.entries(comanda).map(([id, cantidad]) => { /* cuerpo actual intacto */ }),
  [comanda, prodPorId, menuIds, precioEfectivo],   // nombreDeKey usa formatos/modById vía precioEfectivo-deps; añade `formatos` y `modById` si typecheck/lint lo pide
);
const lineasComanda = () => lineasComandaMemo;
```

Nota: los llamadores son manejadores de eventos y un efecto; reciben el valor del
último render, que es exactamente lo que reciben hoy. No cambies sus call sites.
Si el lint de hooks exige dependencias adicionales (`formatos`, `modById`,
`estacionDe` es import estable), añádelas — son las mismas fuentes que ya usa el
cálculo actual.

**Verificar**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Paso 4: prueba funcional manual (humo)

Con `pnpm --filter @gluuh/web dev` y una cuenta de demo:

1. Añadir 3 productos distintos (uno con formato, uno con modificadores si la carta demo los tiene) → los nombres y precios de las líneas salen igual que antes.
2. Aplicar DTO% a una línea y re-añadir el mismo producto → aparece línea nueva `#2` sin descuento (comportamiento de `claveParaAnadir` intacto).
3. Abrir una mesa con cuenta guardada → las líneas cargan con su precio/nota.
4. Cobrar en modo prueba → el modal de ticket muestra el mismo total que la barra de totales.

**Verificar**: los 4 puntos sin diferencias visibles respecto a antes del cambio.

## Plan de tests

Este plan no añade lógica nueva (misma semántica, otro contenedor), pero deja el
camino del dinero con una red mínima:

- Ejecutar el auto-check existente de claves: `npx tsx -e "import('./apps/web/app/tpv/clave-linea.ts').then(m => m.demo())"` → imprime `clave-linea demo OK`.
- No se exigen tests nuevos aquí (el plan 013 de tests cubre `precioEfectivo`); si el ejecutor detecta una discrepancia de precios en el paso 4, es condición de STOP, no de parche.

## Criterios de hecho

- [ ] `pnpm --filter @gluuh/web typecheck` exit 0
- [ ] `grep -n "catalogoConMenus.find" apps/web/app/tpv/page.tsx` → 0 resultados
- [ ] `grep -n "prods.find\|prods.some" apps/web/app/tpv/page.tsx` → 0 resultados
- [ ] Humo del paso 4 sin diferencias funcionales
- [ ] Solo `apps/web/app/tpv/page.tsx` modificado (`git status`)
- [ ] Fila del plan actualizada en `plans/README.md`

## Condiciones de STOP

Para y reporta si:

- Los extractos de "Estado actual" no coinciden con el código vivo (deriva).
- Algún precio/nombre difiere en el humo del paso 4 (indicaría una colisión de ids menú/producto que hoy no existe — no la parchees).
- El fix parece requerir tocar `catalogo-store.ts` o componentes.
- El typecheck falla dos veces seguidas tras un intento razonable de arreglo.

## Notas de mantenimiento

- El plan 011 (aislar re-renders) asume que estos lookups ya son O(1); ejecutar 010 antes.
- Si en el futuro los menús pudieran compartir id con products (hoy imposible: UUIDs de tablas distintas), `prodPorId` debe pasar a dos mapas separados.
- Revisor: comprobar que ningún `.get()` perdió su guard de `undefined` (TS estricto ya lo fuerza).
