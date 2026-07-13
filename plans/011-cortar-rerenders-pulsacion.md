# Plan 011: Cortar los re-renders por pulsación del TPV (buffer fuera de la raíz + memo selectivo)

> **Instrucciones para el ejecutor**: sigue este plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes del siguiente
> paso. Si ocurre algo de "Condiciones de STOP", para y repórtalo — no improvises.
> Al terminar, actualiza la fila de este plan en `plans/README.md`.
>
> **Comprobación de deriva (ejecutar primero)**:
> `git diff --stat 9c959d1..HEAD -- apps/web/app/tpv/`
> Plan escrito contra el árbol de trabajo del 2026-07-11 **tras aplicar el plan 010**
> (requiere `prodPorId`). Compara los extractos con el código vivo; si no coinciden
> y no es por el plan 010, es STOP.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: M
- **Riesgo**: MED
- **Depende de**: `plans/010-indice-catalogo-o1.md`
- **Categoría**: perf
- **Planificado en**: commit `9c959d1` (+ working tree), 2026-07-11

## Por qué importa

Hoy, **cada dígito tecleado** en el teclado numérico del TPV re-ejecuta el
componente entero de 2755 líneas: `buffer` vive en el store zustand y la página
raíz está suscrita a él (`page.tsx:269`), así que cada `setBuffer` re-renderiza
la lista de líneas del ticket, la cabecera, los railes y el teclado. Los grids de
productos/categorías ya están protegidos con `useMemo` + refs "vivas"
(`page.tsx:277-287`, `1757`, `1807`) — este plan extiende ese mismo patrón al
resto: el buffer solo lo muestran `BarraTotales` y el recuadro de la línea
seleccionada, de modo que teclear debe re-renderizar SOLO esas dos cosas.
Es la causa nº 1 del "no va fluido" al teclear cantidades/precios/descuentos
en terminales táctiles modestos.

## Estado actual

Ficheros implicados (todos en `apps/web/app/tpv/`):

- `page.tsx` — componente raíz. Suscripciones de alta frecuencia:
  ```ts
  // page.tsx:269-274
  const buffer = useTpvStore((s) => s.buffer);
  const setBuffer = useTpvStore((s) => s.setBuffer);
  const modo = useTpvStore((s) => s.modo);
  const setModo = useTpvStore((s) => s.setModo);
  const editando = useTpvStore((s) => s.editando);
  const setEditando = useTpvStore((s) => s.setEditando);
  ```
  ```ts
  // page.tsx:277-278 — refs "vivas" que este plan ELIMINA (getState las sustituye)
  const bufferRef = useRef(buffer); bufferRef.current = buffer;
  const modoRef = useRef(modo); modoRef.current = modo;
  ```
- Consumidores de `buffer`/`modo`/`editando` **en render**:
  - `BarraTotales` (`page.tsx:2226-2241`): props `modo`, `editando`, `buffer`, `edicion`.
  - `TecladoTPV` (`page.tsx:2256-2263`): props `modo`, `editando`.
  - Recuadro inline en la línea seleccionada (`page.tsx:2167-2176`):
    ```tsx
    {sel && editando && modo === "UND"
      ? <span className="inline-block rounded-md bg-brand px-1.5 text-brand-foreground">{buffer || q}</span>
      : q}
    ```
    (y el gemelo para precio en 2172-2176).
- Consumidores **en manejadores de eventos** (pueden leer con `getState()`):
  `addProd` (785-803, hoy vía `bufferRef`/`modoRef`), `aplicarModo` (807-815),
  `handleKey` (821-848), `guardarModificadores` (usa `modo`/`buffer` en 2531-2532
  al montar el modal — eso es render, ver paso 4), `onLineaTap` (817-820).
- Objetos/arrays recreados por render que anulan cualquier memo de hijos:
  - `accionesRapidasProps` (`page.tsx:2009-2036`) → `ColumnaFunciones` (2267).
  - `railSalas("TICKET")` (`page.tsx:1919-1942`): reconstruye `tabs` con
    `mesas.filter(...)` por sala en cada render → `RailSalas` (2310).
