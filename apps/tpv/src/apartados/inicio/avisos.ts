import { leer, haySesion } from "../../lib/nodo";

// ============================================================================
// AVISOS DEL TERMINAL — lo que va en la campana.
//
// Solo se generan avisos de cosas que se saben DE VERDAD. Una campana con un
// «impresora sin papel» inventado enseña a ignorar la campana: la primera vez
// que el aviso es falso, dejas de mirarla, y el día que hay uno de verdad
// (stock a cero de lo que más se vende) tampoco lo ves.
//
// Hoy la única fuente cableada de verdad es el STOCK (migración 0130). Las demás
// —impresora sin papel, sync pendiente— entran cuando su estado exista de
// verdad; el marco ya las admite.
// ============================================================================

export type TonoAviso = "info" | "aviso" | "urgente";

export interface Aviso {
  id: string;
  tono: TonoAviso;
  titulo: string;
  detalle: string;
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

/** Los avisos reales del terminal, o `[]` si no está emparejado. */
export async function cargarAvisos(): Promise<Aviso[]> {
  if (!haySesion()) return [];
  const avisos: Aviso[] = [];

  // ── Stock bajo mínimo (solo lo que controla stock y tiene mínimo puesto) ──
  const bajos = await leer<{ nombre: string; stock: number | string; stock_minimo: number | string | null }>(
    "product?select=nombre,stock,stock_minimo&controla_stock=is.true&stock_minimo=not.is.null",
  );
  for (const p of bajos ?? []) {
    const stock = num(p.stock);
    const min = num(p.stock_minimo);
    if (stock <= min) {
      avisos.push({
        id: `stock:${p.nombre}`,
        // A cero es urgente (no se puede vender); por debajo del mínimo, avisar.
        tono: stock <= 0 ? "urgente" : "aviso",
        titulo: stock <= 0 ? `Sin stock: ${p.nombre}` : `Queda poco: ${p.nombre}`,
        detalle: stock <= 0
          ? "No quedan existencias. Repón o ponlo como agotado."
          : `${stock} en almacén (mínimo ${min}).`,
      });
    }
  }

  // Los urgentes primero, que son los que hay que ver de un vistazo.
  const orden: Record<TonoAviso, number> = { urgente: 0, aviso: 1, info: 2 };
  return avisos.sort((a, b) => orden[a.tono] - orden[b.tono]);
}
