import { describe, it, expect } from "vitest";
import { paso, ticks } from "./graficas";

// Un eje mal escalado no da error: dibuja barras que se salen del marco o que
// parecen todas iguales. Y con un máximo de 0 (un día sin ventas) la escala
// dividiría por cero y el gráfico saldría en blanco sin decir por qué.

describe("paso", () => {
  it("elige escalones redondos, no el número que salga", () => {
    expect(paso(100)).toBe(25);        // 100/4 = 25 exacto
    expect(paso(440)).toBe(100);       // 110 → al escalón más cercano, no a 200
    expect(paso(1486.3)).toBe(500);
    expect(paso(38610.4)).toBe(10_000);
  });

  it("con máximo 0 o inválido devuelve 1, no NaN ni Infinity", () => {
    for (const m of [0, -5, NaN, Infinity]) expect(paso(m)).toBe(1);
  });
});

describe("ticks", () => {
  it("siempre arrancan en 0", () => {
    expect(ticks(1486.3)[0]).toBe(0);
  });

  it("★ la última marca llega o pasa el máximo (ninguna barra se sale)", () => {
    for (const max of [1, 7, 99, 100, 440, 1486.3, 9842.6, 38_610.4]) {
      const t = ticks(max);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it("vienen ordenados y sin repetir", () => {
    const t = ticks(9842.6);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    expect(new Set(t).size).toBe(t.length);
  });

  it("no arrastran decimales de coma flotante (0,1 + 0,2…)", () => {
    for (const v of ticks(1)) expect(v).toBe(Math.round(v * 100) / 100);
  });

  it("con máximo 0 devuelve una escala usable, no una vacía", () => {
    expect(ticks(0)).toEqual([0, 1]);
  });
});
