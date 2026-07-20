import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { descargarCSV, type ColumnaInforme } from "./exportar";

// Lo que se rompe de verdad al exportar: separadores dentro de un nombre de
// producto, comillas, acentos y que Excel es-ES lo abra en columnas.

interface Fila { nombre: string; uds: number; importe: number }
const COLS: ColumnaInforme<Fila>[] = [
  { titulo: "Artículo", valor: (f) => f.nombre },
  { titulo: "Uds", valor: (f) => f.uds, derecha: true },
  { titulo: "Importe", valor: (f) => f.importe.toFixed(2).replace(".", ","), derecha: true },
];

/** Captura el contenido del Blob que se descarga, sin tocar el disco. */
function capturarCSV(filas: Fila[]): string {
  let capturado = "";
  const urlFalsa = "blob:test";
  vi.stubGlobal("URL", {
    createObjectURL: (b: Blob) => { capturado = (b as unknown as { _texto: string })._texto; return urlFalsa; },
    revokeObjectURL: () => {},
  });
  // Blob no guarda el texto de forma síncrona: se envuelve para poder leerlo.
  class BlobFalso {
    _texto: string;
    constructor(partes: string[]) { this._texto = partes.join(""); }
  }
  vi.stubGlobal("Blob", BlobFalso);
  vi.stubGlobal("document", {
    createElement: () => ({ href: "", download: "", click: () => {} }),
  });
  descargarCSV("informe", COLS, filas);
  return capturado;
}

describe("descargarCSV", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("empieza con BOM y separa por ';' (para que Excel es-ES lo abra en columnas)", () => {
    const csv = capturarCSV([{ nombre: "Caña", uds: 2, importe: 4 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\n")[0]).toBe("﻿Artículo;Uds;Importe");
  });

  it("entrecomilla si el valor lleva el separador dentro", () => {
    const csv = capturarCSV([{ nombre: "Menú; del día", uds: 1, importe: 14.5 }]);
    expect(csv).toContain('"Menú; del día"');
  });

  it("dobla las comillas dentro del texto", () => {
    const csv = capturarCSV([{ nombre: 'Ración "grande"', uds: 1, importe: 9 }]);
    expect(csv).toContain('"Ración ""grande"""');
  });

  it("entrecomilla los saltos de línea (si no, parten la fila en dos)", () => {
    const csv = capturarCSV([{ nombre: "Tarta\nde queso", uds: 1, importe: 5 }]);
    expect(csv).toContain('"Tarta\nde queso"');
    // La cabecera + una sola fila lógica, aunque el texto lleve un salto dentro.
    expect(csv.split('"').length).toBe(3);
  });

  it("conserva los decimales con coma (formato español)", () => {
    const csv = capturarCSV([{ nombre: "Paella", uds: 2, importe: 17.5 }]);
    expect(csv).toContain("Paella;2;17,50");
  });

  it("una tabla vacía exporta solo la cabecera (no revienta)", () => {
    const csv = capturarCSV([]);
    expect(csv).toBe("﻿Artículo;Uds;Importe\n");
  });
});
