import { describe, it, expect } from "vitest";
import { diarioDe } from "./Analisis";

// Lo que NO puede pasar: que el diario y los KPI del mismo periodo digan cosas
// distintas. Dos pantallas del mismo día que no cuadran destruyen la confianza en
// las dos — y el dueño se queda sin saber cuál creer.

describe("diarioDe", () => {
  it("saca exactamente los tickets del periodo", () => {
    expect(diarioDe(63, 1486.3, 1000)).toHaveLength(63);
  });

  it("★ la suma de los tickets es EXACTAMENTE el total del periodo", () => {
    for (const [n, total] of [[63, 1486.3], [21, 498.9], [1, 12.5], [7, 100]] as const) {
      const suma = diarioDe(n, total, 1000).reduce((a, t) => a + t.total, 0);
      expect(Math.round(suma * 100) / 100).toBe(total);
    }
  });

  it("ningún ticket sale en negativo", () => {
    expect(diarioDe(40, 300, 1000).every((t) => t.total >= 0)).toBe(true);
  });

  it("los números de ticket no se repiten", () => {
    const d = diarioDe(63, 1486.3, 1000);
    expect(new Set(d.map((t) => t.numero)).size).toBe(63);
  });

  it("es DETERMINISTA: dos llamadas iguales dan lo mismo (nada de Math.random)", () => {
    expect(diarioDe(30, 900, 1000)).toEqual(diarioDe(30, 900, 1000));
  });

  it("viene ordenado de más reciente a más antiguo", () => {
    const horas = diarioDe(30, 900, 1000).map((t) => t.hora);
    expect([...horas].sort((a, b) => b.localeCompare(a))).toEqual(horas);
  });

  it("las horas caen dentro del horario del bar (08:00–21:00)", () => {
    for (const t of diarioDe(63, 1486.3, 1000)) {
      const [h] = t.hora.split(":").map(Number);
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h).toBeLessThanOrEqual(21);
    }
  });

  it("sin tickets, el diario está vacío (no revienta)", () => {
    expect(diarioDe(0, 0, 1000)).toEqual([]);
  });
});
