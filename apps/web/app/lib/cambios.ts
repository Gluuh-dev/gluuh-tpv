"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  EL ÚNICO PUNTO DE LA APP QUE ESCUCHA CAMBIOS DE LA BASE DE DATOS.
//
//  HOY   → Supabase Realtime (la nube).
//  MAÑANA → en el NODO LOCAL será el WebSocket propio del servidor (Postgres
//           LISTEN/NOTIFY), porque el Realtime de Supabase está escrito en Elixir
//           y no corre nativo en Windows. Ver docs/plan/10 §3.1.
//
//  Ese cambio ocurrirá SOLO AQUÍ. Las pantallas (TPV, cocina, pantalla de cliente,
//  despachador de impresión) no se enteran de cuál es el backend: piden "avísame
//  cuando cambien estas tablas" y ya.
//
//  Antes esto estaba copiado en 5 sitios, cada uno con su propio debounce a mano.
// ─────────────────────────────────────────────────────────────────────────────
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type EventoCambio = "*" | "INSERT" | "UPDATE" | "DELETE";

/** Un cambio recibido. `fila` = la fila nueva (INSERT/UPDATE) o la borrada (DELETE). */
export interface Cambio {
  tabla: string;
  evento: "INSERT" | "UPDATE" | "DELETE";
  fila: Record<string, unknown> | null;
}

export interface OpcionesEscucha {
  /** Nombre del canal. Único por pantalla. */
  nombre: string;
  /** Tablas a vigilar. */
  tablas: string[];
  /** Qué eventos escuchar. Por defecto, todos. */
  evento?: EventoCambio;
  /**
   * Agrupa ráfagas: espera N ms de silencio antes de avisar. Una comanda dispara
   * varios eventos seguidos (pedido + líneas + pago); sin esto se recargaría N veces.
   *
   * OJO: con debounce, el `Cambio` que llega es el ÚLTIMO de la ráfaga. Úsalo solo
   * si el callback ignora la fila (el caso de "algo cambió → recarga"). Si necesitas
   * CADA fila (p. ej. el despachador de impresión), deja `debounceMs` a 0.
   */
  debounceMs?: number;
  onCambio: (c: Cambio) => void;
}

/**
 * Escucha cambios de N tablas. Devuelve la función para DEJAR de escuchar
 * (llamarla en el cleanup del efecto).
 */
/**
 * ¿Estamos contra el NODO LOCAL en vez de contra Supabase?
 *
 * El nodo no puede correr el Realtime de Supabase (Elixir, no nativo en Windows), así
 * que trae el suyo: Postgres LISTEN/NOTIFY servido por SSE. Cambia el transporte, no el
 * contrato: las pantallas siguen pidiendo "avísame cuando cambien estas tablas".
 */
const ES_NODO = process.env.NEXT_PUBLIC_NODO_LOCAL === "1";

/** Realtime del nodo: un flujo SSE con todos los cambios; aquí se filtra por tabla. */
function escucharPorSse(opts: OpcionesEscucha, avisar: (c: Cambio) => void): () => void {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/cambios`;
  const fuente = new EventSource(url);
  const quiere = new Set(opts.tablas);
  const evento = opts.evento ?? "*";

  fuente.onmessage = (m) => {
    const c = JSON.parse(m.data) as Cambio;
    if (!quiere.has(c.tabla)) return;
    if (evento !== "*" && c.evento !== evento) return;
    avisar(c);
  };

  // EventSource se reconecta SOLO (por eso SSE y no WebSocket): si se va el wifi de la
  // barra, el TPV vuelve a engancharse sin que nadie tenga que hacer nada.
  return () => fuente.close();
}

export function escucharCambios(sb: SupabaseClient, opts: OpcionesEscucha): () => void {
  const { nombre, tablas, evento = "*", debounceMs = 0, onCambio } = opts;

  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let pendiente: Cambio | null = null;

  const avisar = (c: Cambio) => {
    if (debounceMs <= 0) { onCambio(c); return; }
    pendiente = c;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const ultimo = pendiente;
      pendiente = null;
      if (ultimo) onCambio(ultimo);
    }, debounceMs);
  };

  if (ES_NODO) {
    const cerrar = escucharPorSse(opts, avisar);
    return () => {
      if (temporizador) clearTimeout(temporizador);
      cerrar();
    };
  }

  let canal: RealtimeChannel = sb.channel(nombre);
  for (const tabla of tablas) {
    canal = canal.on(
      "postgres_changes",
      { event: evento, schema: "public", table: tabla } as never,
      (payload: { eventType?: string; new?: unknown; old?: unknown }) => {
        avisar({
          tabla,
          evento: (payload.eventType ?? "UPDATE") as Cambio["evento"],
          fila: ((payload.new ?? payload.old) ?? null) as Record<string, unknown> | null,
        });
      },
    );
  }
  canal.subscribe();

  return () => {
    if (temporizador) clearTimeout(temporizador);
    void sb.removeChannel(canal);
  };
}
