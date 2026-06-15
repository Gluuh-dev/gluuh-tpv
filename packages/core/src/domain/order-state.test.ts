import { describe, it, expect } from "vitest";
import {
  puedeTransicionar,
  transicionar,
  esEstadoFinal,
  TransicionInvalidaError,
  TRANSICIONES,
  type EstadoComanda,
} from "./order-state.js";

describe("puedeTransicionar — matriz completa de transiciones", () => {
  it("cada estado acepta exactamente los destinos listados en TRANSICIONES", () => {
    const todosLosEstados = Object.keys(TRANSICIONES) as EstadoComanda[];

    for (const desde of todosLosEstados) {
      const destinos = TRANSICIONES[desde] as readonly EstadoComanda[];
      for (const hacia of todosLosEstados) {
        const esperado = destinos.includes(hacia);
        expect(
          puedeTransicionar(desde, hacia),
          `puedeTransicionar("${desde}", "${hacia}") debe ser ${esperado}`,
        ).toBe(esperado);
      }
    }
  });
});

describe("puedeTransicionar — casos críticos puntuales", () => {
  it("COBRADA → ABIERTA es ilegal (estado final inviolable)", () => {
    expect(puedeTransicionar("COBRADA", "ABIERTA")).toBe(false);
  });

  it("POR_COBRAR → ABIERTA es legítima (reapertura antes de cobrar)", () => {
    expect(puedeTransicionar("POR_COBRAR", "ABIERTA")).toBe(true);
  });
});

describe("transicionar", () => {
  it("devuelve el estado destino en una transición válida", () => {
    expect(transicionar("ABIERTA", "ENVIADA_COCINA")).toBe("ENVIADA_COCINA");
  });

  it("lanza TransicionInvalidaError en transición ilegal COBRADA → ABIERTA", () => {
    expect(() => transicionar("COBRADA", "ABIERTA")).toThrow(
      TransicionInvalidaError,
    );
  });

  it("el error tiene .desde y .hacia correctos", () => {
    let err: TransicionInvalidaError | undefined;
    try {
      transicionar("COBRADA", "ABIERTA");
    } catch (e) {
      err = e as TransicionInvalidaError;
    }
    expect(err).toBeInstanceOf(TransicionInvalidaError);
    expect(err!.desde).toBe("COBRADA");
    expect(err!.hacia).toBe("ABIERTA");
  });
});

describe("esEstadoFinal", () => {
  it("COBRADA es estado final", () => {
    expect(esEstadoFinal("COBRADA")).toBe(true);
  });

  it("ANULADA es estado final", () => {
    expect(esEstadoFinal("ANULADA")).toBe(true);
  });

  it("ABIERTA no es estado final", () => {
    expect(esEstadoFinal("ABIERTA")).toBe(false);
  });
});
