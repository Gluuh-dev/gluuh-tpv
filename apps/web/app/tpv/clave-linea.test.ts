// Tests de las claves de línea de la comanda (portados del antiguo demo()
// autoejecutable, que ningún runner corría). Cubre el bug del descuento
// contagiado: añadir · DTO · re-añadir → 2 líneas, el descuento solo en la 1ª.
import { describe, it, expect } from "vitest";
import { claveBase, claveDeLinea, claveParaAnadir } from "./clave-linea";

describe("claveParaAnadir — personalización no contagia", () => {
  const montar = () => {
    const comanda: Record<string, number> = {};
    const descuentos: Record<string, { pct: number }> = {};
    const preciosManuales: Record<string, number> = {};
    const tienePerso = (k: string) => descuentos[k] !== undefined || preciosManuales[k] !== undefined;
    const anadir = (base: string) => {
      const k = claveParaAnadir(base, comanda, tienePerso);
      comanda[k] = (comanda[k] ?? 0) + 1;
      return k;
    };
    return { comanda, descuentos, preciosManuales, anadir };
  };

  it("añadir · DTO 20% · re-añadir → línea nueva #2 sin descuento", () => {
    const { comanda, descuentos, anadir } = montar();
    const PRECIO = 10;
    const precio = (k: string) => {
      const d = descuentos[k];
      return d ? PRECIO * (1 - d.pct / 100) : PRECIO;
    };
    const k1 = anadir("p");
    expect(k1).toBe("p");                       // la 1ª línea usa la clave base
    descuentos[k1] = { pct: 20 };
    const k2 = anadir("p");
    expect(k2).toBe("p#2");                     // la 2ª recibe clave única (no fusiona)
    expect(Object.keys(comanda)).toHaveLength(2);
    expect(comanda["p"]).toBe(1);
    expect(comanda["p#2"]).toBe(1);
    expect(descuentos["p#2"]).toBeUndefined();  // la nueva sale sin descuento
    expect(precio("p")).toBe(8);                // la 1ª mantiene el descuento
    expect(precio("p#2")).toBe(10);             // la nueva a precio completo
    expect(precio("p") * comanda["p"]! + precio("p#2") * comanda["p#2"]!).toBe(18);
  });

  it("sin personalización, las líneas fusionan (comportamiento normal)", () => {
    const { comanda, anadir } = montar();
    expect(anadir("q")).toBe("q");
    expect(anadir("q")).toBe("q");
    expect(comanda["q"]).toBe(2);
  });

  it("los huecos #n ocupados se saltan al siguiente libre", () => {
    const { comanda, descuentos, anadir } = montar();
    anadir("r"); descuentos["r"] = { pct: 10 };
    const k2 = anadir("r"); descuentos[k2] = { pct: 10 };
    expect(anadir("r")).toBe("r#3");
  });
});

describe("claveBase / claveDeLinea", () => {
  it("claveBase quita el sufijo #n", () => {
    expect(claveBase("p#2")).toBe("p");
    expect(claveBase("a|b|c#3")).toBe("a|b|c");
    expect(claveBase("simple")).toBe("simple");
  });
  it("claveDeLinea ordena los modificadores y omite partes vacías", () => {
    expect(claveDeLinea("x", "f1", ["b", "a"])).toBe("x|f1|a,b");
    expect(claveDeLinea("x", undefined, [])).toBe("x");
    expect(claveDeLinea("x", undefined, ["m"])).toBe("x||m");
  });
});
