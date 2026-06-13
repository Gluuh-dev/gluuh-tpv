/**
 * Tipos de operación y estados de preparación.
 *
 * IMPORTANTE (cumplimiento legal): TODAS las operaciones se registran (la
 * inalterabilidad y trazabilidad las exige VERIFACTU). La diferencia es que
 * SOLO la "VENTA" genera factura/ticket y registro VERIFACTU. Las demás
 * (invitación, autoconsumo, merma, formación) quedan registradas pero NO
 * facturan. Esto da flexibilidad operativa legítima al hostelero SIN ser una
 * herramienta para ocultar ventas (lo cual sería ilegal y haría el software no
 * certificable). Ver docs/07 §3 y docs/14.
 */

export type TipoOperacion =
  | "VENTA" // venta real a cliente → factura + VERIFACTU
  | "INVITACION" // cortesía/promoción, sin cobro
  | "AUTOCONSUMO" // consumo del personal/propietario (tiene tratamiento fiscal propio)
  | "MERMA" // producto perdido/roto/caducado
  | "FORMACION"; // modo prueba/entrenamiento (sin valor)

export const TIPO_OPERACION_LABEL: Record<TipoOperacion, string> = {
  VENTA: "Venta",
  INVITACION: "Invitación",
  AUTOCONSUMO: "Autoconsumo",
  MERMA: "Merma / rotura",
  FORMACION: "Formación / prueba",
};

/** Solo la venta genera factura/ticket fiscal y registro VERIFACTU. */
export function generaFactura(tipo: TipoOperacion): boolean {
  return tipo === "VENTA";
}

/** ¿La operación implica cobro al cliente? */
export function implicaCobro(tipo: TipoOperacion): boolean {
  return tipo === "VENTA";
}

/** Estado de preparación de un pedido (para KDS y display de cliente). */
export type EstadoPreparacion =
  | "PENDIENTE"
  | "EN_PREPARACION"
  | "LISTO"
  | "ENTREGADO";

export const ESTADO_PREPARACION_LABEL: Record<EstadoPreparacion, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo para recoger",
  ENTREGADO: "Entregado",
};

/** Transiciones válidas del estado de preparación (flujo fast-food). */
export const PREPARACION_SIGUIENTE: Record<EstadoPreparacion, EstadoPreparacion | null> = {
  PENDIENTE: "EN_PREPARACION",
  EN_PREPARACION: "LISTO",
  LISTO: "ENTREGADO",
  ENTREGADO: null,
};
