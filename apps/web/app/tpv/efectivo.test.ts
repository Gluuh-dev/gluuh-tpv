import { describe, it, expect } from "vitest";
import { sugerenciasEfectivo, desglosarCambio } from "./efectivo";

describe("sugerenciasEfectivo — billete con el que paga", () => {
  it("importe con céntimos → redondos por encima", () => {
    expect(sugerenciasEfectivo(13.4)).toEqual([15, 20, 50, 100]);
  });
  it("total alto → sugerencias grandes, no 5/10/20", () => {
    expect(sugerenciasEfectivo(47)).toEqual([50, 60, 100, 200]);
  });
  it("importe exacto en múltiplo → no repite el exacto (lo cubre el botón Exacto)", () => {
    expect(sugerenciasEfectivo(20)).toEqual([50, 100, 200]);   // 20 excluido
  });
  it("importe pequeño", () => {
    expect(sugerenciasEfectivo(3.2)).toEqual([5, 10, 20, 50]);
  });
  it("0 o negativo → sin sugerencias", () => {
    expect(sugerenciasEfectivo(0)).toEqual([]);
    expect(sugerenciasEfectivo(-5)).toEqual([]);
  });
});

describe("desglosarCambio — cómo dar el cambio", () => {
  it("6,60 → 5 + 1 + 0,50 + 0,10", () => {
    expect(desglosarCambio(6.6)).toEqual([
      { valor: 5, n: 1 }, { valor: 1, n: 1 }, { valor: 0.5, n: 1 }, { valor: 0.1, n: 1 },
    ]);
  });
  it("agrupa por denominación (47 → 20×2 + 5 + 2)", () => {
    expect(desglosarCambio(47)).toEqual([
      { valor: 20, n: 2 }, { valor: 5, n: 1 }, { valor: 2, n: 1 },
    ]);
  });
  it("céntimos sin error de coma flotante (0,30 → 0,20 + 0,10)", () => {
    expect(desglosarCambio(0.3)).toEqual([{ valor: 0.2, n: 1 }, { valor: 0.1, n: 1 }]);
  });
  it("0 → vacío", () => {
    expect(desglosarCambio(0)).toEqual([]);
  });
});
