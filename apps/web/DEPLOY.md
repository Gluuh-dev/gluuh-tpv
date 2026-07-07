# Despliegue de @gluuh/web en Cloudflare

Hosting elegido: **Cloudflare Workers** vía OpenNext (plan gratis con uso
comercial permitido; Next 16 soportado). Guía plan `docs/plan/09` (bloque B).

## Estructura de dominios (gluuh.com)

| Host | Sirve | Login |
|---|---|---|
| `www.gluuh.com` | Página comercial | — |
| `app.gluuh.com` | Backoffice + TPV nube | usuario + password (cliente) |
| `admin.gluuh.com` | Plataforma (crear empresas, licencias) | tu email — **solo aquí existe /admin** |

Los tres son el **mismo Worker**; `admin.gluuh.com` habilita `/admin` porque su
host está en `PLATAFORMA_HOSTS` (proxy `apps/web/proxy.ts`). En cualquier otro
host, `/admin` y `/api/admin` devuelven 404.

## Pasos (una vez)

1. **Instalar deps** (ya en package.json): `pnpm install`.
2. **Eliminar la plantilla "Growix"** del proyecto Vercel actual (o quitar el
   dominio de Vercel para que Cloudflare tome el control del DNS).
3. **Cloudflare**: crear el Worker; DNS de `gluuh.com` en Cloudflare; añadir
   Custom Domains `www`, `app`, `admin` apuntando al Worker.
4. **Variables** (Worker → Settings → Variables, o `wrangler secret put`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (secret), `DEVICE_JWT_SECRET` (secret)
   - `PLATAFORMA_HOSTS=admin.gluuh.com`
5. **Supabase Auth** → URL Configuration: Site URL `https://app.gluuh.com` y
   Redirect URLs con `https://app.gluuh.com/**` y `https://admin.gluuh.com/**`.
6. **Redirecciones** (opcional): `www.gluuh.com/app` → `app.`, `/admin` → `admin.`
   (regla de redirect en Cloudflare) para poder teclear cualquiera.

## Desplegar

```bash
pnpm --filter @gluuh/web deploy:cf     # build OpenNext + deploy al Worker
pnpm --filter @gluuh/web preview:cf    # probar en local con el runtime de Workers
```

## Notas

- `wrangler.jsonc` y `open-next.config.ts` ya están en el repo; `.open-next/` se
  ignora.
- El `proxy.ts` es middleware estándar (no "Node middleware") → soportado por
  OpenNext.
- Coste: Cloudflare gratis; el gasto fijo real es **Supabase Pro (25 $/mes) al
  primer cliente** (el plan gratis pausa el proyecto tras inactividad).
