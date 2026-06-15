import { describe, it, expect } from "vitest";
import {
  calcularImpuestosIncluidos,
  formatImporte,
  type LineaFiscal,
} from "./tax.js";

describe("calcularImpuestosIncluidos — casos básicos", () => {
  it("IVA 10 % hostelería, una línea (PENINSULA_BALEARES)", () => {
    const lineas: LineaFiscal[] = [{ importe: 11.0, tipo: 10 }];
    const result = calcularImpuestosIncluidos(lineas, "PENINSULA_BALEARES");
    expect(result.impuesto).toBe("IVA");
    expect(result.desglose).toEqual([
      { tipo: 10, base: 10.0, cuota: 1.0, importe: 11.0 },
    ]);
    expect(result.baseTotal).toBe(10.0);
    expect(result.cuotaTotal).toBe(1.0);
    expect(result.importeTotal).toBe(11.0);
  });

  it("IGIC 7 %, una línea (CANARIAS)", () => {
    const lineas: LineaFiscal[] = [{ importe: 10.7, tipo: 7 }];
    const result = calcularImpuestosIncluidos(lineas, "CANARIAS");
    expect(result.impuesto).toBe("IGIC");
    expect(result.desglose).toEqual([
      { tipo: 7, base: 10.0, cuota: 0.7, importe: 10.7 },
    ]);
  });

  it("multi-tipo en un ticket (CANARIAS, 7 % + 15 %)", () => {
    const lineas: LineaFiscal[] = [
      { importe: 10.7, tipo: 7 },
      { importe: 11.5, tipo: 15 },
    ];
    const result = calcularImpuestosIncluidos(lineas, "CANARIAS");
    expect(result.desglose).toEqual([
      { tipo: 7, base: 10.0, cuota: 0.7, importe: 10.7 },
      { tipo: 15, base: 10.0, cuota: 1.5, importe: 11.5 },
    ]);
    expect(result.baseTotal).toBe(20.0);
    expect(result.cuotaTotal).toBe(2.2);
    expect(result.importeTotal).toBe(22.2);
  });

  it("agrupación de líneas del mismo tipo (PENINSULA_BALEARES, 10 %)", () => {
    const lineas: LineaFiscal[] = [
      { importe: 11.0, tipo: 10 },
      { importe: 5.5, tipo: 10 },
    ];
    const result = calcularImpuestosIncluidos(lineas, "PENINSULA_BALEARES");
    expect(result.desglose).toHaveLength(1);
    expect(result.desglose[0]).toEqual({
      tipo: 10,
      base: 15.0,
      cuota: 1.5,
      importe: 16.5,
    });
  });

  it("lista vacía", () => {
    const result = calcularImpuestosIncluidos([], "PENINSULA_BALEARES");
    expect(result.desglose).toEqual([]);
    expect(result.baseTotal).toBe(0);
    expect(result.cuotaTotal).toBe(0);
    expect(result.importeTotal).toBe(0);
  });

  it("invariante por grupo: base + cuota === importe (multi-tipo CANARIAS)", () => {
    const lineas: LineaFiscal[] = [
      { importe: 10.7, tipo: 7 },
      { importe: 11.5, tipo: 15 },
    ];
    const result = calcularImpuestosIncluidos(lineas, "CANARIAS");
    for (const d of result.desglose) {
      expect(d.base + d.cuota).toBeCloseTo(d.importe, 2);
    }
  });
});

describe("formatImporte", () => {
  it('formatea 10 como "10.00"', () => {
    expect(formatImporte(10)).toBe("10.00");
  });

  it('formatea 1.5 como "1.50"', () => {
    expect(formatImporte(1.5)).toBe("1.50");
  });

  it('formatea 0 como "0.00"', () => {
    expect(formatImporte(0)).toBe("0.00");
  });
});
