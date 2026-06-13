import { Injectable } from "@nestjs/common";
import {
  calcularImpuestosIncluidos,
  construirUrlQR,
  encadenarRegistros,
  formatImporte,
  LEYENDA_VERIFACTU,
  type EntornoAEAT,
  type LineaFiscal,
  type Territorio,
} from "@servio/core";

export interface PreviewTicketDto {
  lineas: LineaFiscal[];
  territorio: Territorio;
  nif: string;
  numSerieFactura: string;
  fechaExpedicion: string; // dd-mm-aaaa
  fechaHoraHusoGenRegistro: string; // ISO 8601 con huso
  huellaRegistroAnterior?: string;
  entorno?: EntornoAEAT;
}

/**
 * Servicio fiscal. Demuestra cómo el backend usa @servio/core para calcular
 * impuestos (IVA/IGIC) y generar el registro VERIFACTU (huella + QR) en el
 * punto controlado y auditable que exige la normativa (ver docs/07 §0 y docs/04).
 *
 * En producción este servicio además: asigna la numeración correlativa, persiste
 * el verifactu_record y encola el envío a la AEAT.
 */
@Injectable()
export class FiscalService {
  previewTicket(dto: PreviewTicketDto) {
    const impuestos = calcularImpuestosIncluidos(dto.lineas, dto.territorio);

    const cadena = encadenarRegistros(
      [
        {
          idEmisorFactura: dto.nif,
          numSerieFactura: dto.numSerieFactura,
          fechaExpedicionFactura: dto.fechaExpedicion,
          tipoFactura: "F2", // factura simplificada (ticket)
          cuotaTotal: formatImporte(impuestos.cuotaTotal),
          importeTotal: formatImporte(impuestos.importeTotal),
          fechaHoraHusoGenRegistro: dto.fechaHoraHusoGenRegistro,
        },
      ],
      dto.huellaRegistroAnterior ?? "",
    );
    const registro = cadena[0]!;

    const qrUrl = construirUrlQR({
      nif: dto.nif,
      numSerieFactura: dto.numSerieFactura,
      fechaExpedicion: dto.fechaExpedicion,
      importeTotal: formatImporte(impuestos.importeTotal),
      entorno: dto.entorno ?? "pruebas",
    });

    return {
      impuestos,
      verifactu: {
        leyenda: LEYENDA_VERIFACTU,
        huella: registro.huella,
        huellaRegistroAnterior: registro.huellaRegistroAnterior,
        qrUrl,
      },
    };
  }
}
