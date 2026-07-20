import { describe, it, expect } from "vitest";
import { refDeArticulo, indicePorRef } from "./referencia";
import type { Articulo } from "./datos-articulos";

const art = (id: string, codigo: string) => ({ id, codigo } as Articulo);

const lista = [art("uuid-a", "0001"), art("uuid-b", "0002"), art("uuid-c", "")];

describe("refDeArticulo", () => {
  it("usa el código, que es lo que el dueño lee y dice en voz alta", () => {
    expect(refDeArticulo(art("11111111-1111-1111-1111-111111111111", "0007"))).toBe("0007");
  });

  it("sin código cae al id: fea, pero la ficha abre", () => {
    // Los 74 productos del nodo tienen el `plu` vacío hasta que se lo pongan.
    expect(refDeArticulo(art("uuid-c", ""))).toBe("uuid-c");
    expect(refDeArticulo(art("uuid-c", "   "))).toBe("uuid-c");
  });
});

describe("indicePorRef", () => {
  it("encuentra por código", () => {
    expect(indicePorRef(lista, "0002")).toBe(1);
  });

  it("y también por id, para que los enlaces viejos sigan abriendo", () => {
    expect(indicePorRef(lista, "uuid-a")).toBe(0);
    expect(indicePorRef(lista, "uuid-c")).toBe(2);
  });

  it("una referencia que ya no existe da -1 (el caller cae al primero)", () => {
    expect(indicePorRef(lista, "9999")).toBe(-1);
    expect(indicePorRef(lista, undefined)).toBe(-1);
  });

  it("el código manda sobre el id si chocaran", () => {
    const chocan = [art("0002", "0009"), art("uuid-b", "0002")];
    expect(indicePorRef(chocan, "0002")).toBe(1);
  });

  it("un artículo sin código no se traga la referencia vacía", () => {
    expect(indicePorRef(lista, "")).toBe(-1);
  });
});
