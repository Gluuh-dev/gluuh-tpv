import { describe, it, expect } from "vitest";
import { territorioDesdeDireccion, ivaAuto } from "./tax-rates.js";

// El territorio se DEDUCE de la dirección fiscal. Asumir península es el fallo
// caro: un bar canario facturaría al 21 % en vez de al 7 % de IGIC sin dar error.
describe("territorioDesdeDireccion", () => {
  it("deduce CANARIAS por código postal (Las Palmas y Tenerife)", () => {
    expect(territorioDesdeDireccion({ codigoPostal: "35001" })).toBe("CANARIAS");
    expect(territorioDesdeDireccion({ codigoPostal: "38700" })).toBe("CANARIAS");
  });

  it("deduce Ceuta y Melilla", () => {
    expect(territorioDesdeDireccion({ codigoPostal: "51001" })).toBe("CEUTA_MELILLA");
    expect(territorioDesdeDireccion({ codigoPostal: "52005" })).toBe("CEUTA_MELILLA");
  });

  it("deduce los forales", () => {
    expect(territorioDesdeDireccion({ codigoPostal: "48001" })).toBe("FORAL_PV");       // Bizkaia
    expect(territorioDesdeDireccion({ codigoPostal: "20018" })).toBe("FORAL_PV");       // Gipuzkoa
    expect(territorioDesdeDireccion({ codigoPostal: "01001" })).toBe("FORAL_PV");       // Álava
    expect(territorioDesdeDireccion({ codigoPostal: "31002" })).toBe("FORAL_NAVARRA");  // Navarra
  });

  it("el resto de España es península/Baleares", () => {
    expect(territorioDesdeDireccion({ codigoPostal: "28013" })).toBe("PENINSULA_BALEARES"); // Madrid
    expect(territorioDesdeDireccion({ codigoPostal: "07001" })).toBe("PENINSULA_BALEARES"); // Baleares
    expect(territorioDesdeDireccion({ codigoPostal: "41001" })).toBe("PENINSULA_BALEARES"); // Sevilla
  });

  it("acepta el CP con espacios o guiones", () => {
    expect(territorioDesdeDireccion({ codigoPostal: " 35 001 " })).toBe("CANARIAS");
    expect(territorioDesdeDireccion({ codigoPostal: "38-700" })).toBe("CANARIAS");
  });

  it("cae al nombre de la provincia si no hay CP legible", () => {
    expect(territorioDesdeDireccion({ provincia: "Santa Cruz de Tenerife" })).toBe("CANARIAS");
    expect(territorioDesdeDireccion({ provincia: "Las Palmas" })).toBe("CANARIAS");
    expect(territorioDesdeDireccion({ provincia: "Gipuzkoa" })).toBe("FORAL_PV");
    expect(territorioDesdeDireccion({ provincia: "Navarra" })).toBe("FORAL_NAVARRA");
    expect(territorioDesdeDireccion({ provincia: "Melilla" })).toBe("CEUTA_MELILLA");
  });

  it("tolera acentos y mayúsculas en la provincia", () => {
    expect(territorioDesdeDireccion({ provincia: "ÁLAVA" })).toBe("FORAL_PV");
    expect(territorioDesdeDireccion({ provincia: "vizcaya" })).toBe("FORAL_PV");
  });

  it("un CP que no es de provincia válida no manda; decide la provincia", () => {
    expect(territorioDesdeDireccion({ codigoPostal: "99999", provincia: "Las Palmas" })).toBe("CANARIAS");
  });

  it("sin datos, península (el caso mayoritario)", () => {
    expect(territorioDesdeDireccion({})).toBe("PENINSULA_BALEARES");
  });

  it("fuera de España devuelve null (no es IVA/IGIC/IPSI español)", () => {
    expect(territorioDesdeDireccion({ codigoPostal: "1000", pais: "Portugal" })).toBeNull();
    expect(territorioDesdeDireccion({ codigoPostal: "35001", pais: "Francia" })).toBeNull();
  });

  it("España escrita de varias formas sí cuenta", () => {
    for (const pais of ["España", "espana", "ES", "Spain", "esp"]) {
      expect(territorioDesdeDireccion({ codigoPostal: "35001", pais })).toBe("CANARIAS");
    }
  });

  // Lo que de verdad importa: que el % acabe siendo el correcto.
  it("un bar de Tenerife acaba con IGIC 7/3, no con IVA 21/10", () => {
    const terr = territorioDesdeDireccion({ codigoPostal: "38001" })!;
    expect(ivaAuto("GENERAL", terr)).toBe(7);
    expect(ivaAuto("REDUCIDO", terr)).toBe(3);
  });
});
