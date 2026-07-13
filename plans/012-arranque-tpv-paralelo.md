# Plan 012: Paralelizar el arranque del TPV y la carga de cuentas de mesa

> **Instrucciones para el ejecutor**: sigue este plan paso a paso, verifica cada
> paso antes del siguiente, respeta las "Condiciones de STOP" y actualiza tu fila
> en `plans/README.md` al terminar.
>
> **Comprobación de deriva (ejecutar primero)**:
> `git diff --stat 9c959d1..HEAD -- apps/web/app/tpv/page.tsx apps/web/app/tpv/components/PlanoSalas.tsx`
> Plan escrito contra el árbol de trabajo del 2026-07-11. Si los extractos de
> "Estado actual" no coinciden con el código vivo (más allá de los planes 010/011
> si ya se aplicaron), es STOP.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: S-M
- **Riesgo**: LOW
- **Depende de**: ninguno (compatible con 010/011 en cualquier orden; si 010 ya
  está aplicado, los números de línea pueden variar unas pocas líneas)
- **Categoría**: perf
- **Planificado en**: commit `9c959d1` (+ working tree), 2026-07-11

## Por qué importa

Abrir el TPV muestra "Cargando…" mientras el efecto de montaje encadena **~11
peticiones a Supabase casi todas en serie** (`page.tsx:297-332`). Con 60-150 ms
por ida-y-vuelta al cloud, son 1-3 segundos de pantalla en blanco cada vez que
un camarero entra o recarga. Además, tocar una mesa ocupada en el plano lanza
otra cascada de 3 peticiones secuenciales antes de pintar la vista previa
(`PlanoSalas.tsx:315-332`), y abrir la mesa repite el patrón
(`page.tsx:993-1008`). La mayoría de esas peticiones son independientes entre
sí: agruparlas en `Promise.all` reduce el tiempo percibido a ~2-3 round-trips
sin cambiar ninguna semántica.

## Estado actual

- `apps/web/app/tpv/page.tsx:297-332` — efecto de carga inicial (resumido):
  ```ts
  const { data: { session } } = await sb.auth.getSession();          // 1 (gate)
  if (!session) { router.replace("/login"); return; }
  if (session.user.user_metadata?.debe_cambiar_password) { ... }
  try { const raw = localStorage.getItem("gluuh_operario"); ... }
  const { data: ops } = await sb.rpc("listar_operarios");            // 2
  setMarca(await leerBranding(sb));                                  // 3
  const { data: loc } = await sb.from("location").select(...);       // 4
  const { data: u }   = await sb.from("app_user").select(...);       // 5
  ...
  const { data: tn } = await sb.from("tenant").select("id")...;      // 6
  ...
  await useCatalogo.getState().cargar(sb);                           // 7 (internamente ya paralelo)
  setCatSel(useCatalogo.getState().cats[0]?.id ?? null);
  await recargarMesas();                                             // 8 (2 queries secuenciales dentro)
  await recargarElementos();                                         // 9
  const [{ data: rms }, { data: rsv }] = await Promise.all([...]);   // 10-11 (rooms+reservas, ya paralelo)
  ...
  await recargarLlevar();                                            // 12
  setLoading(false);
  ```
- `page.tsx:852-870` — `recargarMesas()`: la query de `restaurant_table` (con
  cadena de fallback por columnas `sprite,color`) y la de `sales_order` abiertas
  son independientes pero corren en serie.
- `PlanoSalas.tsx:315-332` — `cargarPreviewMesa(m)`: `sales_order` → luego
  `order_line` → luego OTRO select de `sales_order.notas`, en serie.
- `page.tsx:993-1008` — `cargarCuentaMesa(m)`: `sales_order` (id) → select
  separado de `notas` ("best-effort", la columna puede no existir en algún
  entorno) → `order_line` con fallback sin `user_id`.

Convención relevante: los selects con columnas que "pueden no existir aún"
reintentan con menos columnas (patrón deliberado de degradación, p. ej.
`recargarMesas`, `catalogo-store.cargar`). **Mantén ese patrón** — solo
paraleliza, no fusiones selects best-effort con los principales.

