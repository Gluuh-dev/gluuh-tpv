import { describe, it, expect } from "vitest";
import { margenDe, resumenMargen, cuadrantes, type Ficha } from "./Analisis";

// Este informe se usa para SUBIR O BAJAR PRECIOS. Un margen inflado hace bajar el
// precio de algo que no daba lo que parecía. Las dos trampas que se fijan aquí:
// el impuesto no es ingreso, y un coste que no está no vale cero.

const FICHA: Record<string, Ficha> = {
  Menú: { coste: 4.15, iva: 7 },
  Caña: { coste: 0.42, iva: 7 },
  Tarta: { iva: 3 },                       // sin escandallo, a propósito
};
const TOP = [
  { nombre: "Menú", familia: "Cocina", uds: 10, importe: 130 },
  { nombre: "Caña", familia: "Barra", uds: 100, importe: 250 },
  { nombre: "Tarta", familia: "Postres", uds: 5, importe: 25 },
];

describe("margenDe", () => {
  it("★ el margen va sobre la BASE, no sobre el PVP (el IGIC no es ingreso)", () => {
    const menu = margenDe(TOP, FICHA)[0]!;
    expect(menu.base).toBe(121.5);                    // 130 / 1,07
    expect(menu.coste).toBe(41.5);                    // 4,15 × 10
    expect(menu.margen).toBe(80);                     // 121,50 − 41,50
    // Sobre el PVP saldrían 88,50 €: 8,50 € de margen que en realidad son de Hacienda.
    expect(menu.margen).toBeLessThan(130 - 41.5);
  });

  it("★ sin escandallo, el margen es DESCONOCIDO — ni cero ni 100 %", () => {
    const tarta = margenDe(TOP, FICHA)[2]!;
    expect(tarta.coste).toBeNull();
    expect(tarta.margen).toBeNull();
    expect(tarta.pct).toBeNull();
    expect(tarta.base).toBe(24.27);                   // la base sí se sabe: 25 / 1,03
  });

  it("un artículo que no está en el catálogo no revienta", () => {
    const [f] = margenDe([{ nombre: "Fantasma", familia: "?", uds: 1, importe: 10 }], FICHA);
    expect(f?.margen).toBeNull();
  });

  it("el % de margen se mide sobre la base", () => {
    expect(margenDe(TOP, FICHA)[0]!.pct).toBeCloseTo((80 / 121.5) * 100, 6);
  });
});

describe("resumenMargen", () => {
  it("★ los artículos sin escandallo NO entran en los totales, se cuentan aparte", () => {
    const r = resumenMargen(margenDe(TOP, FICHA));
    expect(r.sinCoste).toBe(1);
    expect(r.base).toBeCloseTo(121.5 + 233.64, 2);    // sin la tarta
    expect(r.coste).toBeCloseTo(41.5 + 42, 2);
    expect(r.margen).toBeCloseTo(r.base - r.coste, 6);
  });

  it("si NADA tiene escandallo, el margen no es 0 %: es «no se sabe»", () => {
    const r = resumenMargen(margenDe([TOP[2]!], FICHA));
    expect(r.pct).toBeNull();
    expect(r.sinCoste).toBe(1);
  });

  it("sin ventas no revienta", () => {
    expect(resumenMargen([])).toEqual({ base: 0, coste: 0, margen: 0, pct: null, sinCoste: 0 });
  });
});

describe("cuadrantes (menú engineering)", () => {
  const filas = margenDe(TOP, FICHA);

  it("clasifica cruzando lo que vende con lo que deja", () => {
    const c = cuadrantes(filas);
    // Caña: 100 uds (por encima de la media) y 82 % de margen → lo que sostiene el bar.
    expect(c.get("Caña")).toBe("Estrella");
    // Menú: 10 uds y 66 % → vende poco y deja poco comparado.
    expect(c.get("Menú")).toBe("Perro");
  });

  it("un artículo sin margen conocido no se clasifica a ciegas", () => {
    expect(cuadrantes(filas).get("Tarta")).toBe("—");
  });

  it("con un solo artículo no hay «alto» ni «bajo»", () => {
    expect(cuadrantes(margenDe([TOP[0]!], FICHA)).get("Menú")).toBe("—");
  });

  it("todos los artículos salen clasificados (ninguno se queda sin entrada)", () => {
    expect(cuadrantes(filas).size).toBe(filas.length);
  });
});
