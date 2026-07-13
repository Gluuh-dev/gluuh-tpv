import { describe, it, expect } from "vitest";
import { validarPreviewDto } from "./validacion";

const valido = () => ({
  lineas: [{ importe: 19, tipo: 7 }],
  territorio: "CANARIAS",
  nif: "B12345678",
  numSerieFactura: "F2-2026-000123",
  fechaExpedicion: "12-06-2026",
  fechaHoraHusoGenRegistro: "2026-06-12T21:05:00+01:00",
});

describe("validarPreviewDto — acepta lo correcto", () => {
  it("DTO completo y válido", () => {
    expect(validarPreviewDto(valido())).toBeNull();
  });
});

describe("validarPreviewDto — rechaza lo peligroso", () => {
  it("cuerpo vacío o no-objeto", () => {
    expect(validarPreviewDto(null)).toMatch(/Cuerpo/);
    expect(validarPreviewDto("hola")).toMatch(/Cuerpo/);
  });
  it("sin líneas", () => {
    expect(validarPreviewDto({ ...valido(), lineas: [] })).toMatch(/lineas/);
  });
  it("importe no numérico (evita NaN en el cálculo fiscal)", () => {
    expect(validarPreviewDto({ ...valido(), lineas: [{ importe: "10", tipo: 7 }] })).toMatch(/importe/);
    expect(validarPreviewDto({ ...valido(), lineas: [{ importe: Infinity, tipo: 7 }] })).toMatch(/importe/);
  });
  it("tipo impositivo fuera de rango", () => {
    expect(validarPreviewDto({ ...valido(), lineas: [{ importe: 10, tipo: 500 }] })).toMatch(/tipo/);
    expect(validarPreviewDto({ ...valido(), lineas: [{ importe: 10, tipo: -1 }] })).toMatch(/tipo/);
  });
  it("importe negativo", () => {
    expect(validarPreviewDto({ ...valido(), lineas: [{ importe: -5, tipo: 7 }] })).toMatch(/importe/);
  });
  it("territorio desconocido (no puede colarse a la AEAT)", () => {
    expect(validarPreviewDto({ ...valido(), territorio: "MARTE" })).toMatch(/territorio/);
  });
  it("NIF inválido", () => {
    expect(validarPreviewDto({ ...valido(), nif: "x" })).toMatch(/nif/);
  });
  it("fecha con formato equivocado", () => {
    expect(validarPreviewDto({ ...valido(), fechaExpedicion: "2026-06-12" })).toMatch(/fechaExpedicion/);
  });
  it("demasiadas líneas (abuso de CPU)", () => {
    const lineas = Array.from({ length: 1001 }, () => ({ importe: 1, tipo: 7 }));
    expect(validarPreviewDto({ ...valido(), lineas })).toMatch(/lineas/);
  });
});
