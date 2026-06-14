# @gluppo/sync — Sincronización offline-first (PowerSync)

Esquema y conector compartidos para el modo **offline-first** del TPV. Ver el diseño completo en [docs/06](../../docs/06-base-de-datos-y-sincronizacion.md).

## Qué hay aquí

- **`schema.ts`** — esquema de la base de datos **local (SQLite)** de cada dispositivo (subconjunto operativo: carta, mesas, comandas, pagos). PowerSync mantiene esta copia local sincronizada con PostgreSQL.
- **`connector.ts`** — `GluppoConnector`: obtiene credenciales y **sube los cambios locales a nuestro backend** (que valida tenant/permisos/fiscalidad antes de persistir). Si la subida falla, reintenta (clave offline).

## Cómo se usa (por plataforma)

La base de datos concreta es específica de plataforma; el esquema y el conector se comparten:

```ts
// Escritorio / Web (@powersync/web)
import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema, GluppoConnector } from "@gluppo/sync";

const db = new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: "gluppo.db" } });
await db.connect(new GluppoConnector({
  apiUrl: "https://api.gluppo.app",
  powersyncUrl: "https://<tu-instancia>.powersync.journeyapps.com",
  getToken: async () => obtenerJwt(),
}));
```

```ts
// Móvil (@powersync/react-native) — idéntico, cambiando el import del paquete.
import { PowerSyncDatabase } from "@powersync/react-native";
```

## Requisitos de infraestructura (para que funcione de verdad)

1. **Servicio PowerSync** conectado a la base PostgreSQL (`apps/api/db/schema.sql`).
2. **Sync rules** que definan los *buckets por `tenant_id`** (cada dispositivo solo descarga los datos de su restaurante).
3. **Write-path** en el backend: endpoint `POST /sync/upload` (ya esbozado en `apps/api/src/sync/`) que valida y persiste.
4. **JWT** con `tenant_id` + rol para credenciales y RLS (ver [docs/05 §11](../../docs/05-stack-tecnologico.md) y [docs/12](../../docs/12-seguridad-y-rgpd.md)).

> Esta pieza no se puede ejecutar de extremo a extremo sin la infraestructura anterior; el esquema y el conector sí están listos y tipados.
