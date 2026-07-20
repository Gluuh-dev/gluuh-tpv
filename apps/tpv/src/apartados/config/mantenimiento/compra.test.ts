import { describe, it, expect } from "vitest";
import { baseLinea, totales, type LineaCompra } from "./compra";

const linea = (p: Partial<LineaCompra>): LineaCompra => ({
  id: "l", productId: null, ingredientId: null, descripcion: "x",
  cantidad: 1, unidad: "ud", precioUnitario: 0, descuentoPct: 0, tipoImpositivo: 0, ...p,
});

describe("baseLinea", () => {
  it("cantidad × precio", () => {
    expect(baseLinea(linea({ cantidad: 24, precioUnitario: 0.62 }))).toBe(14.88);
  });

  it("aplica el descuento de la línea", () => {
    expect(baseLinea(linea({ cantidad: 10, precioUnitario: 2, descuentoPct: 10 }))).toBe(18);
  });

  it("redondea a céntimo, sin dejar colas de coma flotante", () => {
    // 3 × 0.1 en binario da 0.30000000000000004.
    expect(baseLinea(linea({ cantidad: 3, precioUnitario: 0.1 }))).toBe(0.3);
  });
});

describe("totales", () => {
  it("un albarán vacío no vale nada (y no da NaN)", () => {
    expect(totales([])).toEqual({ base: 0, impuestos: 0, total: 0 });
  });

  it("el impuesto se calcula POR LÍNEA: un albarán mezcla tipos", () => {
    // Comida al 7 % y limpieza al 21 %: un tipo medio no cuadraría con la
    // factura del proveedor, y esa factura la mira Hacienda.
    const t = totales([
      linea({ cantidad: 10, precioUnitario: 1, tipoImpositivo: 7 }),   // 10 → 0,70
      linea({ cantidad: 10, precioUnitario: 1, tipoImpositivo: 21 }),  // 10 → 2,10
    ]);
    expect(t.base).toBe(20);
    expect(t.impuestos).toBe(2.8);
    expect(t.total).toBe(22.8);
  });

  it("el total es exactamente base + impuestos", () => {
    const t = totales([
      linea({ cantidad: 7, precioUnitario: 1.37, tipoImpositivo: 7 }),
      linea({ cantidad: 3, precioUnitario: 0.99, descuentoPct: 15, tipoImpositivo: 21 }),
    ]);
    expect(t.total).toBe(Number((t.base + t.impuestos).toFixed(2)));
  });

  it("no acumula error con muchas líneas pequeñas", () => {
    const muchas = Array.from({ length: 100 }, () => linea({ cantidad: 1, precioUnitario: 0.07, tipoImpositivo: 7 }));
    const t = totales(muchas);
    expect(t.base).toBe(7);
    expect(t.total).toBe(Number((t.base + t.impuestos).toFixed(2)));
  });

  it("un descuento del 100 % deja la línea a cero, no en negativo", () => {
    expect(baseLinea(linea({ cantidad: 5, precioUnitario: 3, descuentoPct: 100 }))).toBe(0);
  });
});
