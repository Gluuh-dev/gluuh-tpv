/**
 * Conector PowerSync ↔ backend de Servio.
 *
 * - fetchCredentials: obtiene el token y la URL del servicio PowerSync.
 * - uploadData: sube los cambios locales (cola de escritura) a NUESTRO backend
 *   (NestJS), que valida (tenant, permisos, fiscalidad) antes de persistir en
 *   PostgreSQL. Si la subida falla, NO se completa la transacción → se reintenta
 *   (clave para el modo offline). Ver docs/04 §3.2 y docs/06 §4.
 *
 * La base de datos concreta (PowerSyncDatabase) es específica de plataforma
 * (@powersync/web en escritorio/web, @powersync/react-native en móvil); el
 * esquema (schema.ts) y este conector se comparten.
 */

import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
} from "@powersync/common";

export interface ServioConnectorOptions {
  /** URL base del API de Servio (NestJS). */
  apiUrl: string;
  /** URL del servicio PowerSync. */
  powersyncUrl: string;
  /** Devuelve un JWT válido (con tenant_id + rol). Ver docs/05 §11. */
  getToken: () => Promise<string>;
}

export class ServioConnector implements PowerSyncBackendConnector {
  constructor(private readonly opts: ServioConnectorOptions) {}

  async fetchCredentials() {
    const token = await this.opts.getToken();
    return {
      endpoint: this.opts.powersyncUrl,
      token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const tx = await database.getNextCrudTransaction();
    if (!tx) return;

    const ops = tx.crud.map((entry) => ({
      op: entry.op, // PUT | PATCH | DELETE
      table: entry.table,
      id: entry.id,
      data: entry.opData,
    }));

    const res = await fetch(`${this.opts.apiUrl}/sync/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await this.opts.getToken()}`,
      },
      body: JSON.stringify({ ops }),
    });

    if (!res.ok) {
      // No completamos la transacción: PowerSync la reintentará más tarde.
      throw new Error(`Sync upload falló: HTTP ${res.status}`);
    }

    await tx.complete();
  }
}
