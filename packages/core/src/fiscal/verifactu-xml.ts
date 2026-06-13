/**
 * Construcción del XML del registro de facturación de alta VERIFACTU y del
 * mensaje de envío (RegFactuSistemaFacturacion) para el web service de la AEAT.
 *
 * ⚠️ MUY IMPORTANTE: los NOMBRES DE LOS NAMESPACES (URLs de los XSD) y algunos
 * detalles del esquema cambian entre versiones. Los valores de NS_SUM / NS_SF de
 * abajo son APROXIMADOS y DEBEN reconfirmarse contra los XSD oficiales vigentes
 * del portal de desarrolladores de la AEAT antes de enviar nada real.
 * La ESTRUCTURA de etiquetas (IDFactura, Desglose, Encadenamiento, Huella…) sí
 * sigue la documentación. Ver docs/07-facturacion-y-cumplimiento-legal.md §3.
 */

import type { Impuesto, ResultadoImpuestos } from "./tax.js";

/** Namespaces (RECONFIRMAR con los XSD oficiales vigentes). */
export const NS_SUM =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeli/SistemaFacturacion/ws/SuministroLR.xsd";
export const NS_SF =
  "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeli/SistemaFacturacion/ws/SuministroInformacion.xsd";

/** Código de impuesto en el esquema AEAT: 01 IVA, 02 IPSI, 03 IGIC. */
export function codigoImpuesto(impuesto: Impuesto): "01" | "02" | "03" {
  switch (impuesto) {
    case "IVA":
      return "01";
    case "IPSI":
      return "02";
    case "IGIC":
      return "03";
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface DetalleDesgloseXml {
  impuesto: "01" | "02" | "03";
  /** "7.00" */
  tipoImpositivo: string;
  /** "17.75" */
  baseImponible: string;
  /** "1.25" */
  cuotaRepercutida: string;
  /** Clave de régimen (por defecto "01" operación general). */
  claveRegimen?: string;
  /** Calificación de la operación (por defecto "S1" sujeta y no exenta). */
  calificacionOperacion?: string;
}

export interface SistemaInformatico {
  nombreRazon: string;
  nif: string;
  nombreSistemaInformatico: string;
  idSistemaInformatico: string;
  version: string;
  numeroInstalacion: string;
}

export type Encadenamiento =
  | { primerRegistro: true }
  | {
      anterior: {
        idEmisorFactura: string;
        numSerieFactura: string;
        fechaExpedicionFactura: string;
        huella: string;
      };
    };

export interface RegistroAltaXmlInput {
  idVersion?: string; // "1.0"
  idEmisorFactura: string;
  numSerieFactura: string;
  fechaExpedicionFactura: string; // dd-mm-aaaa
  nombreRazonEmisor: string;
  tipoFactura: string; // F1, F2, R1...
  descripcionOperacion: string;
  detalles: DetalleDesgloseXml[];
  cuotaTotal: string;
  importeTotal: string;
  encadenamiento: Encadenamiento;
  sistemaInformatico: SistemaInformatico;
  fechaHoraHusoGenRegistro: string; // ISO 8601 con huso
  huella: string; // SHA-256 hex mayúsculas
}

function detalleXml(d: DetalleDesgloseXml): string {
  return (
    `<sf:DetalleDesglose>` +
    `<sf:Impuesto>${d.impuesto}</sf:Impuesto>` +
    `<sf:ClaveRegimen>${esc(d.claveRegimen ?? "01")}</sf:ClaveRegimen>` +
    `<sf:CalificacionOperacion>${esc(d.calificacionOperacion ?? "S1")}</sf:CalificacionOperacion>` +
    `<sf:TipoImpositivo>${esc(d.tipoImpositivo)}</sf:TipoImpositivo>` +
    `<sf:BaseImponibleOimporteNoSujeto>${esc(d.baseImponible)}</sf:BaseImponibleOimporteNoSujeto>` +
    `<sf:CuotaRepercutida>${esc(d.cuotaRepercutida)}</sf:CuotaRepercutida>` +
    `</sf:DetalleDesglose>`
  );
}

function encadenamientoXml(e: Encadenamiento): string {
  if ("primerRegistro" in e) {
    return `<sf:Encadenamiento><sf:PrimerRegistro>S</sf:PrimerRegistro></sf:Encadenamiento>`;
  }
  const a = e.anterior;
  return (
    `<sf:Encadenamiento><sf:RegistroAnterior>` +
    `<sf:IDEmisorFactura>${esc(a.idEmisorFactura)}</sf:IDEmisorFactura>` +
    `<sf:NumSerieFactura>${esc(a.numSerieFactura)}</sf:NumSerieFactura>` +
    `<sf:FechaExpedicionFactura>${esc(a.fechaExpedicionFactura)}</sf:FechaExpedicionFactura>` +
    `<sf:Huella>${esc(a.huella)}</sf:Huella>` +
    `</sf:RegistroAnterior></sf:Encadenamiento>`
  );
}

/** Construye el fragmento <sum:RegistroAlta> de un registro de facturación de alta. */
export function construirRegistroAltaXml(i: RegistroAltaXmlInput): string {
  const si = i.sistemaInformatico;
  return (
    `<sum:RegistroAlta>` +
    `<sf:IDVersion>${esc(i.idVersion ?? "1.0")}</sf:IDVersion>` +
    `<sf:IDFactura>` +
    `<sf:IDEmisorFactura>${esc(i.idEmisorFactura)}</sf:IDEmisorFactura>` +
    `<sf:NumSerieFactura>${esc(i.numSerieFactura)}</sf:NumSerieFactura>` +
    `<sf:FechaExpedicionFactura>${esc(i.fechaExpedicionFactura)}</sf:FechaExpedicionFactura>` +
    `</sf:IDFactura>` +
    `<sf:NombreRazonEmisor>${esc(i.nombreRazonEmisor)}</sf:NombreRazonEmisor>` +
    `<sf:TipoFactura>${esc(i.tipoFactura)}</sf:TipoFactura>` +
    `<sf:DescripcionOperacion>${esc(i.descripcionOperacion)}</sf:DescripcionOperacion>` +
    `<sf:Desglose>${i.detalles.map(detalleXml).join("")}</sf:Desglose>` +
    `<sf:CuotaTotal>${esc(i.cuotaTotal)}</sf:CuotaTotal>` +
    `<sf:ImporteTotal>${esc(i.importeTotal)}</sf:ImporteTotal>` +
    encadenamientoXml(i.encadenamiento) +
    `<sf:SistemaInformatico>` +
    `<sf:NombreRazon>${esc(si.nombreRazon)}</sf:NombreRazon>` +
    `<sf:NIF>${esc(si.nif)}</sf:NIF>` +
    `<sf:NombreSistemaInformatico>${esc(si.nombreSistemaInformatico)}</sf:NombreSistemaInformatico>` +
    `<sf:IdSistemaInformatico>${esc(si.idSistemaInformatico)}</sf:IdSistemaInformatico>` +
    `<sf:Version>${esc(si.version)}</sf:Version>` +
    `<sf:NumeroInstalacion>${esc(si.numeroInstalacion)}</sf:NumeroInstalacion>` +
    `</sf:SistemaInformatico>` +
    `<sf:FechaHoraHusoGenRegistro>${esc(i.fechaHoraHusoGenRegistro)}</sf:FechaHoraHusoGenRegistro>` +
    `<sf:TipoHuella>01</sf:TipoHuella>` + // 01 = SHA-256
    `<sf:Huella>${esc(i.huella)}</sf:Huella>` +
    `</sum:RegistroAlta>`
  );
}

export interface CabeceraObligado {
  nombreRazon: string;
  nif: string;
}

/**
 * Construye el mensaje completo <sum:RegFactuSistemaFacturacion> con la cabecera
 * del obligado y uno o varios registros de alta.
 */
export function construirEnvioVerifactuXml(
  cabecera: CabeceraObligado,
  registrosAltaXml: string[],
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<sum:RegFactuSistemaFacturacion xmlns:sum="${NS_SUM}" xmlns:sf="${NS_SF}">` +
    `<sum:Cabecera><sf:ObligadoEmision>` +
    `<sf:NombreRazon>${esc(cabecera.nombreRazon)}</sf:NombreRazon>` +
    `<sf:NIF>${esc(cabecera.nif)}</sf:NIF>` +
    `</sf:ObligadoEmision></sum:Cabecera>` +
    registrosAltaXml.map((r) => `<sum:RegistroFactura>${r}</sum:RegistroFactura>`).join("") +
    `</sum:RegFactuSistemaFacturacion>`
  );
}

/** Convierte el desglose del motor de impuestos en detalles de desglose XML. */
export function detallesDesdeImpuestos(r: ResultadoImpuestos): DetalleDesgloseXml[] {
  const cod = codigoImpuesto(r.impuesto);
  return r.desglose.map((d) => ({
    impuesto: cod,
    tipoImpositivo: d.tipo.toFixed(2),
    baseImponible: d.base.toFixed(2),
    cuotaRepercutida: d.cuota.toFixed(2),
  }));
}

/** Envuelve un cuerpo XML en un sobre SOAP 1.1 para el web service de la AEAT. */
export function construirSobreSoap(cuerpoXml: string): string {
  // Se elimina la declaración <?xml ...?> del cuerpo al anidarlo en el sobre.
  const cuerpo = cuerpoXml.replace(/^<\?xml[^>]*\?>/, "");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soapenv:Header/>` +
    `<soapenv:Body>${cuerpo}</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}
