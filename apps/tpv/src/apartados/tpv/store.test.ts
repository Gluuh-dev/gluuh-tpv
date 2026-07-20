import { describe, it, expect, beforeEach } from "vitest";
import { useVenta } from "./store";

// EL MARCHADO PARCIAL es la parte del store que más duele si falla: decide qué
// sale a cocina. Si `pendientes()` devuelve de más, el plato se hace DOS veces;
// si devuelve de menos, no se hace nunca. Por eso se prueba aquí.

const s = () => useVenta.getState();

describe("marchado parcial (lo que sale a cocina)", () => {
  beforeEach(() => s().iniciar("Mesa 3", 2, "Salón"));

  it("una comanda nueva está entera pendiente", () => {
    s().addProd("c1");
    s().addProd("c1");
    expect(s().pendientes()).toEqual([{ id: "c1", cantidad: 2 }]);
  });

  it("tras marchar no queda nada pendiente", () => {
    s().addProd("c1");
    s().marcarMarchado(["c1"]);
    expect(s().pendientes()).toEqual([]);
  });

  it("al añadir más de una línea YA marchada, solo lo nuevo vuelve a salir", () => {
    s().addProd("c1");            // 1 caña
    s().marcarMarchado(["c1"]);   // se manda a barra
    s().addProd("c1");            // llega otra caña
    s().addProd("c1");            // y otra
    // Las 2 nuevas, no las 3: la primera ya está servida.
    expect(s().pendientes()).toEqual([{ id: "c1", cantidad: 2 }]);
  });

  it("marchar solo una línea no marca las demás", () => {
    s().addProd("c1");
    s().addProd("ra1");
    s().marcarMarchado(["c1"]);
    expect(s().pendientes()).toEqual([{ id: "ra1", cantidad: 1 }]);
  });

  it("anular una línea se lleva su marcado (no deja rastro)", () => {
    s().addProd("c1");
    s().marcarMarchado(["c1"]);
    s().anularLinea("c1");
    s().addProd("c1");            // se vuelve a pedir lo mismo
    // Es una línea nueva: tiene que salir a cocina otra vez.
    expect(s().pendientes()).toEqual([{ id: "c1", cantidad: 1 }]);
  });

  it("vaciar y volver a empezar no arrastra marcados de la cuenta anterior", () => {
    s().addProd("c1");
    s().marcarMarchado(["c1"]);
    s().vaciar();
    s().addProd("c1");
    expect(s().pendientes()).toEqual([{ id: "c1", cantidad: 1 }]);
  });

  it("marcar una línea que ya no está en la comanda no la resucita", () => {
    s().marcarMarchado(["fantasma"]);
    expect(s().pendientes()).toEqual([]);
    expect(s().marchado["fantasma"]).toBeUndefined();
  });
});

describe("total de la cuenta", () => {
  beforeEach(() => s().iniciar("Barra", 1, "Barra"));

  it("las líneas invitadas no suman", () => {
    s().addProd("c1");            // caña 1,80
    s().addProd("ra1");           // bravas 6,00
    s().invitarLinea("ra1");
    expect(s().total()).toBeCloseTo(1.8, 2);
  });

  it("pero las invitadas SÍ salen a cocina (hay que hacerlas igual)", () => {
    s().addProd("ra1");
    s().invitarLinea("ra1");
    expect(s().pendientes()).toEqual([{ id: "ra1", cantidad: 1 }]);
  });
});
