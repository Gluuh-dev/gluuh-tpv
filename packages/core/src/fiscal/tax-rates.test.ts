import { describe, it, expect } from "vitest";
import { ivaAuto, nombreImpuesto, TIPOS_POR_TERRITORIO } from "./tax-rates.js";

describe("ivaAuto — tipos por clase y territorio", () => {
  it("CANARIAS: REDUCIDO→3, GENERAL→7, EXENTO→0", () => {
    expect(ivaAuto("REDUCIDO", "CANARIAS")).toBe(3);
    expect(ivaAuto("GENERAL", "CANARIAS")).toBe(7);
    expect(ivaAuto("EXENTO", "CANARIAS")).toBe(0);
  });

  it("PENINSULA_BALEARES: GENERAL→21", () => {
    expect(ivaAuto("GENERAL", "PENINSULA_BALEARES")).toBe(21);
  });

  it("territorio desconocido cae a PENINSULA_BALEARES", () => {
    expect(ivaAuto("GENERAL", "ZZZ")).toBe(21);
  });

  it("clase desconocida → 0", () => {
    expect(ivaAuto("NOPE", "CANARIAS")).toBe(0);
  });
});

describe("nombreImpuesto — etiqueta por territorio", () => {
  it("CANARIAS→IGIC, CEUTA_MELILLA→IPSI, resto→IVA", () => {
    expect(nombreImpuesto("CANARIAS")).toBe("IGIC");
    expect(nombreImpuesto("CEUTA_MELILLA")).toBe("IPSI");
    expect(nombreImpuesto("PENINSULA_BALEARES")).toBe("IVA");
    expect(nombreImpuesto("FORAL_PV")).toBe("IVA");
  });
});

describe("Guardia anti-deriva: CANARIAS debe coincidir con seed SQL tax_rate", () => {
  // Si cambias estos valores, actualiza también supabase/migrations/0012_catalogo_fiscal.sql (tabla tax_rate).
  it("CANARIAS coincide con los valores del seed SQL", () => {
    const expected = { GENERAL: 7, REDUCIDO: 3, SUPERREDUCIDO: 0, EXENTO: 0 };
    expect(TIPOS_POR_TERRITORIO["CANARIAS"]).toEqual(expected);
  });
});
