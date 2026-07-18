// Resolución de "combinable" (7.1): familia por defecto, override por producto.
import { describe, it, expect } from "vitest";
import { esCombinable, type Family, type Cat, type Prod } from "./catalogo-store";

const fam = (id: string, combinable?: boolean): Family => ({ id, nombre: id, color: "#000", combinable });
const cat = (id: string, family_id: string | null): Cat => ({ id, nombre: id, orden: 0, family_id });
const prod = (id: string, extra: Partial<Prod>): Prod => ({
  id, nombre: id, precio: 1, tipo_impositivo: 10, category_id: null, estacion: null,
  foto_url: null, agotado_hasta: null, vendido_por_peso: false, ...extra,
});

const S = (prods: Prod[], families: Family[] = [], cats: Cat[] = []) => ({ prods, families, cats });

describe("esCombinable", () => {
  it("hereda de la familia directa del producto", () => {
    const s = S([prod("copa", { family_id: "licores" })], [fam("licores", true)]);
    expect(esCombinable(s, "copa")).toBe(true);
  });

  it("hereda de la familia de la categoría principal si el producto no la trae", () => {
    const s = S([prod("copa", { category_id: "cat1" })], [fam("licores", true)], [cat("cat1", "licores")]);
    expect(esCombinable(s, "copa")).toBe(true);
  });

  it("el override del producto GANA sobre la familia (desactivar)", () => {
    const s = S([prod("aguardiente", { family_id: "licores", combinable: false })], [fam("licores", true)]);
    expect(esCombinable(s, "aguardiente")).toBe(false);
  });

  it("el override del producto GANA sobre la familia (activar)", () => {
    const s = S([prod("especial", { family_id: "refrescos", combinable: true })], [fam("refrescos", false)]);
    expect(esCombinable(s, "especial")).toBe(true);
  });

  it("null en el producto = hereda (no fuerza false)", () => {
    const s = S([prod("copa", { family_id: "licores", combinable: null })], [fam("licores", true)]);
    expect(esCombinable(s, "copa")).toBe(true);
  });

  it("sin familia combinable → false", () => {
    const s = S([prod("agua", { family_id: "aguas" })], [fam("aguas")]);
    expect(esCombinable(s, "agua")).toBe(false);
  });

  it("producto desconocido → false", () => {
    expect(esCombinable(S([]), "nope")).toBe(false);
  });
});