- Timer que re-renderiza todo cada 60 s aunque no haya horarios:
  ```ts
  // page.tsx:212-216
  const [tickHorario, setTickHorario] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTickHorario((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  ```
- Búsqueda sin defer: `busqProd` (estado local, `page.tsx:294`) entra en las deps
  de `productosVista` (1724-1729) y `gridProductos` (1804) → cada tecla del
  buscador re-monta el grid completo (con fotos).
- Store: `apps/web/app/tpv/hooks/useTpvStore.ts` — zustand plano; `getState()`
  disponible; los setters son estables (no cambian de identidad).
- Componentes hijos (presentacionales, sin `React.memo` hoy):
  `components/BarraTotales.tsx`, `components/TecladoTPV.tsx`,
  `components/ColumnaFunciones.tsx`, `components/RailSalas.tsx`,
  `components/BarraEstado.tsx`.

Convención del repo: los componentes de `app/tpv/components/` son
"presentacionales puros" (comentario en cabecera de cada fichero). Este plan
**cambia esa convención SOLO para `BarraTotales` y `TecladoTPV`** (pasan a leer
`buffer`/`modo`/`editando` directamente de `useTpvStore`): documenta el cambio en
el comentario de cabecera de cada uno.

## Comandos necesarios

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Typecheck | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Dev | `pnpm --filter @gluuh/web dev` | TPV en http://localhost:3100/tpv |
| Grep de limpieza | `grep -n "bufferRef\|modoRef" apps/web/app/tpv/page.tsx` | 0 resultados al final |

## Ámbito

**Dentro**:
- `apps/web/app/tpv/page.tsx`
- `apps/web/app/tpv/components/BarraTotales.tsx`
- `apps/web/app/tpv/components/TecladoTPV.tsx`
- `apps/web/app/tpv/components/ColumnaFunciones.tsx` (solo envolver en `React.memo`)
- `apps/web/app/tpv/components/RailSalas.tsx` (solo envolver en `React.memo`)
- `apps/web/app/tpv/components/BarraEstado.tsx` (solo envolver en `React.memo`)

**Fuera** (NO tocar):
- `useTpvStore.ts` — el store ya sirve tal cual.
- `PlanoSalas.tsx` y el resto de modales.
- `catalogo-store.ts`, `clave-linea.ts`.
- Cualquier cambio visual o de comportamiento del teclado (misma UX exacta).

## Flujo git

- Rama: `advisor/011-rerenders-pulsacion`.
- Commit: `perf(tpv): el buffer del teclado deja de re-renderizar la página entera`.
- NO push/PR sin instrucción del operador.

## Pasos

### Paso 1: `handleKey`/`aplicarModo`/`addProd` leen el teclado con `getState()`

En `page.tsx`:

1. En `addProd` (785-803) sustituye `modoRef.current`/`bufferRef.current` por
   `useTpvStore.getState().modo` / `.buffer`.
2. En `aplicarModo` (807-815) y `handleKey` (821-848) sustituye las lecturas de
   `buffer`/`modo`/`editando` del closure por `useTpvStore.getState().<campo>`
   al principio de cada función (`const { buffer, modo, editando } = useTpvStore.getState();`).
   Los `setBuffer`/`setModo`/`setEditando` siguen igual (setters estables).
3. En `onLineaTap` (817-820) no hay lecturas, solo setters — sin cambio.
4. Elimina `bufferRef` y `modoRef` (277-278). NO toques `comandaRef`,
   `descuentosRef`, `preciosManualesRef`, `lineasGuardadasRef`, `operarioRef`
   (siguen siendo necesarios para el grid memoizado).

**Verificar**: `pnpm --filter @gluuh/web typecheck` → exit 0;
`grep -n "bufferRef\|modoRef" apps/web/app/tpv/page.tsx` → 0.

### Paso 2: `BarraTotales` y `TecladoTPV` se suscriben ellos mismos

