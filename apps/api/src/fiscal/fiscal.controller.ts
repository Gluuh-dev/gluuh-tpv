import { Body, Controller, Post } from "@nestjs/common";
import { FiscalService, type PreviewTicketDto } from "./fiscal.service";

/**
 * Endpoint de demostración del motor fiscal.
 *
 *   POST /fiscal/preview
 *   {
 *     "lineas": [{ "importe": 5.0, "tipo": 7 }, { "importe": 6.0, "tipo": 15 }],
 *     "territorio": "CANARIAS",
 *     "nif": "B12345678",
 *     "numSerieFactura": "F2-2026-000123",
 *     "fechaExpedicion": "12-06-2026",
 *     "fechaHoraHusoGenRegistro": "2026-06-12T21:05:00+01:00"
 *   }
 */
@Controller("fiscal")
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Post("preview")
  preview(@Body() dto: PreviewTicketDto) {
    return this.fiscal.previewTicket(dto);
  }
}
