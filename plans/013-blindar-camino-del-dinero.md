# Plan 013: Blindar el camino del dinero del TPV (cobro sin crash, sin doble pago y sin pérdida de líneas)

> **Instrucciones para el ejecutor**: sigue este plan paso a paso, verifica cada
> paso, respeta las "Condiciones de STOP" y actualiza tu fila en
> `plans/README.md` al terminar. **Antes del paso 4, lee OBLIGATORIAMENTE**
> `.agents/skills/gluuh-base-datos/SKILL.md` (convenciones de migraciones del repo).
>
> **Comprobación de deriva (ejecutar primero)**:
> `git diff --stat 9c959d1..HEAD -- apps/web/app/tpv/page.tsx supabase/migrations/`
> Plan escrito contra el árbol de trabajo del 2026-07-11. Si los extractos no
> coinciden con el código vivo (más allá de los planes 010-012), es STOP.

## Estado

- **Prioridad**: P1 (es el primero a ejecutar de la tanda 010-015)
- **Esfuerzo**: M
- **Riesgo**: MED (toca el flujo de cobro; cada paso deja el TPV funcional)
- **Depende de**: ninguno. Si 010/011 se aplican después, tocan las mismas
  funciones — ejecutar 013 y 010/011 EN SERIE, nunca en paralelo.
- **Categoría**: bug
- **Planificado en**: commit `9c959d1` (+ working tree), 2026-07-11

## Por qué importa

Tres fallos reales en el flujo de cobro/guardado, confirmados leyendo el código:

1. **`cobrar()` no comprueba que `/api/ticket` respondiera bien**: si la API
   devuelve 400/500, `t = { error }`, pero la venta se marca `COBRADA`, se
   inserta el pago, se libera la mesa… y después `construirTicketImpresion(t)`
   revienta con `TypeError` al leer `t.impuestos.desglose` → pantalla rota en
   pleno cobro con el dinero ya "registrado".
2. **`cobrar()` no tiene guard de reentrada** (`enviarCocina`, `guardarActual` y
   `aparcar` sí lo tienen): un doble toque puede insertar dos pagos de la misma
   venta e inflar el arqueo.
3. **`crearOrden()` borra las líneas y las reinserta sin transacción**: si el
   INSERT falla tras el DELETE (red, constraint), la cuenta queda persistida con
   total pero **cero líneas** — comanda perdida. Y si el pago (`payment`) falla,
   solo se hace `console.error` y la mesa se libera igualmente → descuadre de
   caja silencioso.

Nota de contexto: VERIFACTU está desactivado y los pagos son de PRUEBA
(decisión 06-07-2026, `page.tsx:66-69`), así que hoy no hay dinero real en
juego — pero este flujo es el que se activará tal cual al vender, y el crash
del punto 1 ya afecta a las demos.

## Estado actual

Todo en `apps/web/app/tpv/page.tsx` salvo la migración nueva:

- `page.tsx:1212-1226` — `cobrar()` arranca así (sin `busy` y sin `res.ok`):
  ```ts
  async function cobrar(filas, opts = {}) {
    if (!unidades) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ticket", { method: "POST", ..., body: JSON.stringify({...}) });
      const t = await res.json();
      const orderId = await crearOrden("COBRADA", "ENTREGADO");
  ```
- `page.tsx:1235-1242` — inserción del pago y liberación de mesa:
  ```ts
  const { error: payErr } = await sb.from("payment").insert(...);
  if (payErr) console.error("No se registró el pago:", payErr.message);
  if (opts.abrirCajon ?? finales.some((p) => p.metodo === "EFECTIVO")) void window.gluuh?.abrirCajon();
  ...
  if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
  ```
- `page.tsx:1276-1277` — `setTicket(t); setUltimoDoc(construirTicketImpresion(t));`
  y `construirTicketImpresion` (671-697) dereferencia `t.impuestos.desglose.map(...)`.
