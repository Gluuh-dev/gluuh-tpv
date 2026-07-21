# 26 — Diseñar el TPV CONECTADO a datos reales (nodo o nube)

> Objetivo: ver los cambios en tiempo real contra datos reales mientras se
> programa, sin pegar sesiones a mano ni caer en modo demo. Trabajar contra la
> **nube** mientras el nodo se termina y **cambiar al nodo** sin tocar la app.

## El problema

El TPV solo lee/escribe datos reales si tiene una **sesión de dispositivo** (un
JWT con el claim `tenant_id`) en `localStorage`. Sin ella, cada pantalla enseña
su **demo** («Bar La Alameda»). En un bar la pone el emparejado (F4); en dev
había que firmarla a mano y pegarla en la consola en cada navegador — y si se
borraba el `localStorage`, volvías a demo sin enterarte.

Además daba igual el origen: la app siempre hablaba con el **nodo** (mismo
origen vía proxy). Para diseñar sin depender de que el nodo esté arrancado, hace
falta poder apuntar a la **nube** (Supabase) igual de fácil.

## La solución: sesión de dev inyectada + conmutador de destino

Todo el cambio vive en dos sitios, y **producción no se toca** (el build queda en
modo `nodo` sin sesión de dev: manda el emparejado real).

### 1. `vite.config.ts` — firma e inyecta la sesión, SOLO en `vite serve`

Al arrancar el dev server, firma un token de larga duración para el tenant de
pruebas y lo inyecta como `import.meta.env.VITE_DEV_SESION`:

- **nodo** (por defecto): firma con el secreto del propio nodo (`.nodo/nodo.env`).
  El secreto **no** viaja al bundle: solo se usa para firmar; viaja el token.
- **nube**: firma con `SUPABASE_JWT_SECRET` (del panel de Supabase). La nube lee
  el mismo claim `tenant_id` en `current_tenant_id()`, así que el token vale con
  su RLS igual que en el nodo.

En `vite build` no se genera nada (`VITE_DEV_SESION=""`).

### 2. `lib/nodo.ts` — de dónde saca la sesión y a qué origen habla

- `sesion()` = la de `localStorage` (emparejado real) **o**, si no hay, la de dev
  (`VITE_DEV_SESION`). En producción esa var es `""`, así que manda el emparejado.
- `BASE`: `nodo` = mismo origen (proxy de Vite → gateway :54321). `nube` = la URL
  de Supabase (cross-origin, con CORS + `apikey`).
- `apikey` solo se añade en modo nube (el nodo lo ignora).

Así **la app no distingue** nodo de nube: misma capa `leer`/`escribir`, mismo
contrato PostgREST + RLS por `tenant_id`. Cambiar de destino es una variable.

## Cómo se usa

Copia `apps/tpv/.env.example` a `apps/tpv/.env.local` y elige destino.

### Contra el NODO (por defecto — es el destino de producción)

Requiere el nodo arrancado (gateway :54321 + PG :55432). Con eso:

```
pnpm --filter @gluuh/tpv dev
```

Abre `http://localhost:3120` (o el puerto que diga la consola) y ya sale
**conectado**: arriba «RESTAURANTE DE PRUEBAS S.L. · TPV PRUEBAS (DEV)» y el chip
verde «Node conectado». Todo lo que toques persiste en el nodo.

### Contra la NUBE (mientras el nodo se termina)

En `apps/tpv/.env.local`:

```
VITE_DESTINO=nube
SUPABASE_JWT_SECRET=<panel Supabase → Settings → API → JWT Secret>
```

`pnpm --filter @gluuh/tpv dev` y trabajas contra Supabase sin el nodo. La URL y
la anon key ya vienen por defecto en `vite.config.ts`.

Para volver al nodo: quita `VITE_DESTINO=nube` (o ponlo a `nodo`) y reinicia dev.

## Notas

- El **dato** es el mismo en nodo y nube: el «Restaurante de pruebas» (tenant
  `4c79…`) está sembrado idéntico en ambos (ver `scripts/plantillas/operativa-pruebas.sql`).
- La sesión de dev es un **JWT de 10 años** para el tenant de pruebas; se puede
  poner en el bundle sin problema (no lleva secreto). Nunca se genera en `build`.
- Subir fotos (`subirImagen`) va al storage del destino; en nube exige el bucket
  `media`. Para diseñar no hace falta: la galería son assets del propio bundle.
- Emparejado a mano (otro tenant, otro navegador) sigue disponible:
  `node scripts/emparejar-tpv-dev.mjs [tenant]`. El `localStorage` gana a la
  sesión de dev.
