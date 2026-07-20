import { describe, it, expect } from "vitest";
import { bajoMinimo, costeMedio, type CompraDeArticulo } from "./stock";

const compra = (p: Partial<CompraDeArticulo>): CompraDeArticulo => ({
  lineaId: "l", fecha: "2026-07-01", numero: "A1", proveedor: "P",
  estado: "RECIBIDO", cantidad: 1, precioUnitario: 0, ...p,
});

describe("bajoMinimo", () => {
  it("avisa al llegar al mínimo, no solo al bajar de él", () => {
    expect(bajoMinimo(5, 5)).toBe(true);
    expect(bajoMinimo(4, 5)).toBe(true);
    expect(bajoMinimo(6, 5)).toBe(false);
  });

  it("sin mínimo NO avisa aunque esté a cero", () => {
    // Una tapa del día no se «repone»: sacarla en rojo solo enseña a ignorar
    // los avisos.
    expect(bajoMinimo(0, null)).toBe(false);
  });
});

describe("costeMedio", () => {
  it("pondera por cantidad, no hace la media de los precios", () => {
    // 100 a 0,50 y 2 a 3,00 → el coste real está cerca de 0,55, no de 1,75.
    const c = costeMedio([
      compra({ cantidad: 100, precioUnitario: 0.5 }),
      compra({ cantidad: 2, precioUnitario: 3 }),
    ]);
    expect(c).toBeCloseTo(0.549, 3);
  });

  it("solo cuenta lo RECIBIDO: un borrador es una intención, no un coste", () => {
    const c = costeMedio([
      compra({ cantidad: 10, precioUnitario: 1, estado: "RECIBIDO" }),
      compra({ cantidad: 10, precioUnitario: 99, estado: "BORRADOR" }),
    ]);
    expect(c).toBe(1);
  });

  it("sin compras recibidas no se inventa un coste", () => {
    expect(costeMedio([])).toBeNull();
    expect(costeMedio([compra({ estado: "BORRADOR" })])).toBeNull();
  });

  it("cantidad cero no revienta la división", () => {
    expect(costeMedio([compra({ cantidad: 0, precioUnitario: 5 })])).toBeNull();
  });
});
