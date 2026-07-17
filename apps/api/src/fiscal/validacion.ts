// Validación de entrada del motor fiscal (puro, testeable).
//
// Los endpoints /fiscal/* aceptaban el body tal cual (`@Body() dto`) sin ninguna
// comprobación: un cuerpo con basura podía llegar al cálculo de impuestos y, en
// /fiscal/enviar, a una remisión REAL a la AEAT. Aquí se valida antes de tocar nada.
//
// Sin class-validator a propósito: son ~30 líneas y evitan 2 dependencias nuevas.

/** Territorios que entiende el motor fiscal (packages/core, domain/types.ts). */
export const TERRITORIOS = ["PENINSULA_BALEARES", "CANARIAS", "CEUTA_MELILLA"] as const;

const MAX_LINEAS = 1000;

/** Mensaje del primer fallo, o null si el DTO es válido. */
export function validarPreviewDto(dto: unknown): string | null {
  if (!dto || typeof dto !== "object") return "Cuerpo inválido";
  const d = dto as Record<string, unknown>;

  if (!Array.isArray(d.lineas) || d.lineas.length === 0) return "lineas: requerido y no vacío";
  if (d.lineas.length > MAX_LINEAS) return `lineas: máximo ${MAX_LINEAS}`;
  for (const l of d.lineas as unknown[]) {
    if (!l || typeof l !== "object") return "lineas: cada línea debe ser un objeto";
    const { importe, tipo } = l as { importe?: unknown; tipo?: unknown };
    if (typeof importe !== "number" || !Number.isFinite(importe)) return "lineas.importe: número finito requerido";
    if (typeof tipo !== "number" || !Number.isFinite(tipo)) return "lineas.tipo: número finito requerido";
    if (importe < 0) return "lineas.importe: no puede ser negativo";
    if (tipo < 0 || tipo > 100) return "lineas.tipo: fuera de rango (0-100)";
  }

  if (typeof d.territorio !== "string" || !(TERRITORIOS as readonly string[]).includes(d.territorio)) {
    return `territorio: uno de ${TERRITORIOS.join(", ")}`;
  }
  if (typeof d.nif !== "string" || !/^[A-Z0-9]{8,12}$/i.test(d.nif)) return "nif: inválido";
  if (typeof d.numSerieFactura !== "string" || !d.numSerieFactura.trim()) return "numSerieFactura: requerido";
  if (typeof d.fechaExpedicion !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(d.fechaExpedicion)) {
    return "fechaExpedicion: formato dd-mm-aaaa";
  }
  if (typeof d.fechaHoraHusoGenRegistro !== "string" || !d.fechaHoraHusoGenRegistro.trim()) {
    return "fechaHoraHusoGenRegistro: requerido";
  }
  if (d.tipoFactura !== undefined && d.tipoFactura !== "F1" && d.tipoFactura !== "F2") {
    return "tipoFactura: F1 o F2";
  }
  return null;
}
