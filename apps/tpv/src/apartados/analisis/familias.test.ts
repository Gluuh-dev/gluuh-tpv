import { describe, it, expect } from "vitest";
import { porFamilia, DEMO } from "./Analisis";

// Un rollup que no conserva el total es una pantalla que miente: el dueño ve
// «Cocina 494 €» en una tabla y otra cifra en la de al lado, y deja de creerse
// las dos. Aquí se fija justo eso.

const TOP = [
  { nombre: "Menú", familia: "Cocina", uds: 38, importe: 494 },
  { nombre: "Caña", familia: "Cervezas", uds: 96, importe: 240 },
  { nombre: "Croquetas", familia: "Cocina", uds: 27, importe: 226.8 },
  { nombre: "Café", familia: "Cafés", uds: 74, importe: 96.2 },
];

describe("porFamilia", () => {
  it("★ conserva el importe total del ranking (al céntimo)", () => {
    const suma = porFamilia(TOP).reduce((a, f) => a + f.importe, 0);
    expect(Math.round(suma * 100) / 100).toBe(1057);
  });

  it("★ conserva las unidades", () => {
    expect(porFamilia(TOP).reduce((a, f) => a + f.uds, 0)).toBe(235);
  });

  it("agrupa: Cocina son dos artículos sumados, no dos filas", () => {
    const cocina = porFamilia(TOP).find((f) => f.familia === "Cocina");
    expect(cocina).toEqual({ familia: "Cocina", articulos: 2, uds: 65, importe: 720.8 });
  });

  it("cada familia sale una sola vez", () => {
    const fs = porFamilia(TOP).map((f) => f.familia);
    expect(new Set(fs).size).toBe(fs.length);
  });

  it("viene ordenado de más a menos importe", () => {
    expect(porFamilia(TOP).map((f) => f.familia)).toEqual(["Cocina", "Cervezas", "Cafés"]);
  });

  it("sin ventas no revienta", () => {
    expect(porFamilia([])).toEqual([]);
  });
});

// Las formas de pago son lo que se cuadra en el arqueo: si no suman la venta del
// periodo, el cierre sale descuadrado por un fallo de la pantalla, no de la caja.
describe("formas de pago", () => {
  it("★ suman exactamente las ventas del periodo", () => {
    for (const [periodo, d] of Object.entries(DEMO)) {
      const cobrado = d.pagos.reduce((a, p) => a + p.importe, 0);
      expect(Math.round(cobrado * 100) / 100, periodo).toBe(d.ventas);
    }
  });
});
