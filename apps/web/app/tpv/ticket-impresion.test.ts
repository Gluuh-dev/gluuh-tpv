// Caracterización de las piezas puras del ticket imprimible (E1.3).
import { describe, it, expect } from "vitest";
import { etiquetaContexto, lineasImprimibles } from "./ticket-impresion";
import type { CtxNombres } from "./nombres";
import type { Prod } from "../lib/catalogo-store";

const prod = (id: string, precio: number, extra?: Partial<Prod>): Prod => ({
  id, nombre: id, precio, tipo_impositivo: 10, category_id: null,
  estacion: "COCINA", foto_url: null, agotado_hasta: null, vendido_por_peso: false, ...extra,
});

const ctxN = (): CtxNombres => ({
  prodPorId: new Map([["cafe", prod("cafe", 1.5, { nombre_ticket: "Café" } as Partial<Prod>)]]),
  formatos: {},
  modById: { extra1: { id: "extra1", nombre: "Sirope", precio_extra: 0.5 } },
});

describe("etiquetaContexto", () => {
  it("mesa", () => expect(etiquetaContexto({ nombre: "Mesa 5" }, null)).toBe("Mesa 5"));
  it("llevar", () => expect(etiquetaContexto(null, { nombre: "Ana" })).toBe("Para llevar · Ana"));
  it("barra", () => expect(etiquetaContexto(null, null)).toBe("Barra"));
});

describe("lineasImprimibles", () => {
  it("usa nombre_ticket, importe = precio×cantidad y extras", () => {
    expect(lineasImprimibles(ctxN(), [{ id: "cafe||extra1", cantidad: 2, precio: 2 }])).toEqual([
      { cantidad: 2, nombre: "Café", importe: 4, extras: [{ nombre: "Sirope", cantidad: 1, precioExtra: 0.5 }] },
    ]);
  });
});
