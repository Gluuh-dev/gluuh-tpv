import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { TIPOS_POR_TERRITORIO, ivaAuto } from "./tax-rates.js";

// Guarda de coherencia (F1 DoD): el seed de `tax_rate` en la migración SQL DEBE
// coincidir con `TIPOS_POR_TERRITORIO` del core. Si alguien cambia uno sin el
// otro, este test falla en CI (sin necesidad de base de datos).

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(
  here,
  "../../../../supabase/migrations/0012_catalogo_fiscal.sql",
);

function seedFromSql(): Record<string, Record<string, number>> {
  const sql = readFileSync(sqlPath, "utf8");
  const out: Record<string, Record<string, number>> = {};
  // Tuplas del INSERT: ('TERRITORIO','CLASE',porcentaje)
  const re = /\('([A-Z_]+)'\s*,\s*'([A-Z]+)'\s*,\s*(\d+(?:\.\d+)?)\)/g;
  for (const m of sql.matchAll(re)) {
    const terr = m[1]!;
    const clase = m[2]!;
    (out[terr] ??= {})[clase] = Number(m[3]!);
  }
  return out;
}

describe("tax_rate (SQL) ↔ TIPOS_POR_TERRITORIO (core)", () => {
  const sqlSeed = seedFromSql();

  it("el seed SQL existe y tiene las 5 territorios × 4 clases", () => {
    expect(Object.keys(sqlSeed).sort()).toEqual(
      Object.keys(TIPOS_POR_TERRITORIO).sort(),
    );
    for (const terr of Object.keys(TIPOS_POR_TERRITORIO)) {
      expect(Object.keys(sqlSeed[terr] ?? {}).sort()).toEqual(
        ["EXENTO", "GENERAL", "REDUCIDO", "SUPERREDUCIDO"],
      );
    }
  });

  it("cada % del seed SQL coincide con el del core (y con ivaAuto)", () => {
    for (const [terr, clases] of Object.entries(TIPOS_POR_TERRITORIO)) {
      for (const [clase, pct] of Object.entries(clases)) {
        expect(sqlSeed[terr]?.[clase]).toBe(pct);
        expect(ivaAuto(clase, terr)).toBe(pct);
      }
    }
  });
});
