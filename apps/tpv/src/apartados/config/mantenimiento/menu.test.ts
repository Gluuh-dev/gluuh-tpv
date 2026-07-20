import { describe, it, expect } from "vitest";
import { opcionesDePaso, problemasDelMenu, type Menu, type PasoMenu } from "./menu";

const paso = (p: Partial<PasoMenu>): PasoMenu => ({
  id: "g1", nombre: "Primero", orden: 1, categoryId: null,
  numPlatos: 1, ordenPrep: 1, opciones: [], ...p,
});

const menu = (p: Partial<Menu>): Menu => ({
  id: "m1", nombre: "Menú del día", precio: 13.9, claseFiscal: "REDUCIDO",
  activo: true, pasos: [paso({ opciones: ["a", "b"] })], ...p,
});

const CATS = { "cat-primeros": ["p1", "p2", "p3"], "cat-vacia": [] };

describe("opcionesDePaso", () => {
  it("con categoría, los platos son los de la categoría", () => {
    expect(opcionesDePaso(paso({ categoryId: "cat-primeros" }), CATS)).toEqual(["p1", "p2", "p3"]);
  });

  it("la categoría MANDA sobre la lista a mano: no hay dos verdades", () => {
    const p = paso({ categoryId: "cat-primeros", opciones: ["viejo"] });
    expect(opcionesDePaso(p, CATS)).toEqual(["p1", "p2", "p3"]);
  });

  it("sin categoría, la lista a mano", () => {
    expect(opcionesDePaso(paso({ opciones: ["a", "b"] }), CATS)).toEqual(["a", "b"]);
  });

  it("una categoría que ya no existe no revienta: cero platos", () => {
    expect(opcionesDePaso(paso({ categoryId: "borrada" }), CATS)).toEqual([]);
  });
});

describe("problemasDelMenu", () => {
  it("un menú bien montado no tiene pegas", () => {
    expect(problemasDelMenu(menu({}), CATS)).toEqual([]);
  });

  it("sin precio no se puede vender: el menú es CERRADO", () => {
    expect(problemasDelMenu(menu({ precio: 0 }), CATS).join(" ")).toContain("precio");
  });

  it("un paso SIN PLATOS se caza antes de guardar, no delante del cliente", () => {
    // Es el fallo que deja al camarero sin poder elegir nada en barra.
    const m = menu({ pasos: [paso({ nombre: "Postre", opciones: [] })] });
    expect(problemasDelMenu(m, CATS).join(" ")).toContain("Postre");
  });

  it("caza también la categoría vacía, no solo la lista vacía", () => {
    const m = menu({ pasos: [paso({ nombre: "Primero", categoryId: "cat-vacia" })] });
    expect(problemasDelMenu(m, CATS).join(" ")).toContain("ningún plato");
  });

  it("pedir más platos de los que hay es imposible de cumplir", () => {
    const m = menu({ pasos: [paso({ nombre: "Entrantes", numPlatos: 5, opciones: ["a", "b"] })] });
    expect(problemasDelMenu(m, CATS).join(" ")).toContain("solo ofrece 2");
  });

  it("un menú sin pasos no es un menú", () => {
    expect(problemasDelMenu(menu({ pasos: [] }), CATS).join(" ")).toContain("sin pasos");
  });
});
