/**
 * @servio/core — Lógica de negocio compartida por web, escritorio, móvil y backend.
 *
 * Contiene el "cerebro" del TPV que NO debe duplicarse entre plataformas:
 *  - Tipos de dominio (productos, comandas, facturas).
 *  - Motor de impuestos (IVA peninsular e IGIC canario).
 *  - Motor VERIFACTU (hash encadenado SHA-256 + QR de cotejo AEAT).
 *  - Máquina de estados de la comanda.
 *
 * Ver docs/05-stack-tecnologico.md y docs/07-facturacion-y-cumplimiento-legal.md
 */

export * from "./domain/types.js";
export * from "./domain/order-state.js";
export * from "./domain/operations.js";
export * from "./fiscal/tax.js";
export * from "./fiscal/verifactu.js";
export * from "./fiscal/qr.js";
export * from "./fiscal/verifactu-xml.js";
