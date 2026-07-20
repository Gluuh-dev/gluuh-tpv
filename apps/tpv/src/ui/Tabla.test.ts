import { describe, it, expect } from "vitest";
import { ordenar, buscar, type ColumnaTabla } from "./Tabla";
import { textoExport, alaDerecha } from "../lib/exportar";

interface F { nombre: string; importe: number; coste: number | null }

const COL: ColumnaTabla<F>[] = [
  { titulo: "Artículo", valor: (f) => f.nombre },
  { titulo: "Importe", valor: (f) => f.importe, tipo: "euro" },
  { titulo: "Coste", valor: (f) => f.coste, tipo: "euro" },
];
const FILAS: F[] = [
  { nombre: "Caña", importe: 9.5, coste: 1.2 },
  { nombre: "Menú del día", importe: 1486.3, coste: null },
  { nombre: "Café solo", importe: 96.2, coste: 0.26 },
];

describe("ordenar", () => {
  it("★ los importes se ordenan como NÚMEROS, no como texto", () => {
    // Si la columna guardara «1.486,30» ya formateado, el 9,50 saldría el mayor
    // por ser texto y la tabla mentiría en la ordenación más usada que hay.
    const o = ordenar(FILAS, COL[1]!, true).map((f) => f.importe);
    expect(o).toEqual([1486.3, 96.2, 9.5]);
  });

  it("ordena texto en español, sin distinguir acentos ni mayúsculas", () => {
    expect(ordenar(FILAS, COL[0]!, false).map((f) => f.nombre)).toEqual(["Café solo", "Caña", "Menú del día"]);
  });

  it("★ los huecos van al final, se ordene como se ordene", () => {
    for (const desc of [true, false]) {
      const o = ordenar(FILAS, COL[2]!, desc);
      expect(o[o.length - 1]!.coste).toBeNull();
    }
  });

  it("no toca el array original", () => {
    const antes = [...FILAS];
    ordenar(FILAS, COL[1]!, true);
    expect(FILAS).toEqual(antes);
  });
});

describe("buscar", () => {
  it("★ sin acentos: «cana» encuentra «Caña»", () => {
    expect(buscar(FILAS, COL, "cana").map((f) => f.nombre)).toEqual(["Caña"]);
  });

  it("busca en todas las columnas, no solo en la primera", () => {
    expect(buscar(FILAS, COL, "96").map((f) => f.nombre)).toEqual(["Café solo"]);
  });

  it("sin texto devuelve todo; con espacios, también", () => {
    expect(buscar(FILAS, COL, "   ")).toHaveLength(3);
  });

  it("una columna vacía no rompe la búsqueda", () => {
    expect(() => buscar(FILAS, COL, "x")).not.toThrow();
  });
});

describe("exportación", () => {
  it("★ los euros salen «1486,30»: coma decimal, sin € ni miles", () => {
    // Con «1.486,30 €» Excel trata la columna como texto y el gestor no la suma.
    expect(textoExport(COL[1]!, FILAS[1]!)).toBe("1486,30");
  });

  it("un hueco se exporta vacío, no como «null»", () => {
    expect(textoExport(COL[2]!, FILAS[1]!)).toBe("");
  });

  it("los importes y las cantidades se alinean a la derecha solos", () => {
    expect(alaDerecha(COL[1]!)).toBe(true);
    expect(alaDerecha(COL[0]!)).toBe(false);
  });
});