1. `components/BarraTotales.tsx`: elimina las props `modo`, `editando`, `buffer`
   y léelas dentro con selectores:
   ```ts
   const modo = useTpvStore((s) => s.modo);
   const editando = useTpvStore((s) => s.editando);
   const buffer = useTpvStore((s) => s.buffer);
   ```
   La prop `edicion` (objeto con `tipo/nombre/label`, construida en
   `page.tsx:2236-2240` a partir de `modo`/`editando`/`lineaSel`) se sustituye por
   dos props simples: `nombreLineaSel: string | null` (el padre pasa
   `lineaSel ? nombreDeKey(lineaSel) : null`) y el componente deriva el mensaje
   con su `modo`/`editando` internos (misma lógica de mapeo que hoy hace el padre).
   Exporta envuelto: `export const BarraTotales = memo(function BarraTotales(...) {...})`.
2. `components/TecladoTPV.tsx`: elimina props `modo` y `editando`, léelas con
   selectores como arriba; envuelve en `memo`. Las props `onKey/onModo/onCobrar/
   cobrarDisabled` se mantienen.
3. En `page.tsx`, actualiza los dos call sites (2226-2241 y 2256-2263) quitando
   las props eliminadas. Envuelve `handleKey` en `useCallback` con deps
   `[puede]`-mínimas (tras el paso 1 ya no depende de buffer/modo/editando;
   depende de `lineaSel`… que también puedes leer con `getState()` dentro para
   dejar las deps en `[]` + `permisos` vía una ref `permisosRef` siguiendo el
   patrón existente de `operarioRef` en 286-287). `onCobrar={() => setModalActivo('COBRAR')}`
   → `useCallback` estable.

**Verificar**: typecheck exit 0. En dev: armar "Und.", teclear dígitos → el
número aparece en la barra de totales y el botón del modo se pinta en verde,
idéntico a antes.

### Paso 3: quitar la suscripción de `buffer` de la raíz

1. En `page.tsx:269-274` elimina `const buffer = useTpvStore((s) => s.buffer);`
   (deja `setBuffer` si algún handler lo usa, y las suscripciones de
   `modo`/`editando` SOLO si tras los pasos 1-2 aún quedan usos en render — el
   único que queda es el recuadro inline de la línea seleccionada, ver 2.
   Si quedan sin uso en render, elimínalas también).
2. Recuadro inline de la línea seleccionada (2167-2176): extrae un componente
   pequeño EN EL MISMO fichero `page.tsx` (encima del componente `TPV`):
   ```tsx
   // Muestra el buffer vivo en la línea seleccionada sin re-renderizar la página.
   function BufferEnLinea({ activo, fallback }: { activo: "UND" | "PREC"; fallback: React.ReactNode }) {
     const buffer = useTpvStore((s) => s.buffer);
     const modo = useTpvStore((s) => s.modo);
     const editando = useTpvStore((s) => s.editando);
     const enUnd = modo === "UND";
     const visible = editando && (activo === "UND" ? enUnd : !enUnd);
     if (!visible) return <>{fallback}</>;
     return <span className="inline-block rounded-md bg-brand px-1.5 text-brand-foreground">{buffer || fallback}</span>;
   }
   ```
   y úsalo en la fila: `{sel ? <BufferEnLinea activo="UND" fallback={q} /> : q}` y
   el gemelo de precio con `fallback={eur(pe)}` (conserva exactamente las clases
   y la semántica actuales: en UND el fallback del buffer vacío es `q`, en precio es `"0"`).
3. `guardarModificadores`/`bufferUds` (2531-2532) lee `modo`/`buffer` en render
   del modal: se ejecuta solo con `modProd` abierto; cámbialo a
   `useTpvStore.getState()` (se evalúa al abrir el modal, misma semántica que hoy
   porque el buffer no cambia con el modal abierto).

**Verificar**: typecheck exit 0. En dev, con un `console.count("render TPV")`
TEMPORAL en el cuerpo de `TPV()`: teclear 10 dígitos → el contador **no avanza**
(antes avanzaba 10). Retira el `console.count` antes de commitear.

### Paso 4: estabilizar y memoizar los hijos que quedan

1. `accionesRapidasProps` (2009-2036) → `useMemo` con deps reales
   (`unidades>0`, `ordenAbiertaId`, `tipoOperacion`, `aparcados.length`,
   `ultimoDoc`, `ordenFunciones`, `busy`…) y callbacks internos envueltos una vez
   (pueden definirse dentro del mismo `useMemo`). `ColumnaFunciones` → `memo`.
