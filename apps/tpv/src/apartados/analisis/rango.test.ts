import { describe, it, expect } from "vitest";
import { rangoDe, etiquetaRango } from "./Analisis";

// Las fechas se cuelan mal en los informes con una facilidad pasmosa: un "7 días"
// que cuenta 8, o un cambio de mes que se lleva el día 1 al mes anterior.
// Se fija un "hoy" concreto para que la prueba no dependa de cuándo se ejecute.
const HOY = new Date(2026, 2, 15);      // 15 de marzo de 2026 (mes 2 = marzo)

describe("rangoDe", () => {
  it("«Hoy» es un solo día", () => {
    expect(rangoDe("hoy", HOY)).toEqual({ desde: "2026-03-15", hasta: "2026-03-15" });
  });

  it("«Ayer» es un solo día, el anterior", () => {
    expect(rangoDe("ayer", HOY)).toEqual({ desde: "2026-03-14", hasta: "2026-03-14" });
  });

  it("«7 días» cuenta 7, no 8 (hoy incluido)", () => {
    const { desde, hasta } = rangoDe("semana", HOY);
    expect(desde).toBe("2026-03-09");
    expect(hasta).toBe("2026-03-15");
    const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 + 1;
    expect(dias).toBe(7);
  });

  it("«Mes» arranca el día 1 del mes en curso", () => {
    expect(rangoDe("mes", HOY)).toEqual({ desde: "2026-03-01", hasta: "2026-03-15" });
  });

  it("a principio de mes, «7 días» cruza al mes anterior sin romperse", () => {
    const { desde, hasta } = rangoDe("semana", new Date(2026, 2, 3));   // 3 de marzo
    expect(desde).toBe("2026-02-25");
    expect(hasta).toBe("2026-03-03");
  });

  it("y «Mes» el día 1 es un solo día, no el mes anterior entero", () => {
    expect(rangoDe("mes", new Date(2026, 2, 1))).toEqual({ desde: "2026-03-01", hasta: "2026-03-01" });
  });

  it("«Ayer» el día 1 se va al mes anterior", () => {
    expect(rangoDe("ayer", new Date(2026, 2, 1))).toEqual({ desde: "2026-02-28", hasta: "2026-02-28" });
  });
});

describe("etiquetaRango", () => {
  it("un solo día sale sin guion", () => {
    expect(etiquetaRango("2026-03-15", "2026-03-15")).toBe("15/03/2026");
  });

  it("un rango sale con las dos fechas en formato español", () => {
    expect(etiquetaRango("2026-03-01", "2026-03-31")).toBe("01/03/2026 – 31/03/2026");
  });
});