## Comandos necesarios

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Typecheck | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Dev | `pnpm --filter @gluuh/web dev` | TPV en http://localhost:3100/tpv |

## Ámbito

**Dentro**:
- `apps/web/app/tpv/page.tsx` (solo: efecto de carga inicial, `recargarMesas`, `cargarCuentaMesa`)
- `apps/web/app/tpv/components/PlanoSalas.tsx` (solo: `cargarPreviewMesa`)

**Fuera** (NO tocar):
- `catalogo-store.ts` (su `cargar` ya es un `Promise.all` interno).
- Los efectos secundarios post-montaje (`payment_method`, `nota_preparacion`,
  iconos, settings, menús) — ya corren en paralelo fuera del gate de loading.
- El orden del gate de sesión (`getSession` → redirects) — DEBE seguir siendo lo primero.
- Cualquier cambio de esquema o de RLS.

## Flujo git

- Rama: `advisor/012-arranque-paralelo`.
- Commit: `perf(tpv): arranque y carga de mesa en paralelo (menos round-trips)`.

## Pasos

### Paso 1: paralelizar el efecto de carga inicial

Reescribe el cuerpo del efecto (297-332) manteniendo el gate de sesión primero
y agrupando el resto:

```ts
const { data: { session } } = await sb.auth.getSession();
if (!session) { router.replace("/login"); return; }
if (session.user.user_metadata?.debe_cambiar_password) { router.replace("/cambiar-password"); return; }
try { const raw = localStorage.getItem("gluuh_operario"); if (raw) setOperario(JSON.parse(raw)); } catch { /* ignore */ }

// Todo lo demás es independiente entre sí: UNA ronda de peticiones.
const [ops, marcaV, loc, u, tn, , rms, rsv] = await Promise.all([
  sb.rpc("listar_operarios").then((r) => r.data),
  leerBranding(sb),
  sb.from("location").select("id,territorio_fiscal,nombre,razon_social,cif,direccion").limit(1).maybeSingle().then((r) => r.data),
  sb.from("app_user").select("id").eq("auth_user_id", session.user.id).maybeSingle().then((r) => r.data),
  sb.from("tenant").select("id").limit(1).maybeSingle().then((r) => r.data),
  useCatalogo.getState().cargar(sb),
  sb.from("room").select("id,nombre,orden,suelo").order("orden").then((r) => r.data),
  sb.from("reservation").select("id,table_id,fecha_hora,comensales,estado,notas,nombre").order("fecha_hora").then((r) => r.data),
]);
// … los mismos setters que hoy (setOperarios, setMarca, setLocationId, setTenantId,
// setTerritorio, setLocInfo, setUserId, setCatSel, setRooms, setReservas, setVistaSala) …

// Mesas y elementos pintan el plano: van en paralelo entre sí y con lo de arriba
// si prefieres incluirlas en el mismo Promise.all (recargarMesas/recargarElementos
// ya son funciones async sin dependencias del resto).
await Promise.all([recargarMesas(), recargarElementos()]);
setLoading(false);
recargarLlevar();   // no bloquea el primer pintado: la pestaña "Para llevar" se rellena sola
```

Notas de fidelidad:
- Conserva los mismos setters y defaults actuales (p. ej.
  `setTerritorio(loc?.territorio_fiscal ?? "PENINSULA_BALEARES")`).
- `setVistaSala((rms as Room[])?.[0]?.id ?? "")` igual que hoy.
- `recargarLlevar()` pasa de bloquear el loading a ejecutarse tras él
  (`void recargarLlevar()`); la lista de "Para llevar" se usa en una pestaña
  secundaria — si el ejecutor observa parpadeo del badge, es aceptable.

**Verificar**: typecheck exit 0; en dev, el TPV arranca y muestra plano, mesas,
operarios, marca y catálogo idénticos a antes.

### Paso 2: paralelizar `recargarMesas`

En `page.tsx:852-870`, lanza la query de pedidos abiertos a la vez que la cadena
de mesas:

