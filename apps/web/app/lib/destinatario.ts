/**
 * Destinatario de la factura → decide si es COMPLETA (F1) o SIMPLIFICADA (F2).
 *
 * Regla AEAT: la factura completa exige un destinatario identificado con NIF.
 * Sin NIF solo cabe la simplificada (el ticket de toda la vida).
 *
 * Vive aparte de la ruta para poder probarse: es una decisión fiscal.
 */

export interface ClienteFactura {
  nif: string | null;
  nombre: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  poblacion: string | null;
  provincia: string | null;
}

export interface Destinatario {
  /** Código AEAT: F1 = completa (con destinatario) · F2 = simplificada. */
  tipoFactura: "F1" | "F2";
  destNif: string | null;
  destNombre: string | null;
  destDomicilio: string | null;
}

const SIMPLIFICADA: Destinatario = {
  tipoFactura: "F2",
  destNif: null,
  destNombre: null,
  destDomicilio: null,
};

export function resolverDestinatario(cli: ClienteFactura | null | undefined): Destinatario {
  const nif = cli?.nif?.trim().toUpperCase();
  if (!nif) return SIMPLIFICADA;

  const domicilio =
    [cli?.direccion, cli?.codigo_postal, cli?.poblacion, cli?.provincia]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", ") || null;

  return {
    tipoFactura: "F1",
    destNif: nif,
    destNombre: cli?.nombre?.trim() || null,
    destDomicilio: domicilio,
  };
}
