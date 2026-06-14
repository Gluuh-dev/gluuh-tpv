import { describe, it, expect } from "vitest";
import {
  construirRegistroAltaXml,
  construirEnvioVerifactuXml,
  construirSobreSoap,
  detallesDesdeImpuestos,
  codigoImpuesto,
  type RegistroAltaXmlInput,
} from "./verifactu-xml.js";
import { calcularImpuestosIncluidos } from "./tax.js";

const sistemaInformatico = {
  nombreRazon: "Gluuh Software SL",
  nif: "B99999999",
  nombreSistemaInformatico: "Gluuh TPV",
  idSistemaInformatico: "01",
  version: "1.0",
  numeroInstalacion: "0001",
};

const base: RegistroAltaXmlInput = {
  idEmisorFactura: "B12345678",
  numSerieFactura: "F2-2026-000123",
  fechaExpedicionFactura: "12-06-2026",
  nombreRazonEmisor: "Bar La Palma",
  tipoFactura: "F2",
  descripcionOperacion: "Consumición en restauración",
  detalles: [
    { impuesto: "03", tipoImpositivo: "7.00", baseImponible: "17.75", cuotaRepercutida: "1.25" },
    { impuesto: "03", tipoImpositivo: "15.00", baseImponible: "10.43", cuotaRepercutida: "1.57" },
  ],
  cuotaTotal: "2.82",
  importeTotal: "31.00",
  encadenamiento: { primerRegistro: true },
  sistemaInformatico,
  fechaHoraHusoGenRegistro: "2026-06-12T21:05:00+01:00",
  huella: "BCF39B6EC45015CD337511C69CE35208718D02BCC3916F0F107018F48C93FDD3",
};

describe("VERIFACTU XML — RegistroAlta", () => {
  it("incluye las etiquetas clave y el número correcto de detalles", () => {
    const xml = construirRegistroAltaXml(base);
    expect(xml).toContain("<sum:RegistroAlta>");
    expect(xml).toContain("<sf:IDEmisorFactura>B12345678</sf:IDEmisorFactura>");
    expect(xml).toContain("<sf:NumSerieFactura>F2-2026-000123</sf:NumSerieFactura>");
    expect(xml).toContain("<sf:TipoHuella>01</sf:TipoHuella>");
    expect(xml).toContain("<sf:Huella>" + base.huella + "</sf:Huella>");
    expect(xml).toContain("<sf:PrimerRegistro>S</sf:PrimerRegistro>");
    // dos tramos de IGIC (7% y 15%)
    expect(xml.match(/<sf:DetalleDesglose>/g)?.length).toBe(2);
  });

  it("encadena con el registro anterior cuando no es el primero", () => {
    const xml = construirRegistroAltaXml({
      ...base,
      encadenamiento: {
        anterior: {
          idEmisorFactura: "B12345678",
          numSerieFactura: "F2-2026-000122",
          fechaExpedicionFactura: "12-06-2026",
          huella: "AAAA1111",
        },
      },
    });
    expect(xml).toContain("<sf:RegistroAnterior>");
    expect(xml).toContain("<sf:Huella>AAAA1111</sf:Huella>");
    expect(xml).not.toContain("<sf:PrimerRegistro>");
  });

  it("escapa caracteres especiales", () => {
    const xml = construirRegistroAltaXml({ ...base, nombreRazonEmisor: "Bar & Café <La Palma>" });
    expect(xml).toContain("Bar &amp; Café &lt;La Palma&gt;");
  });
});

describe("VERIFACTU XML — envío y SOAP", () => {
  it("construye el mensaje RegFactuSistemaFacturacion con namespaces", () => {
    const reg = construirRegistroAltaXml(base);
    const envio = construirEnvioVerifactuXml({ nombreRazon: "Bar La Palma", nif: "B12345678" }, [reg]);
    expect(envio).toContain("<sum:RegFactuSistemaFacturacion");
    expect(envio).toContain("xmlns:sum=");
    expect(envio).toContain("xmlns:sf=");
    expect(envio).toContain("<sum:RegistroFactura>");
  });

  it("envuelve en un sobre SOAP sin duplicar la cabecera xml", () => {
    const reg = construirRegistroAltaXml(base);
    const envio = construirEnvioVerifactuXml({ nombreRazon: "Bar La Palma", nif: "B12345678" }, [reg]);
    const soap = construirSobreSoap(envio);
    expect(soap).toContain("<soapenv:Envelope");
    expect(soap).toContain("<soapenv:Body>");
    // Solo una declaración <?xml ?> (la del sobre)
    expect(soap.match(/<\?xml/g)?.length).toBe(1);
  });
});

describe("VERIFACTU XML — integración con el motor de impuestos", () => {
  it("genera los detalles de desglose desde el cálculo de IGIC", () => {
    const imp = calcularImpuestosIncluidos(
      [
        { importe: 19, tipo: 7 },
        { importe: 12, tipo: 15 },
      ],
      "CANARIAS",
    );
    const detalles = detallesDesdeImpuestos(imp);
    expect(codigoImpuesto(imp.impuesto)).toBe("03"); // IGIC
    expect(detalles).toHaveLength(2);
    expect(detalles[0]!.impuesto).toBe("03");
    expect(detalles[0]!.tipoImpositivo).toBe("7.00");
  });
});
