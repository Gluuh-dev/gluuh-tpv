// Tres informes que el catálogo daba por imposibles y no lo son: el dato ya está
// en el esquema desde hace tiempo.
//
//  · Alérgenos      → `product.alergenos text[]` (0016), con 110 productos rellenos
//  · Asistencia     → `shift(user_id, entrada, salida)` (0001)
//  · No-venta       → `sales_order.tipo_operacion` + `motivo_no_venta` (0001)

// ── Alérgenos ───────────────────────────────────────────────────────────────
// Informe con consecuencias legales: en España la información de alérgenos de
// los 14 del reglamento UE 1169/2011 es obligatoria y la inspección la pide.

export const ALERGENOS_UE = [
  "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos",
  "Frutos de cáscara", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos",
] as const;

export interface FilaAlergeno {
  nombre: string; familia: string; alergenos: string[];
  /** false = la ficha está vacía. NO quiere decir «no tiene alérgenos». */
  declarado: boolean;
}

/**
 * OJO con el hueco: en la base, `alergenos` es `text[] NOT NULL DEFAULT '{}'`, así
 * que un array vacío puede significar dos cosas MUY distintas — «este plato no
 * lleva ninguno de los 14» o «nadie ha rellenado la ficha todavía» — y no hay
 * forma de distinguirlas. Ante la duda se dice SIN DECLARAR, que es lo único
 * honesto: decirle a un bar que su plato no tiene alérgenos cuando nadie lo ha
 * mirado es el error caro de este informe.
 */
export function alergenosDe(
  articulos: readonly { nombre: string; familia: string }[],
  fichas: Readonly<Record<string, readonly string[]>>,
): FilaAlergeno[] {
  return articulos.map((a) => {
    const lista = fichas[a.nombre] ?? [];
    return { nombre: a.nombre, familia: a.familia, alergenos: [...lista], declarado: lista.length > 0 };
  });
}

export const sinDeclarar = (filas: readonly FilaAlergeno[]): number =>
  filas.filter((f) => !f.declarado).length;

// ── Asistencia ──────────────────────────────────────────────────────────────

export interface Fichaje {
  operario: string;
  /** ISO local, «2026-07-20T08:02». */
  entrada: string;
  /** null = turno todavía abierto (aún no ha salido). */
  salida: string | null;
}

/**
 * Horas trabajadas de un fichaje, o null si sigue abierto.
 *
 * Un turno abierto NO son cero horas: es que aún no ha salido. Contarlo como 0
 * hunde la media del mes de quien está trabajando ahora mismo.
 *
 * Y cruza medianoche: en hostelería lo normal es entrar a las 20:00 y salir a
 * las 02:30. Restando en crudo eso da −17,5 h.
 */
export function horasDe(f: Fichaje): number | null {
  if (!f.salida) return null;
  const e = Date.parse(f.entrada), s = Date.parse(f.salida);
  if (Number.isNaN(e) || Number.isNaN(s)) return null;
  const ms = s - e;
  const horas = (ms < 0 ? ms + 24 * 3600_000 : ms) / 3600_000;
  return Math.round(horas * 100) / 100;
}

export interface ResumenAsistencia { operario: string; turnos: number; horas: number; abiertos: number }

export function asistenciaDe(fichajes: readonly Fichaje[]): ResumenAsistencia[] {
  const m = new Map<string, ResumenAsistencia>();
  for (const f of fichajes) {
    const r = m.get(f.operario) ?? { operario: f.operario, turnos: 0, horas: 0, abiertos: 0 };
    const h = horasDe(f);
    r.turnos += 1;
    if (h === null) r.abiertos += 1; else r.horas = Math.round((r.horas + h) * 100) / 100;
    m.set(f.operario, r);
  }
  return [...m.values()].sort((a, b) => b.horas - a.horas);
}

// ── Operaciones que NO son venta ────────────────────────────────────────────

export type TipoNoVenta = "INVITACION" | "AUTOCONSUMO" | "MERMA" | "FORMACION";

export interface NoVenta {
  tipo: TipoNoVenta; concepto: string; operario: string; motivo: string;
  /** Lo que habría costado a PVP. Sirve para medir el agujero, no para sumar. */
  importe: number;
}

export const ETIQUETA_NO_VENTA: Record<TipoNoVenta, string> = {
  INVITACION: "Invitación", AUTOCONSUMO: "Autoconsumo", MERMA: "Merma", FORMACION: "Formación",
};

/**
 * Lo que se ha ido sin cobrar, por tipo.
 *
 * INVARIANTE: esto NO suma a las ventas — lo dice la propia jornada del nodo
 * («Invitaciones y autoconsumo NO son venta y no pueden sumar al total»). Se
 * enseña aparte porque es justo lo que el dueño quiere vigilar, pero meterlo en
 * la caja descuadraría el arqueo y, peor, el libro de facturación.
 */
export function porTipoNoVenta(filas: readonly NoVenta[]): { tipo: TipoNoVenta; n: number; importe: number }[] {
  const m = new Map<TipoNoVenta, { tipo: TipoNoVenta; n: number; importe: number }>();
  for (const f of filas) {
    const r = m.get(f.tipo) ?? { tipo: f.tipo, n: 0, importe: 0 };
    r.n += 1; r.importe = Math.round((r.importe + f.importe) * 100) / 100;
    m.set(f.tipo, r);
  }
  return [...m.values()].sort((a, b) => b.importe - a.importe);
}