- `page.tsx:962-982` — `crearOrden`, la parte no atómica:
  ```ts
  let orderId = ordenAbiertaId;
  if (orderId) {
    await sb.from("sales_order").update({ estado, estado_preparacion: estadoPrep, total: totalRedondeado, ...camposCuenta }).eq("id", orderId);
    await sb.from("order_line").delete().eq("order_id", orderId);
  } else { /* insert de sales_order nuevo */ }
  if (lineas.length) {
    const filas = lineas.map((l) => ({ order_id: orderId, ...l }));
    const { error } = await sb.from("order_line").insert(filas);
    // Degradación: la columna user_id (mig. 0059) puede no existir aún...
    if (error) await sb.from("order_line").insert(filas.map(({ user_id, ...r }) => r));
  }
  return orderId;
  ```
- Los toasts del repo: `import { toast } from "@/app/lib/toast";` con
  `toast.error(...)` / `toast.warning(...)` (ver usos en `page.tsx:234`, `1145`).
- Migraciones: última aplicada `supabase/migrations/0093_element_color.sql` →
  la nueva es `0094_*.sql`. Convenciones en `.agents/skills/gluuh-base-datos/SKILL.md`
  (numeración secuencial, snake_case; las funciones que escribe el navegador se
  ejecutan con RLS del invocador). `apps/api/db/schema.sql` es espejo de
  referencia y debe recibir la función también (CLAUDE.md).
- Importante para la migración: el usuario aplica las migraciones a su Supabase
  (proyecto "Gluuh - tpv"); el ejecutor NO tiene que aplicarla, solo escribirla.

## Comandos necesarios

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Typecheck | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Dev | `pnpm --filter @gluuh/web dev` | TPV en http://localhost:3100/tpv |
| Lint SQL (no hay) | inspección manual de la migración | patrón igual a 0079 |

## Ámbito

**Dentro**:
- `apps/web/app/tpv/page.tsx` (solo `cobrar`, `crearOrden`)
- `supabase/migrations/0094_reemplazar_lineas_orden.sql` (crear)
- `apps/api/db/schema.sql` (añadir la función al espejo, al final, con comentario)

**Fuera** (NO tocar):
- `dividirAceptar` y `ejecutarTraspaso` — tienen el mismo defecto de atomicidad
  pero se difieren a un plan propio (ver "Notas de mantenimiento"); no los
  arregles "de paso".
- `/api/ticket/route.ts` — el modo PERMISIVO es una decisión documentada
  (`route.ts:19-25`); no lo endurezcas aquí.
- `CobrarModal.tsx` y el flujo de reparto de pagos (`cobrarDesdeModal`).
- Cualquier otra migración o tabla.

## Flujo git

- Rama: `advisor/013-blindar-cobro`.
- Commits sugeridos (uno por paso): `fix(tpv): el cobro aborta si /api/ticket falla`,
  `fix(tpv): guard de reentrada en cobrar()`, `fix(tpv): el pago fallido no libera la mesa`,
  `feat(bd): RPC reemplazar_lineas_orden atómica (0094) + uso en crearOrden`.

## Pasos

### Paso 1: abortar el cobro si `/api/ticket` falla

En `cobrar()` (1219-1226), tras el fetch:

```ts
const res = await fetch("/api/ticket", { ... });
if (!res.ok) {
  toast.error("No se pudo calcular el ticket. No se ha cobrado nada.");
  return;   // el finally libera busy; la cuenta queda como estaba
}
const t = await res.json();
if (!t?.impuestos?.desglose) {
  toast.error("Respuesta fiscal inválida. No se ha cobrado nada.");
  return;
}
```

Nada de lo posterior (crearOrden COBRADA, payment, liberar mesa, setTicket) debe
ejecutarse en ese caso.

**Verificar**: typecheck exit 0. En dev, simula el fallo (para el humo puedes
cambiar temporalmente la URL a `/api/ticket-x` o parar el endpoint): al cobrar
sale el toast, la cuenta sigue en pantalla, la mesa NO se libera. Restaura la URL.

### Paso 2: guard de reentrada

Primera línea de `cobrar()` (1216): `if (busy || !unidades) return;`
(mismo patrón que `enviarCocina` en 1144).

**Verificar**: typecheck exit 0; doble clic rápido en "Cobrar" del modal solo
produce un cobro (una fila en `payment` por venta en la tabla, comprobable en
el panel de auditoría o en Supabase).

### Paso 3: el pago fallido deja la venta SIN cerrar

