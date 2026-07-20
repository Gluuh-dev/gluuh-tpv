import { describe, it, expect } from "vitest";
import { duplicarArticulo } from "./duplicar";
import { ARTICULOS_DEMO } from "./datos-articulos";

const original = ARTICULOS_DEMO[0]!;
let n = 0;
const idFalso = () => `id-${++n}`;

describe("duplicarArticulo", () => {
  it("es OTRO artículo: id y código nuevos", () => {
    n = 0;
    const copia = duplicarArticulo(original, "0099", idFalso);
    expect(copia.id).not.toBe(original.id);
    expect(copia.codigo).toBe("0099");
    expect(copia.nombre).toBe(`${original.nombre} (copia)`);
  });

  it("NO se lleva el código de barras: dos artículos con el mismo código rompen el escáner", () => {
    n = 0;
    const conBarras = { ...original, barras: "8410000000017" };
    expect(duplicarArticulo(conBarras, "0099", idFalso).barras).toBe("");
  });

  it("da id nuevo a cada formato, para no pisar los del original al guardar", () => {
    n = 0;
    const copia = duplicarArticulo(original, "0099", idFalso);
    const idsOriginales = original.formatos.map((f) => f.id);
    for (const f of copia.formatos) expect(idsOriginales).not.toContain(f.id);
    expect(new Set(copia.formatos.map((f) => f.id)).size).toBe(copia.formatos.length);
  });

  it("sí hereda lo que se quiere heredar: familia, impuesto, aspecto y precios", () => {
    n = 0;
    const conAspecto = { ...original, color: "#2f7fd0", icono: "beer", foto: "https://x/y.jpg" };
    const copia = duplicarArticulo(conAspecto, "0099", idFalso);
    expect(copia.familia).toBe(original.familia);
    expect(copia.impuesto).toBe(original.impuesto);
    expect(copia.color).toBe("#2f7fd0");
    expect(copia.icono).toBe("beer");
    expect(copia.foto).toBe("https://x/y.jpg");
    expect(copia.formatos[0]?.barra).toBe(original.formatos[0]?.barra);
  });

  it("no comparte estructuras con el original (tocar la copia no toca el original)", () => {
    n = 0;
    const copia = duplicarArticulo(original, "0099", idFalso);
    copia.categorias.push("otra");
    copia.parametros.vendible = !original.parametros.vendible;
    expect(original.categorias).not.toContain("otra");
    expect(copia.parametros.vendible).not.toBe(original.parametros.vendible);
  });
});
