import { Injectable } from "@nestjs/common";
import {
  calcularImpuestosIncluidos,
  construirEnvioVerifactuXml,
  construirRegistroAltaXml,
  construirSobreSoap,
  construirUrlQR,
  detallesDesdeImpuestos,
  encadenarRegistros,
  formatImporte,
  LEYENDA_VERIFACTU,
  type EntornoAEAT,
  type Encadenamiento,
  type LineaFiscal,
  type SistemaInformatico,
  type Territorio,
} from "@servio/core";
import { AeatService } from "./aeat.service";

/** Identidad de nuestro software de facturación (declaración responsable, docs/07 §3.5). */
const SISTEMA_INFORMATICO: SistemaInformatico = {
  nombreRazon: "Servio Software SL",
  nif: "B99999999",
  nombreSistemaInformatico: "Servio TPV",
  idSistemaInformatico: "01",
  version: "1.0",
  numeroInstalacion: "0001",
};

export interface RegistroAnteriorDto {
  numSerieFactura: string;
  fechaExpedicionFactura: string;
  huella: string;
}

export interface PreviewTicketDto {
  lineas: LineaFiscal[];
  territorio: Territorio;
  nif: string;
  nombreRazonEmisor?: string;
  numSerieFactura: string;
  fechaExpedicion: string; // dd-mm-aaaa
  fechaHoraHusoGenRegistro: string; // ISO 8601 con huso
  huellaRegistroAnterior?: string;
  registroAnterior?: RegistroAnteriorDto;
  entorno?: EntornoAEAT;
}

@Injectable()
export class FiscalService {
  constructor(private readonly aeat: AeatService) {}

  /** Calcula impuestos y genera el registro VERIFACTU (huella + QR). */
  previewTicket(dto: PreviewTicketDto) {
    const impuestos = calcularImpuestosIncluidos(dto.lineas, dto.territorio);

    const cadena = encadenarRegistros(
      [
        {
          idEmisorFactura: dto.nif,
          numSerieFactura: dto.numSerieFactura,
          fechaExpedicionFactura: dto.fechaExpedicion,
          tipoFactura: "F2",
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

  /** Construye el mensaje XML VERIFACTU y su sobre SOAP (sin enviar). */
  construirEnvio(dto: PreviewTicketDto) {
    const preview = this.previewTicket(dto);
    const impuestos = preview.impuestos;

    const encadenamiento: Encadenamiento = dto.registroAnterior
      ? {
          anterior: {
            idEmisorFactura: dto.nif,
            numSerieFactura: dto.registroAnterior.numSerieFactura,
            fechaExpedicionFactura: dto.registroAnterior.fechaExpedicionFactura,
            huella: dto.registroAnterior.huella,
          },
        }
      : { primerRegistro: true };

    const registroXml = construirRegistroAltaXml({
      idEmisorFactura: dto.nif,
      numSerieFactura: dto.numSerieFactura,
      fechaExpedicionFactura: dto.fechaExpedicion,
      nombreRazonEmisor: dto.nombreRazonEmisor ?? "Emisor",
      tipoFactura: "F2",
      descripcionOperacion: "Servicio de restauración",
      detalles: detallesDesdeImpuestos(impuestos),
      cuotaTotal: formatImporte(impuestos.cuotaTotal),
      importeTotal: formatImporte(impuestos.importeTotal),
      encadenamiento,
      sistemaInformatico: SISTEMA_INFORMATICO,
      fechaHoraHusoGenRegistro: dto.fechaHoraHusoGenRegistro,
      huella: preview.verifactu.huella,
    });

    const xml = construirEnvioVerifactuXml(
      { nombreRazon: dto.nombreRazonEmisor ?? "Emisor", nif: dto.nif },
      [registroXml],
    );
    const soap = construirSobreSoap(xml);

    return { huella: preview.verifactu.huella, xml, soap };
  }

  /** Construye el envío y lo remite a la AEAT (requiere certificado, ver AeatService). */
  async enviar(dto: PreviewTicketDto) {
    const { soap, huella } = this.construirEnvio(dto);
    const respuesta = await this.aeat.enviarSoap(soap);
    return { huella, aeat: respuesta };
  }
}
