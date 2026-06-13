import { Body, Controller, Post } from "@nestjs/common";
import { FiscalService, type PreviewTicketDto } from "./fiscal.service";

/**
 * Endpoints del motor fiscal.
 *
 *   POST /fiscal/preview  → impuestos + huella + QR (no envía)
 *   POST /fiscal/xml      → XML VERIFACTU + sobre SOAP (no envía)
 *   POST /fiscal/enviar   → construye y REMITE a la AEAT (requiere certificado)
 *
 * Cuerpo de ejemplo:
 *   {
 *     "lineas": [{ "importe": 19.0, "tipo": 7 }, { "importe": 12.0, "tipo": 15 }],
 *     "territorio": "CANARIAS",
 *     "nif": "B12345678",
 *     "nombreRazonEmisor": "Bar La Palma",
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

  @Post("xml")
  xml(@Body() dto: PreviewTicketDto) {
    return this.fiscal.construirEnvio(dto);
  }

  @Post("enviar")
  enviar(@Body() dto: PreviewTicketDto) {
    return this.fiscal.enviar(dto);
  }
}
