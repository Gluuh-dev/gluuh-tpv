import { describe, it, expect } from "vitest";
import { gruposEfectivos, type GrupoModificador, type Asignacion } from "./modificadores";

const grupo = (id: string, productId: string | null = null): GrupoModificador => ({
  id, nombre: id, tipo: "EXTRA", min: 0, max: 1, opciones: [], productId,
});

const inc = (grupoId: string, donde: Partial<Asignacion>): Asignacion => ({
  grupoId, familyId: null, categoryId: null, productId: null, modo: "INCLUIR", ...donde,
});
const exc = (grupoId: string, donde: Partial<Asignacion>): Asignacion => ({
  ...inc(grupoId, donde), modo: "EXCLUIR",
});

const ART = { id: "art-1", familia: "fam-1", categorias: ["cat-1", "cat-2"] };
const BIB = [grupo("punto-carne"), grupo("salsas"), grupo("pan")];

describe("gruposEfectivos", () => {
  it("sin asignaciones, un artículo solo tiene lo suyo", () => {
    const propios = [grupo("g-propio", "art-1"), grupo("g-de-otro", "art-9")];
    const r = gruposEfectivos(ART, propios, BIB, []);
    expect(r.map((g) => g.id)).toEqual(["g-propio"]);
    expect(r[0]?.origen).toBe("propio");
  });

  it("hereda de la FAMILIA y lo dice", () => {
    const r = gruposEfectivos(ART, [], BIB, [inc("punto-carne", { familyId: "fam-1" })]);
    expect(r.map((g) => g.id)).toEqual(["punto-carne"]);
    expect(r[0]?.origen).toBe("familia");
  });

  it("hereda por CUALQUIERA de sus categorías (es m2m)", () => {
    const r = gruposEfectivos(ART, [], BIB, [inc("salsas", { categoryId: "cat-2" })]);
    expect(r.map((g) => g.id)).toEqual(["salsas"]);
    expect(r[0]?.origen).toBe("categoria");
  });

  it("no hereda de una familia o categoría que no son las suyas", () => {
    const r = gruposEfectivos(ART, [], BIB, [
      inc("punto-carne", { familyId: "fam-9" }),
      inc("salsas", { categoryId: "cat-9" }),
    ]);
    expect(r).toEqual([]);
  });

  it("EL CASO QUE IMPORTA: el artículo puede quitarse lo que hereda de la familia", () => {
    const r = gruposEfectivos(ART, [], BIB, [
      inc("punto-carne", { familyId: "fam-1" }),
      exc("punto-carne", { productId: "art-1" }),
    ]);
    expect(r).toEqual([]);
  });

  it("…y puede volver a ponérselo aunque su categoría lo quite", () => {
    const r = gruposEfectivos(ART, [], BIB, [
      inc("salsas", { familyId: "fam-1" }),
      exc("salsas", { categoryId: "cat-1" }),
      inc("salsas", { productId: "art-1" }),
    ]);
    expect(r.map((g) => g.id)).toEqual(["salsas"]);
    expect(r[0]?.origen).toBe("articulo");
  });

  it("dentro del MISMO nivel, incluir gana a excluir", () => {
    // Dos asignaciones a la vez en familia: primero se aplican los EXCLUIR.
    const r = gruposEfectivos(ART, [], BIB, [
      exc("pan", { familyId: "fam-1" }),
      inc("pan", { familyId: "fam-1" }),
    ]);
    expect(r.map((g) => g.id)).toEqual(["pan"]);
  });

  it("un nivel de abajo NO deshace lo que uno de arriba excluyó, salvo que lo incluya", () => {
    const r = gruposEfectivos(ART, [], BIB, [
      inc("pan", { familyId: "fam-1" }),
      exc("pan", { categoryId: "cat-1" }),
    ]);
    expect(r).toEqual([]);
  });

  it("los propios y los heredados conviven", () => {
    const r = gruposEfectivos(ART, [grupo("mio", "art-1")], BIB, [inc("salsas", { familyId: "fam-1" })]);
    expect(r.map((g) => g.id).sort()).toEqual(["mio", "salsas"]);
  });

  it("una asignación a un grupo que ya no está en la biblioteca se ignora, no revienta", () => {
    const r = gruposEfectivos(ART, [], BIB, [inc("grupo-borrado", { familyId: "fam-1" })]);
    expect(r).toEqual([]);
  });

  it("un artículo sin familia no hereda por familia", () => {
    const sinFamilia = { id: "art-1", familia: null, categorias: [] };
    const r = gruposEfectivos(sinFamilia, [], BIB, [inc("pan", { familyId: "fam-1" })]);
    expect(r).toEqual([]);
  });
});