2. `railSalas(activo)` (1919-1942): extrae el cálculo de `tabs` a un `useMemo`
   (deps: `rooms`, `mesas`, `totalesMesa`, `aparcados.length`, `llevarList.length`,
   `reservas.length`) y `RailSalas` → `memo`. Ojo: `onClick` de cada tab llama
   `irASala`/`guardarActual` — defínelos con `useCallback` o acepta identidad
   estable vía el `useMemo` de tabs.
3. `BarraEstado` → `memo` (sus props ya son primitivas + `setModoZurdo` estable).
4. tick de horarios (212-216): no armar el intervalo si no hay franjas:
   ```ts
   useEffect(() => {
     if (!Object.keys(horariosCat).length) return;   // sin franjas: nada que reevaluar
     const t = setInterval(() => setTickHorario((x) => x + 1), 60_000);
     return () => clearInterval(t);
   }, [horariosCat]);
   ```
5. Búsqueda: `const busqDiferida = useDeferredValue(busqProd);` y usa
   `busqDiferida` en `productosVista` (1724-1729) y en las deps/uso de
   `gridProductos` (1766-1804), manteniendo `busqProd` en el `<input>` (2277).

**Verificar**: typecheck exit 0.

### Paso 5: humo funcional completo

Con `pnpm --filter @gluuh/web dev`:

1. Armar Und. → teclear "3" → tocar un producto → entra con 3 uds (el patrón getState del paso 1 funciona).
2. Seleccionar línea → Und. → "5" → Und. → la línea pasa a 5 uds.
3. PREC/DTO%/DTO€ sobre una línea → precio/descuento aplican como antes; el recuadro verde inline muestra lo tecleado.
4. CLR y CAN funcionan; ← borra un dígito.
5. Buscar "co" en el buscador → filtra; borrar → vuelve la categoría.
6. Cambiar de sala por el rail, aparcar, marchar → sin regresiones.
7. Rendimiento percibido: teclear rápido 15-20 dígitos seguidos → sin lag visible; las líneas del ticket no parpadean.

## Plan de tests

- No hay runner en `apps/web` todavía (lo monta el plan 015). La verificación de
  este plan es el humo del paso 5 + los greps/counts de los pasos 1-3.
- El plan 015 añadirá tests del precio; este plan NO cambia cálculos, solo
  dónde se lee el estado.

## Criterios de hecho

- [ ] `pnpm --filter @gluuh/web typecheck` exit 0
- [ ] `grep -n "bufferRef\|modoRef" apps/web/app/tpv/page.tsx` → 0 resultados
- [ ] `grep -c "useTpvStore((s) => s.buffer)" apps/web/app/tpv/page.tsx` → exactamente 1 (el de `BufferEnLinea`)
- [ ] Con `console.count` temporal: 10 dígitos → 0 renders de la raíz (evidencia en el reporte del ejecutor; contador retirado después)
- [ ] Humo del paso 5 completo sin regresiones
- [ ] Solo los 6 ficheros del ámbito modificados (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## Condiciones de STOP

- El plan 010 no está aplicado (no existe `prodPorId` en `page.tsx`).
- Los extractos no coinciden (deriva más allá del plan 010).
- Tras el paso 3, el recuadro verde inline o la barra de totales dejan de
  reflejar lo tecleado (regresión de UX del teclado) y no se resuelve al
  primer intento.
- Cualquier cambio parece requerir tocar `useTpvStore.ts` o `PlanoSalas.tsx`.

## Notas de mantenimiento

- Nueva convención: `BarraTotales`/`TecladoTPV` leen el estado del teclado
  directamente del store (documentado en sus cabeceras). Si se añade otra vista
  que los reutilice, deberá compartir ese store o revertir a props.
- Si en el futuro las filas del ticket se vuelven pesadas (más badges/derivados),
  el siguiente paso natural es extraer `<FilaTicket>` con `memo` — se dejó fuera
  a propósito: tras este plan las filas solo re-renderizan al cambiar la comanda
  o la selección, no al teclear.
- Revisor: vigilar que ningún manejador lea `buffer` del closure (siempre
  `getState()`), y que el `useMemo` de tabs no capture `mesas` obsoleto.
