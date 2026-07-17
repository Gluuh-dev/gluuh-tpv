# Supabase — base de datos de Gluuh

**Sí: toda la base de datos puede ser Supabase.** Supabase es **PostgreSQL gestionado** + **Auth** + **Realtime** + **Storage** + **Edge Functions**. El esquema de Gluuh (multi‑tenant con RLS) corre tal cual. Ver [docs/05 §7](../docs/dossier/05-stack-tecnologico.md) y [docs/06](../docs/dossier/06-base-de-datos-y-sincronizacion.md).

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

**`supabase/migrations/*.sql` es el esquema canónico** (decisión 12-07-2026;
`apps/api/db/schema.sql` es solo documentación histórica y NO se sincroniza).
Una migración nueva = reservar el siguiente número en `docs/estado/AHORA.md`
**antes** de escribir el fichero. Leer la skill `gluuh-base-datos` primero.

## Tipos generados (contrato del esquema)

`supabase/types/database.types.ts` se genera desde la **base viva** del proyecto
autorizado (`gxcqihslbicrszgzudjs`) y es el contrato que compila el código
(`GluuhContractDatabase` en `packages/supabase`). No se edita a mano.

```bash
pnpm tipos:generar    # regenera (UTF-8 sin BOM, LF, reemplazo atómico)
pnpm tipos:check      # gate de drift: falla si nube ≠ fichero versionado
pnpm contrato:check   # sin red: los .from()/.rpc() literales existen en el contrato
```

Los dos primeros requieren `SUPABASE_ACCESS_TOKEN` (solo lectura); sin él salen
con código 2 y el gate queda en manual. **Toda migración termina regenerando los
tipos** y dejando `contrato:check` en verde.

## RLS con Supabase (detalle importante)

El esquema usa `current_setting('app.tenant_id')` para el aislamiento. Con Supabase Auth, las políticas RLS pueden leer el `tenant_id` directamente del **JWT**:

```sql
-- En lugar de current_setting, con Supabase:
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

Añade `tenant_id` (y `role`) como **custom claims** del JWT (vía Auth Hook / función) y las políticas filtran solas. El mismo claim alimenta los **buckets de PowerSync**. Ver [docs/12](../docs/dossier/12-seguridad-y-rgpd.md).

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>     # cliente
SUPABASE_SERVICE_ROLE_KEY=<service-role>     # SOLO servidor (motor fiscal/admin)
```

Uso desde el cliente:

```ts
import { createGluuhClient } from "@gluuh/supabase";
const supabase = createGluuhClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
});
```
