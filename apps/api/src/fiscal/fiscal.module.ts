import { Module } from "@nestjs/common";
import { FiscalController } from "./fiscal.controller";
import { FiscalService } from "./fiscal.service";
import { AeatService } from "./aeat.service";
import { OutboxWorker } from "./outbox.worker";

@Module({
  controllers: [FiscalController],
  // OutboxWorker: envío durable a la AEAT (0118/0119). Solo corre con OUTBOX_AEAT=1.
  providers: [FiscalService, AeatService, OutboxWorker],
})
export class FiscalModule {}
