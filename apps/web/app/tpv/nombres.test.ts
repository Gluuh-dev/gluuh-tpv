// Caracterización de nombres/extras de línea (extraído de page.tsx, E1.3).
// Afirma el comportamiento ACTUAL; par del ./precio.test.ts.
import { describe, it, expect } from "vitest";
import {
  nombreDeKey,
  nombreBaseDeKey,
  extraIngredientesDetallados,
  obtenerBaseManualSiDifiere,
  type CtxNombres,
} from "./nombres";
import type { Prod } from "../lib/catalogo-store";

const prod = (id: string, precio: number, extra?: Partial<Prod>): Prod => ({
  id, nombre: id, precio, tipo_impositivo: 10, category_id: null,
  estacion: "COCINA", foto_url: null, agotado_hasta: null, vendido_por_peso: false, ...extra,
});

const ctx = (): CtxNombres => ({
  prodPorId: new Map([
    ["cafe", prod("cafe", 1.5, { nombre_ticket: "Café t.", nombre_cocina: "Café c." } as Partial<Prod>)],
    ["jamon", prod("jamon", 60)],
  ]),
  formatos: { cafe: [{ id: "f1", product_id: "cafe", nombre: "Doble", precio: 2.2 }] },
  modById: { extra1: { id: "extra1", nombre: "Sirope", precio_extra: 0.5 } },
});

describe("nombreDeKey", () => {
  it("nombre base a secas", () => expect(nombreDeKey(ctx(), "cafe")).toBe("cafe"));
  it("con formato añade el sufijo", () => expect(nombreDeKey(ctx(), "cafe|f1")).toBe("cafe (Doble)"));
  it("por peso muestra los kg", () => expect(nombreDeKey(ctx(), "jamon|@0.250")).toBe("jamon (0.250 kg)"));
  it("modificadores tras ·", () => expect(nombreDeKey(ctx(), "cafe|f1|extra1")).toBe("cafe (Doble) · Sirope"));
  it("campo usa nombre_cocina cuando existe", () => expect(nombreDeKey(ctx(), "cafe", "nombre_cocina")).toBe("Café c."));
  it("producto desconocido → vacío", () => expect(nombreDeKey(ctx(), "nope")).toBe(""));
});

describe("nombreBaseDeKey", () => {
  it("ignora los modificadores", () => expect(nombreBaseDeKey(ctx(), "cafe|f1|extra1")).toBe("cafe (Doble)"));
  it("campo nombre_ticket", () => expect(nombreBaseDeKey(ctx(), "cafe", "nombre_ticket")).toBe("Café t."));
});

describe("extraIngredientesDetallados", () => {
  it("sin modificadores → []", () => expect(extraIngredientesDetallados(ctx(), "cafe|f1")).toEqual([]));
  it("agrupa repetidos con uds", () =>
    expect(extraIngredientesDetallados(ctx(), "cafe||extra1,extra1")).toEqual([{ nombre: "Sirope", precio: 0.5, uds: 2 }]));
});

describe("obtenerBaseManualSiDifiere", () => {
  it("precio calculado → undefined (no difiere)", () =>
    expect(obtenerBaseManualSiDifiere(ctx(), "cafe|f1|extra1", 2.7)).toBeUndefined());
  it("precio distinto → base = precio - coste de extras", () =>
    expect(obtenerBaseManualSiDifiere(ctx(), "cafe|f1|extra1", 3.7)).toBeCloseTo(3.2, 5)); // 3.7 - 0.5
  it("menú (producto NULL) → undefined", () =>
    expect(obtenerBaseManualSiDifiere(ctx(), "nope", 5)).toBeUndefined());
});
