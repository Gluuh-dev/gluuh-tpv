import { Module } from "@nestjs/common";
import { FiscalModule } from "./fiscal/fiscal.module";

/**
 * Módulo raíz del backend.
 *
 * Esqueleto: por ahora solo monta el módulo fiscal (demostración del uso de
 * @servio/core). Próximos módulos: auth, sync (write-path PowerSync), pedidos,
 * pagos, informes. Ver docs/04-arquitectura-tecnica.md.
 */
@Module({
  imports: [FiscalModule],
})
export class AppModule {}
