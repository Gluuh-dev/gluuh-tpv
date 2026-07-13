# Plan 014: Miniaturas de fotos de producto (subida redimensionada + carga perezosa en los tiles)

> **Instrucciones para el ejecutor**: sigue este plan paso a paso, verifica cada
> paso, respeta las "Condiciones de STOP" y actualiza tu fila en
> `plans/README.md` al terminar.
>
> **Comprobación de deriva (ejecutar primero)**:
> `git diff --stat 9c959d1..HEAD -- apps/web/app/lib/branding.ts apps/web/app/tpv/components/TileProducto.tsx apps/web/app/tpv/components/TileCategoria.tsx`
> Plan escrito contra el árbol de trabajo del 2026-07-11. Si los extractos no
> coinciden, es STOP.

## Estado

- **Prioridad**: P2
- **Esfuerzo**: M
- **Riesgo**: LOW
- **Depende de**: ninguno
- **Categoría**: perf
- **Planificado en**: commit `9c959d1` (+ working tree), 2026-07-11

## Por qué importa

Los tiles de producto del TPV (y el kiosko) pintan la `foto_url` **original** de
Supabase Storage en miniaturas de ~78-118 px. Las fotos se suben desde el móvil
o el panel sin redimensionar (`subirMedia` sube el `File` tal cual), así que una
carta con 40 fotos de 1-3 MB descarga y decodifica varios MB para pintar una
pantalla — primer pintado lento de cada categoría, jank de scroll y memoria alta
en terminales modestos. No hay `next/image` en la app (y en Cloudflare Workers
exigiría configurar un loader); la vía más corta y sin dependencias es
**redimensionar en el navegador al subir** y añadir carga perezosa donde ya hay
`<img>`.

## Estado actual

- `apps/web/app/lib/branding.ts:39-50` — `subirMedia` sube el fichero sin tocar:
  ```ts
  export async function subirMedia(sb, tenantId, file: File, carpeta: string): Promise<string> {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${tenantId}/${carpeta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("media").upload(path, file, { upsert: true });
    if (error) throw error;
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  }
  ```
  La usan (grep `subirMedia(`): el alta rápida del TPV (`app/tpv/page.tsx:1649`),
  fichas de producto/categoría del panel, personalizar (logos), ofertas…
- `apps/web/app/tpv/components/TileProducto.tsx:33-45` — variante con foto usa
  `background-image` (no puede hacer lazy-load nativo):
  ```tsx
  <button type="button" {...press} disabled={agotado}
    className={`relative flex min-h-[78px] ... bg-cover bg-center ...`}
    style={{ backgroundImage: `url("${foto}")` }}>
  ```
- `apps/web/app/tpv/components/TileCategoria.tsx` — usa `<img src={foto}>` sin
  `loading`/`decoding` (línea ~34).
- Kiosko/ofertas también pintan `<img>` crudos (`app/kiosko/page.tsx:416,428,454`,
  `app/ofertas/page.tsx:88`) — mismo problema, misma solución de subida.
- El plano NO es problema (SVGs de `public/plano` <8 KB, `logo.png` 9 KB).

## Comandos necesarios

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Typecheck | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Dev | `pnpm --filter @gluuh/web dev` | http://localhost:3100 |

## Ámbito

**Dentro**:
- `apps/web/app/lib/branding.ts` (solo `subirMedia`)
- `apps/web/app/tpv/components/TileProducto.tsx`
- `apps/web/app/tpv/components/TileCategoria.tsx`
- `apps/web/app/kiosko/page.tsx` y `apps/web/app/ofertas/page.tsx` (solo añadir
  `loading="lazy" decoding="async"` a los `<img>` de fotos dinámicas)

**Fuera** (NO tocar):
- Fotos YA subidas (no hay backfill en este plan; ver mantenimiento).
- `next.config.mjs` / `next/image` — descartado por el loader de Cloudflare.
- Subidas de documentos no-imagen si las hubiera (el resize solo aplica a `image/*`).
- El estilo/las clases de los tiles (mismo aspecto exacto).

## Flujo git

- Rama: `advisor/014-miniaturas-fotos`.
- Commit: `perf(web): fotos redimensionadas al subir + carga perezosa en tiles`.

## Pasos

### Paso 1: redimensionar en `subirMedia` antes de subir

En `branding.ts`, añade un helper privado y úsalo dentro de `subirMedia`:

```ts
// Reduce una imagen en el navegador antes de subirla (máx 1024 px de lado,
// webp q0.82). Los tiles del TPV/kiosko pintan miniaturas: subir la foto de
// cámara original (1-3 MB) solo aporta jank. No-imagen o fallo → fichero original.
async function reducirImagen(file: File, maxLado = 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    if (escala >= 1 && file.size < 300_000) return file;   // ya pequeña: no tocar
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;      // webp no ayudó: original
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch { return file; }   // navegador raro: degradar a subir el original
}
```

