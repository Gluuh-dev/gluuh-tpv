import { describe, it, expect } from "vitest";
import {
  generaFactura,
  implicaCobro,
  PREPARACION_SIGUIENTE,
  type TipoOperacion,
} from "./operations.js";

describe("Tipos de operación — solo la VENTA factura", () => {
  const todos: TipoOperacion[] = ["VENTA", "INVITACION", "AUTOCONSUMO", "MERMA", "FORMACION"];

  it("solo VENTA genera factura y cobro", () => {
    for (const t of todos) {
      const esVenta = t === "VENTA";
      expect(generaFactura(t)).toBe(esVenta);
      expect(implicaCobro(t)).toBe(esVenta);
    }
  });
});

describe("Estados de preparación (fast-food)", () => {
  it("avanza PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO → fin", () => {
    expect(PREPARACION_SIGUIENTE.PENDIENTE).toBe("EN_PREPARACION");
    expect(PREPARACION_SIGUIENTE.EN_PREPARACION).toBe("LISTO");
    expect(PREPARACION_SIGUIENTE.LISTO).toBe("ENTREGADO");
    expect(PREPARACION_SIGUIENTE.ENTREGADO).toBeNull();
  });
});