```ts
async function recargarMesas() {
  const cols = "id,nombre,estado,room_id,pos_x,pos_y,capacidad,rotacion";
  const pOrds = sb.from("sales_order").select("table_id,total,created_at")
    .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
    .not("table_id", "is", null);           // arranca YA, sin await
  const conColor = await sb.from("restaurant_table").select(`${cols},sprite,color`).order("nombre");
  // …cadena de fallback idéntica a la actual…
  const { data: ords } = await pOrds;
  // …resto igual…
}
```

**Verificar**: typecheck exit 0; los importes por mesa siguen saliendo en el plano.

### Paso 3: paralelizar `cargarPreviewMesa` y `cargarCuentaMesa`

1. `PlanoSalas.tsx:315-332` (`cargarPreviewMesa`): tras obtener `ord`, pide
   líneas y notas a la vez:
   ```ts
   const [{ data: lns }, nq] = await Promise.all([
     sb.from("order_line").select("product_id,cantidad,precio_unitario").eq("order_id", o.id),
     sb.from("sales_order").select("notas").eq("id", o.id).maybeSingle(),
   ]);
   ```
   (3 round-trips → 2). El select de `notas` sigue separado y best-effort.
2. `page.tsx:993-1008` (`cargarCuentaMesa`): mismo cambio — la query de `notas`
   (1000-1001) y la de `order_line` con fallback (1005-1008) se lanzan en
   paralelo. Ojo: el fallback sin `user_id` depende del resultado de la primera
   variante; mantenlo secuencial DENTRO de su rama:
   ```ts
   const pNotas = sb.from("sales_order").select("notas").eq("id", oid).maybeSingle();
   const conUser = await sb.from("order_line").select("...con user_id...").eq("order_id", oid);
   const lns = conUser.error ? (await sb.from("order_line").select("...sin user_id...").eq("order_id", oid)).data : conUser.data;
   const nq = await pNotas;
   ```

**Verificar**: typecheck exit 0; tocar una mesa ocupada muestra la vista previa
con líneas y nota; abrirla carga la cuenta completa (notas, autores, pases).

### Paso 4: humo de arranque medido

En dev, con la pestaña Network del navegador:

1. Recarga `/tpv` con caché deshabilitada → las peticiones a Supabase del
   arranque salen en 2-3 "olas" (gate de sesión + ronda paralela + mesas/elementos),
   no en escalera de ~11.
2. Cronometraje burdo aceptable: `performance.now()` temporal alrededor del
   efecto o el waterfall visual de Network como evidencia en el reporte.

## Plan de tests

- Sin runner en `apps/web` (plan 015). Verificación = humo del paso 4 + los
  pasos funcionales. Ningún cálculo cambia; solo el orden temporal de peticiones.

## Criterios de hecho

- [ ] `pnpm --filter @gluuh/web typecheck` exit 0
- [ ] El efecto de carga inicial contiene UN `Promise.all` con ≥6 peticiones (inspección del diff)
- [ ] `recargarLlevar()` ya no se espera antes de `setLoading(false)`
- [ ] Humo del paso 4: waterfall en 2-3 olas (captura o descripción en el reporte)
- [ ] Vista previa de mesa y apertura de mesa funcionan igual que antes
- [ ] Solo los 2 ficheros del ámbito modificados (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## Condiciones de STOP

- Los extractos no coinciden con el código vivo (deriva no explicada por 010/011).
- Cualquier redirect del gate de sesión deja de funcionar (login/cambiar-password).
- El plano deja de mostrar importes o reservas tras el paso 1 y no se resuelve
  al primer intento (probable dependencia oculta entre setters).

## Notas de mantenimiento

- Si se añaden nuevas cargas al arranque, van DENTRO del `Promise.all` (o después
  del `setLoading(false)` si no pintan la primera pantalla) — no volver a la escalera.
- Cuando llegue el modo local/offline (PowerSync, decisión 06-07), este efecto
  cambiará de forma natural; este plan no intenta anticiparlo.
- Revisor: comprobar que ningún setter usa datos de otra promesa del mismo
  `Promise.all` (no hay dependencias cruzadas en el código actual).
