/**
 * Tests del motor VERIFACTU.
 *
 * El test clave reproduce el VECTOR OFICIAL de ejemplo publicado por la AEAT en
 * su documentación de desarrolladores. Si este test pasa, nuestra implementación
 * del algoritmo de huella coincide con la de la Agencia Tributaria.
 *
 * Ejecutar:  pnpm core:test
 */

import { describe, it, expect } from "vitest";
import {
  construirCadenaHuella,
  calcularHuella,
  construirUrlQR,
  encadenarRegistros,
  type RegistroAltaInput,
} from "./verifactu.js";

describe("VERIFACTU — vector oficial de la AEAT", () => {
  const registroEjemplo: RegistroAltaInput = {
    idEmisorFactura: "89890001K",
    numSerieFactura: "12345678/G33",
    fechaExpedicionFactura: "01-01-2024",
    tipoFactura: "F1",
    cuotaTotal: "12.35",
    importeTotal: "123.45",
    huellaRegistroAnterior: "",
    fechaHoraHusoGenRegistro: "2024-01-01T19:20:30+01:00",
  };

  it("construye la cadena de huella en el orden exacto", () => {
    expect(construirCadenaHuella(registroEjemplo)).toBe(
      "IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00",
    );
  });

  it("reproduce la huella SHA-256 del ejemplo oficial", () => {
    expect(calcularHuella(registroEjemplo)).toBe(
      "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60",
    );
  });

  it("genera la URL de cotejo del QR (entorno de pruebas)", () => {
    const url = construirUrlQR({
      nif: "89890001K",
      numSerieFactura: "12345678/G33",
      fechaExpedicion: "01-01-2024",
      importeTotal: "241.4",
      entorno: "pruebas",
    });
    expect(url).toBe(
      "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678/G33&fecha=01-01-2024&importe=241.4",
    );
  });
});

describe("VERIFACTU — encadenamiento", () => {
  it("encadena registros: la huella de cada uno alimenta al siguiente", () => {
    const cadena = encadenarRegistros([
      {
        idEmisorFactura: "B12345678",
        numSerieFactura: "F2-2026-1",
        fechaExpedicionFactura: "12-06-2026",
        tipoFactura: "F2",
        cuotaTotal: "1.24",
        importeTotal: "19.00",
        fechaHoraHusoGenRegistro: "2026-06-12T21:05:00+01:00",
      },
      {
        idEmisorFactura: "B12345678",
        numSerieFactura: "F2-2026-2",
        fechaExpedicionFactura: "12-06-2026",
        tipoFactura: "F2",
        cuotaTotal: "0.70",
        importeTotal: "10.70",
        fechaHoraHusoGenRegistro: "2026-06-12T21:07:00+01:00",
      },
    ]);

    // El primero parte de huella vacía; el segundo incluye la huella del primero.
    expect(cadena[0]!.huellaRegistroAnterior).toBe("");
    expect(cadena[1]!.huellaRegistroAnterior).toBe(cadena[0]!.huella);
    // Las huellas son SHA-256 en hex mayúsculas (64 caracteres).
    expect(cadena[0]!.huella).toMatch(/^[0-9A-F]{64}$/);
    expect(cadena[1]!.huella).toMatch(/^[0-9A-F]{64}$/);
    expect(cadena[0]!.huella).not.toBe(cadena[1]!.huella);
  });
});
