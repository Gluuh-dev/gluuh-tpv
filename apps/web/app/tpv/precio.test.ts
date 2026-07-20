// Caracterización del precio efectivo del TPV (camino del dinero).
// Los valores afirman el comportamiento ACTUAL con céntimos exactos; si un caso
// te parece discutible (p. ej. peso ilegible → 0), es una decisión de producto,
// no un fallo del test. Modelo estructural: packages/core/src/fiscal/tax.test.ts.
import { describe, it, expect } from "vitest";
import { precioEfectivo, type CtxPrecio } from "./precio";
import type { Prod } from "../lib/catalogo-store";

const prod = (id: string, precio: number): Prod => ({
  id, nombre: id, precio, tipo_impositivo: 10, category_id: null,
  estacion: "COCINA", foto_url: null, agotado_hasta: null, vendido_por_peso: false,
});

const base = (): CtxPrecio => ({
  prodPorId: new Map([["cafe", prod("cafe", 1.5)], ["jamon", prod("jamon", 60)]]),
  formatos: { cafe: [{ id: "f1", product_id: "cafe", nombre: "Doble", precio: 2.2 }] },
  modById: { extra1: { id: "extra1", nombre: "Sirope", precio_extra: 0.5 } },
  preciosManuales: {},
  descuentos: {},
});

describe("precioEfectivo — base, formato y peso", () => {
  it("precio base del producto", () => {
    expect(precioEfectivo(base(), "cafe")).toBe(1.5);
  });
  it("formato sustituye el precio base", () => {
    expect(precioEfectivo(base(), "cafe|f1")).toBe(2.2);
  });
  it("formato inexistente cae al precio base", () => {
    expect(precioEfectivo(base(), "cafe|fX")).toBe(1.5);
  });
  it("venta por peso: €/kg × kg", () => {
    expect(precioEfectivo(base(), "jamon|@0.250")).toBe(15);
  });
  it("peso ilegible → 0 (parseFloat||0, comportamiento actual)", () => {
    expect(precioEfectivo(base(), "jamon|@abc")).toBe(0);
  });
  it("producto desconocido → 0", () => {
    expect(precioEfectivo(base(), "nope")).toBe(0);
  });
});

describe("precioEfectivo — modificadores y precio manual", () => {
  it("los extras suman por unidad (repetidos = ×n)", () => {
    expect(precioEfectivo(base(), "cafe|f1|extra1,extra1")).toBe(2.2 + 1);
  });
  it("el precio manual sustituye la BASE y los extras suman encima", () => {
    const ctx = base();
    ctx.preciosManuales["cafe||extra1"] = 1;
    expect(precioEfectivo(ctx, "cafe||extra1")).toBe(1.5);   // 1 (manual) + 0.5 (extra)
  });
  it("el precio manual se busca por la clave COMPLETA (con #n)", () => {
    const ctx = base();
    ctx.preciosManuales["cafe#2"] = 9;
    expect(precioEfectivo(ctx, "cafe#2")).toBe(9);
    expect(precioEfectivo(ctx, "cafe")).toBe(1.5);   // la línea original no se contagia
  });
});

describe("precioEfectivo — descuentos", () => {
  it("DTO % sobre la base efectiva", () => {
    const ctx = base();
    ctx.descuentos["cafe|f1"] = { tipo: "PCT", valor: 50 };
    expect(precioEfectivo(ctx, "cafe|f1")).toBe(1.1);
  });
  it("DTO € mayor que la base → 0 (clamp, nunca negativo)", () => {
    const ctx = base();
    ctx.descuentos["cafe"] = { tipo: "EUR", valor: 5 };
    expect(precioEfectivo(ctx, "cafe")).toBe(0);
  });
  it("el sufijo #n no altera el producto ni el precio base", () => {
    expect(precioEfectivo(base(), "cafe#2")).toBe(1.5);
    expect(precioEfectivo(base(), "cafe|f1#3")).toBe(2.2);
  });
});

// ── TARIFAS (0131): la sala puede cambiar el precio ─────────────────────────
describe("precioEfectivo · tarifa activa", () => {
  const prod = { id: "p1", nombre: "Caña", precio: 2, clase_fiscal: "REDUCIDO" } as never;
  const base = {
    prodPorId: new Map([["p1", prod]]),
    formatos: {} as Record<string, never[]>,
    modById: {},
    preciosManuales: {},
    descuentos: {},
  };

  it("sin tarifa se cobra el precio normal", () => {
    expect(precioEfectivo(base as never, "p1")).toBe(2);
  });

  it("con precio de tarifa se cobra el de la tarifa", () => {
    expect(precioEfectivo({ ...base, preciosTarifa: { p1: 2.4 } } as never, "p1")).toBe(2.4);
  });

  it("UNA TARIFA SIN ESTE ARTÍCULO NO REGALA: cae al precio normal", () => {
    // El caso peligroso, el mismo que se probó en el servidor: una tarifa a
    // medio rellenar tiene que cobrar de más, jamás 0.
    expect(precioEfectivo({ ...base, preciosTarifa: { otro: 0.1 } } as never, "p1")).toBe(2);
    expect(precioEfectivo({ ...base, preciosTarifa: {} } as never, "p1")).toBe(2);
  });

  it("al peso, los kilos se multiplican por el precio de la tarifa", () => {
    expect(precioEfectivo({ ...base, preciosTarifa: { p1: 10 } } as never, "p1|@0.5")).toBe(5);
  });

  it("un precio MANUAL sigue mandando sobre la tarifa", () => {
    const ctx = { ...base, preciosTarifa: { p1: 2.4 }, preciosManuales: { p1: 1 } };
    expect(precioEfectivo(ctx as never, "p1")).toBe(1);
  });
});
