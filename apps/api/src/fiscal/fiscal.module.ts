import { Module } from "@nestjs/common";
import { FiscalController } from "./fiscal.controller";
import { FiscalService } from "./fiscal.service";
import { AeatService } from "./aeat.service";

@Module({
  controllers: [FiscalController],
  providers: [FiscalService, AeatService],
})
export class FiscalModule {}
