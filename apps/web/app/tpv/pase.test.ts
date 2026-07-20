import { describe, it, expect } from "vitest";
import { paseDeGrupo, paseDeNombre } from "./pase";

describe("paseDeNombre (el apaño heredado)", () => {
  it("acierta con los nombres de toda la vida", () => {
    expect(paseDeNombre("Primero")).toBe(1);
    expect(paseDeNombre("2º Segundo")).toBe(2);
    expect(paseDeNombre("Postre")).toBe(4);
    expect(paseDeNombre("Bebida")).toBe(5);
  });

  it("y FALLA con los que no: este era el problema", () => {
    // Un bar que llame así a sus pasos se quedaba sin pase, y la comanda salía
    // sin ordenar sin que nadie viera un error.
    expect(paseDeNombre("Para picar")).toBeUndefined();
    expect(paseDeNombre("Entrantes")).toBeUndefined();
    expect(paseDeNombre("A compartir")).toBeUndefined();
  });
});

describe("paseDeGrupo", () => {
  it("lo CONFIGURADO manda sobre el nombre", () => {
    // «Para picar» configurado como primeros ya sale en su sitio.
    expect(paseDeGrupo("Para picar", 1)).toBe(1);
    // Y si el bar quiere el postre el primero, es su bar.
    expect(paseDeGrupo("Postre", 1)).toBe(1);
  });

  it("sin configurar, sigue deduciéndose del nombre (no cambia nada)", () => {
    expect(paseDeGrupo("Postre", null)).toBe(4);
    expect(paseDeGrupo("Postre")).toBe(4);
  });

  it("un 0 configurado es «sin pase» A PROPÓSITO, no un olvido", () => {
    // Una tabla de quesos o un catering: no hay orden, sale todo junto.
    expect(paseDeGrupo("Primero", 0)).toBeUndefined();
  });

  it("un nombre que no se reconoce y sin configurar sigue sin pase", () => {
    expect(paseDeGrupo("Para picar")).toBeUndefined();
  });
});
