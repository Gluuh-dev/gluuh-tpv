import { Module } from "@nestjs/common";
import { FiscalModule } from "./fiscal/fiscal.module";
import { SyncModule } from "./sync/sync.module";

/**
 * Módulo raíz del backend.
 *
 * Monta el módulo fiscal (motor VERIFACTU/impuestos sobre @servio/core) y el
 * módulo de sincronización (write-path de PowerSync). Próximos módulos: auth,
 * pedidos, pagos, informes. Ver docs/04-arquitectura-tecnica.md.
 */
@Module({
  imports: [FiscalModule, SyncModule],
})
export class AppModule {}
