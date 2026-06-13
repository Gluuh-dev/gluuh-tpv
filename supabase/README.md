# Supabase — base de datos de Servio

**Sí: toda la base de datos puede ser Supabase.** Supabase es **PostgreSQL gestionado** + **Auth** + **Realtime** + **Storage** + **Edge Functions**. El esquema de Servio (multi‑tenant con RLS) corre tal cual. Ver [docs/05 §7](../docs/05-stack-tecnologico.md) y [docs/06](../docs/06-base-de-datos-y-sincronizacion.md).

## Qué cubre Supabase y qué no

| Necesidad | Cubierto por |
|-----------|--------------|
| Datos (PostgreSQL + RLS) | ✅ Supabase |
| Autenticación + JWT (`tenant_id`, rol) | ✅ Supabase Auth |
| Tiempo real (KDS, display de cliente) | ✅ Supabase Realtime |
| Ficheros (fotos de productos, logos) | ✅ Supabase Storage |
| **Motor fiscal** (hash VERIFACTU, envío AEAT con certificado) | ⚠️ Lógica de confianza → **Edge Function** o mini‑servicio Node (`apps/api`) |
| **Offline‑first** (SQLite local + sync) | ➕ **PowerSync** conectado al Postgres de Supabase (`packages/sync`) |

## Aplicar el esquema

```bash
# Opción A — Supabase CLI
supabase init           # si aún no está iniciado
supabase db push        # aplica supabase/migrations/0001_init.sql

# Opción B — psql directo
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
```

> `supabase/migrations/0001_init.sql` es **espejo** de `apps/api/db/schema.sql`. Mantenlos sincronizados (o elige uno como canónico cuando se adopte el CLI).

## RLS con Supabase (detalle importante)

El esquema usa `current_setting('app.tenant_id')` para el aislamiento. Con Supabase Auth, las políticas RLS pueden leer el `tenant_id` directamente del **JWT**:

```sql
-- En lugar de current_setting, con Supabase:
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

Añade `tenant_id` (y `role`) como **custom claims** del JWT (vía Auth Hook / función) y las políticas filtran solas. El mismo claim alimenta los **buckets de PowerSync**. Ver [docs/12](../docs/12-seguridad-y-rgpd.md).

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>     # cliente
SUPABASE_SERVICE_ROLE_KEY=<service-role>     # SOLO servidor (motor fiscal/admin)
```

Uso desde el cliente:

```ts
import { createServioClient } from "@servio/supabase";
const supabase = createServioClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});
```
