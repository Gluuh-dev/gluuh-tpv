/**
 * Estados de preparación para las pantallas (cliente-safe: sin dependencias de
 * Node). Espeja a @gluuh/core (operations.ts) pero sin importar el barrel del
 * core (que incluye node:crypto/qrcode y no debe ir al bundle del navegador).
 */

export type EstadoPrep = "PENDIENTE" | "EN_PREPARACION" | "LISTO" | "ENTREGADO";

export const LABEL: Record<EstadoPrep, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  ENTREGADO: "Entregado",
};

export const SIGUIENTE: Record<EstadoPrep, EstadoPrep | null> = {
  PENDIENTE: "EN_PREPARACION",
  EN_PREPARACION: "LISTO",
  LISTO: "ENTREGADO",
  ENTREGADO: null,
};

export const COLOR: Record<EstadoPrep, string> = {
  PENDIENTE: "#6b7280",
  EN_PREPARACION: "#f59e0b",
  LISTO: "#16a34a",
  ENTREGADO: "#9ca3af",
};
