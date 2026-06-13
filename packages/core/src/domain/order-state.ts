/**
 * Máquina de estados de la comanda.
 * Modelar el ciclo de vida como transiciones controladas evita estados
 * imposibles y facilita la sincronización offline (ver docs/06 §4).
 */

export type EstadoComanda =
  | "ABIERTA"
  | "ENVIADA_COCINA"
  | "SERVIDA"
  | "POR_COBRAR"
  | "COBRADA"
  | "ANULADA";

/** Transiciones permitidas desde cada estado. */
export const TRANSICIONES: Record<EstadoComanda, readonly EstadoComanda[]> = {
  ABIERTA: ["ENVIADA_COCINA", "POR_COBRAR", "ANULADA"],
  ENVIADA_COCINA: ["SERVIDA", "POR_COBRAR", "ANULADA"],
  SERVIDA: ["POR_COBRAR", "ANULADA"],
  POR_COBRAR: ["COBRADA", "ABIERTA", "ANULADA"],
  COBRADA: [], // estado final
  ANULADA: [], // estado final
};

export function puedeTransicionar(
  desde: EstadoComanda,
  hacia: EstadoComanda,
): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export class TransicionInvalidaError extends Error {
  constructor(
    public readonly desde: EstadoComanda,
    public readonly hacia: EstadoComanda,
  ) {
    super(`Transición de comanda no permitida: ${desde} → ${hacia}`);
    this.name = "TransicionInvalidaError";
  }
}

/** Devuelve el nuevo estado o lanza si la transición no es válida. */
export function transicionar(
  desde: EstadoComanda,
  hacia: EstadoComanda,
): EstadoComanda {
  if (!puedeTransicionar(desde, hacia)) {
    throw new TransicionInvalidaError(desde, hacia);
  }
  return hacia;
}

export function esEstadoFinal(estado: EstadoComanda): boolean {
  return TRANSICIONES[estado].length === 0;
}