En `cobrar()` (1235-1242), si `payErr` existe: la venta NO puede quedar
`COBRADA` ni la mesa libre. Sustituye el `console.error` por:

```ts
if (payErr) {
  // El pedido ya está COBRADA (crearOrden): lo devolvemos a POR_COBRAR para que
  // el descuadre sea visible y recuperable, no silencioso.
  await sb.from("sales_order").update({ estado: "POR_COBRAR" }).eq("id", orderId);
  if (mesa) await sb.from("restaurant_table").update({ estado: "POR_COBRAR" }).eq("id", mesa.id);
  toast.error("El pago NO quedó registrado. La cuenta sigue pendiente de cobro.");
  await recargarMesas();
  return;   // sin cajón, sin liberar mesa, sin ticket
}
```

Mueve la apertura del cajón (1240) a DESPUÉS de este bloque (solo se abre si el
pago se registró). El `if (mesa) ... LIBRE` (1242) queda como está para el caso
sin error.

**Verificar**: typecheck exit 0. Humo: cobro normal → mesa LIBRE + ticket, igual
que antes (el camino feliz no cambia).

### Paso 4: RPC atómica para reemplazar las líneas de una orden

1. **Lee** `.agents/skills/gluuh-base-datos/SKILL.md` (reglas 1-2 y trampas).
2. Crea `supabase/migrations/0094_reemplazar_lineas_orden.sql`:

```sql
-- 0094: reemplazo atómico de las líneas de una orden (TPV crearOrden).
-- Evita la ventana DELETE→INSERT en la que un fallo dejaba la cuenta sin líneas.
-- SECURITY INVOKER (por defecto): corre con la RLS del usuario → aislamiento
-- por tenant intacto. p_lineas = array JSON con las mismas columnas que inserta
-- el TPV hoy (product_id, nombre, cantidad, precio_unitario, tipo_impositivo,
-- notas, estacion, user_id, modificadores, pase).
create or replace function reemplazar_lineas_orden(p_order_id uuid, p_lineas jsonb)
returns void
language plpgsql
as $$
begin
  delete from order_line where order_id = p_order_id;
  insert into order_line (order_id, product_id, nombre, cantidad, precio_unitario,
                          tipo_impositivo, notas, estacion, user_id, modificadores, pase)
  select p_order_id,
         (l->>'product_id')::uuid,
         l->>'nombre',
         (l->>'cantidad')::numeric,
         (l->>'precio_unitario')::numeric,
         (l->>'tipo_impositivo')::numeric,
         l->>'notas',
         l->>'estacion',
         (l->>'user_id')::uuid,
         l->'modificadores',
         (l->>'pase')::int
  from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) as l;
end;
$$;

grant execute on function reemplazar_lineas_orden(uuid, jsonb) to authenticated;
```

   Antes de dar por bueno el SQL, contrasta los NOMBRES y TIPOS de columnas de
   `order_line` con `supabase/migrations/0001_init.sql` (+ `0059` user_id,
   `0068`/donde se añadió `pase` — búscalo con `grep -rn "pase" supabase/migrations/`).
   Si algún tipo no coincide (p. ej. `tipo_impositivo` numeric vs text), ajusta
   el cast al tipo real: el código TS actual inserta `tipo` numérico.
3. En `crearOrden` (976-982) sustituye el par delete+insert por la RPC, con
   degradación al camino actual si la función aún no existe en la BD del
   entorno (mismo patrón que el resto del fichero):

```ts
if (orderId) {
  await sb.from("sales_order").update({ estado, estado_preparacion: estadoPrep, total: totalRedondeado, ...camposCuenta }).eq("id", orderId);
  const filas = lineas;   // sin order_id: va como parámetro
  const { error: rpcErr } = await sb.rpc("reemplazar_lineas_orden", { p_order_id: orderId, p_lineas: filas });
  if (rpcErr) {
    // Degradación (0094 sin aplicar aún): camino antiguo delete+insert, PERO
    // comprobando el insert para no dejar la orden vacía en silencio.
    await sb.from("order_line").delete().eq("order_id", orderId);
    const conUser = await sb.from("order_line").insert(filas.map((l) => ({ order_id: orderId, ...l })));
    if (conUser.error) {
      const sinUser = await sb.from("order_line").insert(filas.map(({ user_id, ...r }) => ({ order_id: orderId, ...r })));
      if (sinUser.error) { toast.error("No se pudieron guardar las líneas de la cuenta."); return null; }
    }
  }
} else { /* rama de insert nuevo igual que hoy, pero comprobando el error del insert de líneas con el mismo bloque */ }
```

   Mantén la rama de orden NUEVA como está (insert de `sales_order` + insert de
   líneas) añadiendo solo la comprobación de error del insert de líneas (ahí no
   hay DELETE previo, no necesita la RPC).
