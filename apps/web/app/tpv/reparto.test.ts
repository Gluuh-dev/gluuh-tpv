import { describe, it, expect } from "vitest";
import { repartirIgual } from "./reparto";

const suma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

describe("repartirIgual — céntimos exactos", () => {
  it("10 € en 3 → 3.33/3.33/3.34 y suma 10", () => {
    expect(repartirIgual(10, 3)).toEqual([3.33, 3.33, 3.34]);
    expect(suma(repartirIgual(10, 3))).toBe(10);
  });
  it("una sola parte = el total", () => {
    expect(repartirIgual(12.5, 1)).toEqual([12.5]);
  });
  it("céntimos que no dividen: 0.10 € en 3 → 0.03/0.03/0.04", () => {
    expect(repartirIgual(0.1, 3)).toEqual([0.03, 0.03, 0.04]);
    expect(suma(repartirIgual(0.1, 3))).toBe(0.1);
  });
  it("reparto exacto: 10 € en 4 → todo 2.50", () => {
    expect(repartirIgual(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5]);
  });
  it("la suma SIEMPRE cuadra (varios casos)", () => {
    for (const [t, n] of [[7.03, 3], [99.99, 7], [1, 6], [33.33, 9]] as const) {
      expect(suma(repartirIgual(t, n))).toBe(Math.round(t * 100) / 100);
    }
  });
  it("n <= 0 → []", () => {
    expect(repartirIgual(10, 0)).toEqual([]);
    expect(repartirIgual(10, -2)).toEqual([]);
  });
});
