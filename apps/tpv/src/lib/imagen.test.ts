import { describe, it, expect } from "vitest";
import { medidaReducida } from "./imagen";

describe("medidaReducida", () => {
  it("mete el lado largo justo en el máximo y respeta la proporción", () => {
    expect(medidaReducida(4000, 3000, 320)).toEqual({ ancho: 320, alto: 240 });
    expect(medidaReducida(3000, 4000, 320)).toEqual({ ancho: 240, alto: 320 });
  });

  it("no agranda lo que ya es pequeño (saldría borroso en el tile)", () => {
    expect(medidaReducida(64, 64, 320)).toEqual({ ancho: 64, alto: 64 });
  });

  it("nunca devuelve 0 px: una panorámica muy alargada seguiría siendo dibujable", () => {
    const m = medidaReducida(4000, 3, 320);
    expect(m.ancho).toBe(320);
    expect(m.alto).toBeGreaterThanOrEqual(1);
  });
});