y en `subirMedia`, primera línea del cuerpo: `file = await reducirImagen(file);`
(la extensión del `path` se deriva de `file.name`, que ya sale como `.webp`).

Cuidado: `subirMedia` la usan también los LOGOS de marca (`personalizar`); 1024 px
es más que suficiente para un logo de ticket/cabecera, así que el mismo límite
vale — no añadas parámetros por llamador (YAGNI).

**Verificar**: typecheck exit 0. En dev, subir una foto de >2 MB desde
Carta → producto → el objeto en el bucket `media` pesa <300 KB (compruébalo en
el panel de Supabase Storage o por el `Content-Length` de la URL pública).

### Paso 2: `TileProducto` pasa de background-image a `<img>` perezosa

Sustituye la variante con foto (33-45) manteniendo clases y aspecto:

```tsx
<button type="button" {...press} disabled={agotado}
  className={`relative flex min-h-[78px] overflow-hidden rounded-[9px] border border-border shadow-[0_2px_0_rgba(0,0,0,.28)] transition-transform active:translate-y-px active:scale-100 ${agotado ? "grayscale opacity-40 pointer-events-none" : ""}`}>
  <img src={foto} alt="" loading="lazy" decoding="async"
    className="absolute inset-0 h-full w-full object-cover" draggable={false} />
  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
  {/* …resto idéntico (badge 86, nombre, precio)… */}
</button>
```

(Quita `bg-cover bg-center` y el `style` del botón; la `<img>` absoluta con
`object-cover` reproduce el mismo encuadre y habilita lazy/async nativos.)

**Verificar**: typecheck exit 0. En dev, el grid con fotos se ve idéntico
(degradado, nombre, precio, badge 86) y en Network las fotos fuera de viewport
no se piden hasta hacer scroll.

### Paso 3: lazy en el resto de `<img>` dinámicas

Añade `loading="lazy" decoding="async"` a:
- `TileCategoria.tsx` (la `<img>` de `foto`),
- `app/kiosko/page.tsx:416,428,454`,
- `app/ofertas/page.tsx:88`.

No toques `<img>` de logos pequeños (cabeceras) ni las de `public/`.

**Verificar**: typecheck exit 0; kiosko y ofertas se ven igual.

### Paso 4: humo

1. TPV: categoría con fotos → scroll fluido; primer pintado sin "oleada" de red.
2. Alta rápida de producto con foto desde el TPV (`NUEVO_PROD`) → la foto sube
   reducida y el tile la muestra.
3. Personalizar → subir logo → se ve bien en el panel y en el ticket de prueba.

## Plan de tests

- Sin runner en web (plan 015). `reducirImagen` depende de APIs de navegador
  (canvas/createImageBitmap): la verificación es el humo + el peso del objeto
  subido. Si el plan 015 ya está ejecutado, NO añadas tests de canvas con mocks
  (probarían el mock).

## Criterios de hecho

- [ ] `pnpm --filter @gluuh/web typecheck` exit 0
- [ ] `grep -n "backgroundImage" apps/web/app/tpv/components/TileProducto.tsx` → 0 resultados
- [ ] `grep -rn "loading=\"lazy\"" apps/web/app/tpv/components/ apps/web/app/kiosko/page.tsx apps/web/app/ofertas/page.tsx` → ≥4 resultados
- [ ] Subida de foto >2 MB → objeto <300 KB en el bucket (evidencia en el reporte)
- [ ] Humo del paso 4 sin diferencias visuales
- [ ] Solo los 5 ficheros del ámbito modificados (`git status`)
- [ ] Fila actualizada en `plans/README.md`

## Condiciones de STOP

- Los extractos no coinciden con el código vivo.
- El aspecto de los tiles cambia visiblemente tras el paso 2 (encuadre/degradado)
  y no se iguala al primer intento.
- Alguna subida no-imagen (p. ej. un PDF en otra pantalla) pasa por `subirMedia`
  y el resize la rompe — repórtalo (el guard `image/*` debería impedirlo).

## Notas de mantenimiento

- **Fotos antiguas**: siguen a tamaño completo. Si molestan, un mini-script de
  backfill (descargar → reducir → re-subir al mismo path) es la continuación
  natural; fuera de este plan a propósito.
- Si el proyecto pasa al plan Pro de Supabase, las transformaciones de Storage
  (`getPublicUrl(path, { transform: { width } })`) permiten miniaturas por
  contexto sin re-subir; este plan no lo asume para no atar el rendimiento a un
  tier de pago.
- Revisor: comprobar que `draggable={false}` está en la `<img>` del tile (los
  long-press de agotado no deben iniciar drag de imagen).