4. Añade la función también a `apps/api/db/schema.sql` (al final, sección de
   funciones, con el comentario `-- espejo de 0094`).

**Verificar**:
- typecheck exit 0.
- Con la migración aplicada en el entorno de dev (la aplica el operador o
  `supabase db push` si hay stack local): marchar una mesa, reabrir, marchar de
  nuevo → las líneas se conservan; en Supabase la tabla `order_line` tiene las
  filas nuevas.
- Sin la migración aplicada: el TPV sigue funcionando por la rama de degradación
  (compruébalo ANTES de aplicar la migración).

### Paso 5: humo completo del dinero

1. Venta directa: añadir 2 productos → Cobrar → efectivo → ticket de prueba OK, `payment` con 1 fila.
2. Mesa: abrir, añadir, Marchar, volver a abrir, añadir otro, Cobrar → mesa LIBRE, líneas correctas.
3. Dividir cuenta y traspaso: siguen funcionando (no se tocaron).
4. Invitación (tipo INVITACION): cobra sin insertar `payment` (igual que antes).

## Plan de tests

- Sin runner en `apps/web` (lo monta el plan 015). La red de este plan son las
  verificaciones por paso + el humo del paso 5.
- Cuando exista el runner (015), añadir un caso a futuro: `cobrar` con respuesta
  no-ok no debe invocar `crearOrden` (extraíble cuando el cobro se saque del
  componente; anotado, no exigido aquí).

## Criterios de hecho

- [ ] `pnpm --filter @gluuh/web typecheck` exit 0
- [ ] `grep -n "res.ok" apps/web/app/tpv/page.tsx` → aparece en `cobrar()`
- [ ] `grep -n "if (busy || !unidades) return" apps/web/app/tpv/page.tsx` → 1 resultado en `cobrar`
- [ ] `grep -n "console.error(\"No se registró el pago" apps/web/app/tpv/page.tsx` → 0 resultados
- [ ] Existe `supabase/migrations/0094_reemplazar_lineas_orden.sql` y `grep -n "reemplazar_lineas_orden" apps/api/db/schema.sql` → ≥1
- [ ] Humo del paso 5 completo
- [ ] Solo los 3 ficheros del ámbito modificados (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## Condiciones de STOP

- Los extractos no coinciden con el código vivo.
- Las columnas reales de `order_line` difieren de las del paso 4.2 y no está
  claro el cast correcto (repórtalo con el DDL encontrado, no adivines).
- Ya existe una migración `0094_*` (renumera a la siguiente libre y dilo en el reporte).
- El humo del paso 5 falla en el camino feliz tras dos intentos.
- Cualquier cambio parece requerir tocar `dividirAceptar`/`ejecutarTraspaso`.

## Notas de mantenimiento

- **Deferido a planes futuros** (mismo defecto, menos frecuencia de uso):
  `dividirAceptar` (page.tsx:1312-1362, inserts sin comprobar `data?.id`) y
  `ejecutarTraspaso` (page.tsx:1101-1137, además clavea `traspLineas` por
  `product_id` cuando la UI selecciona por clave de línea → traspasos parciales
  incorrectos con formatos/modificadores). Ambos deberían migrar a RPCs atómicas
  como la de este plan.
- Techo conocido y ACEPTADO por ahora (comentario en `apps/web/app/api/factura/route.ts:117-124`):
  los precios los escribe el navegador; el cierre definitivo es una RPC de
  pedido con precios de servidor (como el kiosko). Ligado a activar VERIFACTU.
- Revisor: en el paso 3, comprobar que el cajón NO se abre cuando el pago falló,
  y que `recargarMesas()` refleja POR_COBRAR.
