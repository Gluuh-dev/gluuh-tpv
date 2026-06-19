import { describe, it, expect } from "vitest";
import { encadenarRegistros, verificarCadena } from "./verifactu.js";

// F2 DoD: "huella encadenada verificable (factura N referencia N-1)".
// verificarCadena() es el inverso de encadenarRegistros() y alimenta la columna
// "Cadena Correcta" del Visor VERIFACTU.

const base = (n: number) => ({
  idEmisorFactura: "B00000000",
  numSerieFactura: `FA-2026-${n}`,
  fechaExpedicionFactura: "19-06-2026",
  tipoFactura: "F2",
  cuotaTotal: "2.10",
  importeTotal: "12.10",
  fechaHoraHusoGenRegistro: `2026-06-19T1${n}:00:00+02:00`,
});

describe("verificarCadena", () => {
  it("una cadena bien encadenada es íntegra", () => {
    const cadena = encadenarRegistros([base(1), base(2), base(3)]);
    const r = verificarCadena(cadena);
    expect(r.ok).toBe(true);
    expect(r.primerFallo).toBe(-1);
    expect(r.registros.every((x) => x.huellaOk && x.enlaceOk)).toBe(true);
  });

  it("respeta la huella inicial (continuación de cadena previa / offline)", () => {
    const previa = encadenarRegistros([base(1)]);
    const cont = encadenarRegistros([base(2), base(3)], previa[0]!.huella);
    expect(verificarCadena(cont, previa[0]!.huella).ok).toBe(true);
    // Sin la huella inicial correcta, el primer enlace falla
    expect(verificarCadena(cont).registros[0]!.enlaceOk).toBe(false);
  });

  it("detecta manipulación de un importe (huella no recalcula)", () => {
    const cadena = encadenarRegistros([base(1), base(2), base(3)]);
    cadena[1] = { ...cadena[1]!, importeTotal: "99.99" }; // alterado tras firmar
    const r = verificarCadena(cadena);
    expect(r.ok).toBe(false);
    expect(r.registros[1]!.huellaOk).toBe(false);
    expect(r.primerFallo).toBe(1);
  });

  it("detecta un hueco/enlace roto en la cadena", () => {
    const cadena = encadenarRegistros([base(1), base(2), base(3)]);
    cadena[2] = { ...cadena[2]!, huellaRegistroAnterior: "0".repeat(64) };
    const r = verificarCadena(cadena);
    expect(r.ok).toBe(false);
    expect(r.registros[2]!.enlaceOk).toBe(false);
    expect(r.registros[2]!.huellaOk).toBe(false); // la huella tampoco cuadra
    expect(r.primerFallo).toBe(2);
  });
});
