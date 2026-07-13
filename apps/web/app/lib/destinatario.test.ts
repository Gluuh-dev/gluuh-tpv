import { describe, expect, it } from "vitest";
import { resolverDestinatario, type ClienteFactura } from "./destinatario";

const cli = (p: Partial<ClienteFactura>): ClienteFactura => ({
  nif: null, nombre: null, direccion: null,
  codigo_postal: null, poblacion: null, provincia: null, ...p,
});

describe("resolverDestinatario — factura completa (F1) vs simplificada (F2)", () => {
  it("sin cliente → simplificada (F2), el ticket de siempre", () => {
    expect(resolverDestinatario(null).tipoFactura).toBe("F2");
  });

  it("cliente SIN NIF → simplificada: la AEAT no admite F1 sin destinatario", () => {
    const d = resolverDestinatario(cli({ nombre: "Ana" }));
    expect(d.tipoFactura).toBe("F2");
    expect(d.destNif).toBeNull();
    expect(d.destNombre).toBeNull(); // no se filtra el nombre a una F2
  });

  it("un NIF en blanco NO cuela como destinatario", () => {
    expect(resolverDestinatario(cli({ nif: "   ", nombre: "Ana" })).tipoFactura).toBe("F2");
  });

  it("cliente CON NIF → completa (F1) con sus datos", () => {
    const d = resolverDestinatario(cli({
      nif: "b12345678", nombre: "Bar Paco S.L.",
      direccion: "C/ Mayor 1", codigo_postal: "38001",
      poblacion: "Santa Cruz", provincia: "S/C Tenerife",
    }));
    expect(d.tipoFactura).toBe("F1");
    expect(d.destNif).toBe("B12345678"); // el NIF va en mayúsculas
    expect(d.destNombre).toBe("Bar Paco S.L.");
    expect(d.destDomicilio).toBe("C/ Mayor 1, 38001, Santa Cruz, S/C Tenerife");
  });

  it("con NIF pero sin domicilio → sigue siendo F1, domicilio vacío (no la cadena \", , \")", () => {
    const d = resolverDestinatario(cli({ nif: "B12345678", nombre: "Bar Paco" }));
    expect(d.tipoFactura).toBe("F1");
    expect(d.destDomicilio).toBeNull();
  });

  it("domicilio a medias → solo une lo que hay", () => {
    const d = resolverDestinatario(cli({ nif: "B1", poblacion: "Arucas" }));
    expect(d.destDomicilio).toBe("Arucas");
  });
});
