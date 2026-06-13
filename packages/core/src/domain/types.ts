/**
 * Tipos de dominio del TPV. Compartidos por todas las plataformas.
 * Mantener alineados con el esquema de BD (apps/api/db/schema.sql) y con docs/06.
 */

/** Identificadores como UUID (string). */
export type UUID = string;

/** Territorio fiscal del local — determina el impuesto aplicable. */
export type Territorio = "PENINSULA_BALEARES" | "CANARIAS" | "CEUTA_MELILLA";

/** Régimen de consumo (afecta al tipo impositivo en hostelería). */
export type RegimenConsumo = "LOCAL" | "PARA_LLEVAR";

/** Roles de usuario (ver docs/12 §3). */
export type Rol =
  | "ADMIN_PLATAFORMA"
  | "PROPIETARIO"
  | "ENCARGADO"
  | "CAMARERO"
  | "COCINA";

/** Tipo de factura según la nomenclatura AEAT/VERIFACTU. */
export type TipoFactura =
  | "F1" // factura completa
  | "F2" // factura simplificada (ticket)
  | "F3" // factura en sustitución de simplificadas
  | "R1" // rectificativa (error fundado en derecho)
  | "R2"
  | "R3"
  | "R4"
  | "R5"; // rectificativa en facturas simplificadas

export interface Categoria {
  id: UUID;
  tenantId: UUID;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: UUID;
  tenantId: UUID;
  categoriaId: UUID;
  nombre: string;
  /** Precio de venta al público (impuesto INCLUIDO), en euros. */
  precio: number;
  /** Tipo impositivo aplicable en % (p. ej. 10 IVA hostelería, 7 IGIC). */
  tipoImpositivo: number;
  /** Estación de cocina/barra a la que se enruta (ver docs/10). */
  estacion?: string;
  alergenos?: string[];
  disponible: boolean;
}

export interface LineaComanda {
  id: UUID;
  productoId: UUID;
  nombre: string;
  cantidad: number;
  /** PVP unitario (impuesto incluido). */
  precioUnitario: number;
  tipoImpositivo: number;
  modificadores?: string[];
  notas?: string;
  /** Pase/curso (1 entrantes, 2 principales, 3 postres). */
  pase?: number;
}

export interface Comanda {
  id: UUID;
  tenantId: UUID;
  locationId: UUID;
  mesaId?: UUID;
  camareroId: UUID;
  estado: import("./order-state.js").EstadoComanda;
  lineas: LineaComanda[];
  /** UUID generado en el cliente para idempotencia de sync (ver docs/06 §4.5). */
  clientId: UUID;
  creadaEn: string; // ISO 8601
}

export interface LineaImpuesto {
  /** Tipo impositivo en %. */
  tipo: number;
  base: number;
  cuota: number;
}

export interface Factura {
  id: UUID;
  tenantId: UUID;
  locationId: UUID;
  serie: string;
  numero: number;
  tipo: TipoFactura;
  comandaId: UUID;
  baseTotal: number;
  cuotaTotal: number;
  importeTotal: number;
  lineasImpuesto: LineaImpuesto[];
  fechaExpedicion: string; // dd-mm-aaaa
}
