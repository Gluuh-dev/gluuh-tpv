"use client";

// CERRAR EL DÍA — el Z de toda la vida.
//
// El encargado le da al terminar la noche: ve lo que se ha hecho, cuenta la caja y cierra.
//
// DOS COSAS QUE ESTA PANTALLA TIENE QUE DECIR, Y QUE NO SE PUEDEN ESCONDER:
//
//   1. Las MESAS QUE QUEDAN ABIERTAS. Se enseñan y el encargado decide: cobrarlas, anularlas
//      o cerrar igual. Si cierra igual, **siguen abiertas** y su venta contará en la jornada
//      en la que se cobren de verdad. No se cobran ni se anulan solas: con VERIFACTU
//      delante, fabricar un cobro que nadie ha confirmado es firmar ante Hacienda algo que
//      no ha pasado.
//
//   2. La DIFERENCIA DE CAJA. Se pide el recuento del efectivo y se compara con lo que dice
//      el sistema. Si no cuadra, se ve AQUÍ y AHORA — que es el único momento en que alguien
//      puede acordarse de por qué. Un descuadre que aparece el lunes en un informe ya no se
//      reconstruye.

import * as React from "react";
import { X, AlertTriangle, Coins } from "lucide-react";
import { eur } from "@/app/lib/money";

export interface Z {
  tickets: number;
  total: number | string;
  ticket_medio: number | string;
  invitaciones: number | string;
  autoconsumo: number | string;
  anuladas: number;
  facturas: number;
  abiertas: number;
  por_metodo: { metodo: string; importe: number | string; propina: number | string }[];
  impuestos: { tipo: number | string; base: number | string; cuota: number | string }[];
}

interface Props {
  jornada: { numero: number; abierta_en: string };
  z: Z;
  onCerrar: (contado: number | null) => Promise<void>;
  onCancelar: () => void;
  /** Solo mostrar el Z del turno en marcha (Utilidades → Resumen de caja): sin
   *  arqueo ni cierre. La misma pantalla, en modo consulta. */
  soloLectura?: boolean;
}

export function CerrarDiaModal({ jornada, z, onCerrar, onCancelar, soloLectura = false }: Readonly<Props>) {
  const [contado, setContado] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const efectivo = Number(
    z.por_metodo.find((p) => p.metodo === "EFECTIVO")?.importe ?? 0,
  );
  const hayRecuento = contado.trim() !== "";
  const diferencia = hayRecuento ? Number(contado.replace(",", ".")) - efectivo : 0;

  async function confirmar() {
    if (busy) return;
    setBusy(true);
    try {
      await onCerrar(hayRecuento ? Number(contado.replace(",", ".")) : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4" onClick={onCancelar}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{soloLectura ? "Resumen de caja" : "Cerrar día"}</h2>
            <p className="text-xs text-muted-foreground">
              Jornada nº {jornada.numero} · abierta el{" "}
              {new Date(jornada.abierta_en).toLocaleString("es-ES", {
                weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
          <button type="button" onClick={onCancelar} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-4">
          {/* ── Lo que se ha hecho ── */}
          <section className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-border p-3">
              <p className="text-2xl font-bold tabular-nums">{z.tickets}</p>
              <p className="text-xs text-muted-foreground">tickets</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-2xl font-bold tabular-nums">{eur(Number(z.total))}</p>
              <p className="text-xs text-muted-foreground">cobrado</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-2xl font-bold tabular-nums">{eur(Number(z.ticket_medio))}</p>
              <p className="text-xs text-muted-foreground">ticket medio</p>
            </div>
          </section>

          {/* ── Por método ── */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Formas de pago
            </h3>
            <div className="space-y-1 text-sm">
              {z.por_metodo.length === 0 && <p className="text-muted-foreground">No se ha cobrado nada.</p>}
              {z.por_metodo.map((p) => (
                <div key={p.metodo} className="flex justify-between">
                  <span>{p.metodo}</span>
                  <span className="tabular-nums">
                    {eur(Number(p.importe))}
                    {Number(p.propina) > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (+{eur(Number(p.propina))} propina)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Impuestos ── */}
          {z.impuestos.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Impuestos
              </h3>
              <div className="space-y-1 text-sm">
                {z.impuestos.map((i) => (
                  <div key={String(i.tipo)} className="flex justify-between">
                    <span>{Number(i.tipo)}% · base {eur(Number(i.base))}</span>
                    <span className="tabular-nums">{eur(Number(i.cuota))}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Lo que no es venta, pero el dueño quiere ver ── */}
          {(Number(z.invitaciones) > 0 || Number(z.autoconsumo) > 0 || z.anuladas > 0) && (
            <section className="rounded-lg bg-muted/40 p-3 text-sm">
              {Number(z.invitaciones) > 0 && (
                <div className="flex justify-between"><span>Invitaciones</span><span className="tabular-nums">{eur(Number(z.invitaciones))}</span></div>
              )}
              {Number(z.autoconsumo) > 0 && (
                <div className="flex justify-between"><span>Consumo propio</span><span className="tabular-nums">{eur(Number(z.autoconsumo))}</span></div>
              )}
              {z.anuladas > 0 && (
                <div className="flex justify-between"><span>Anuladas</span><span className="tabular-nums">{z.anuladas}</span></div>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">No suman al cobrado.</p>
            </section>
          )}

          {/* ── ★ LAS MESAS ABIERTAS ── */}
          {z.abiertas > 0 && (
            <section className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium text-amber-200">
                  Quedan {z.abiertas} mesa(s) abierta(s).
                </p>
                <p className="mt-1 text-xs text-amber-300/80">
                  Si cierras igual, <strong>siguen abiertas</strong> y lo que se cobre de ellas
                  contará en la jornada de mañana. No se cobran ni se anulan solas.
                </p>
              </div>
            </section>
          )}

          {/* ── ★ EL ARQUEO ── */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Coins className="h-3.5 w-3.5" /> {soloLectura ? "Efectivo en caja" : "Arqueo de caja"}
            </h3>
            {soloLectura ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Debería haber</span>
                <span className="text-lg font-semibold tabular-nums">{eur(efectivo)}</span>
              </div>
            ) : (
            <>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label htmlFor="contado" className="text-xs text-muted-foreground">
                  Efectivo contado
                </label>
                <input
                  id="contado"
                  type="text"
                  inputMode="decimal"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                  placeholder={efectivo.toFixed(2)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-lg tabular-nums"
                />
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs text-muted-foreground">Debería haber</p>
                <p className="mt-1 py-2 text-lg font-semibold tabular-nums">{eur(efectivo)}</p>
              </div>
            </div>

            {hayRecuento && (
              <p
                className={`mt-2 text-sm font-medium ${
                  Math.abs(diferencia) < 0.005
                    ? "text-emerald-500"
                    : diferencia > 0 ? "text-sky-400" : "text-rose-400"
                }`}
              >
                {Math.abs(diferencia) < 0.005
                  ? "Cuadra."
                  : `${diferencia > 0 ? "Sobran" : "Faltan"} ${eur(Math.abs(diferencia))}.`}
              </p>
            )}
            </>
            )}
          </section>
        </div>

        <footer className="flex gap-2 border-t border-border px-5 py-4">
          {soloLectura ? (
            <button type="button" onClick={onCancelar} className="flex-1 rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground">
              Volver
            </button>
          ) : (
            <>
              <button type="button" onClick={onCancelar} className="btn-ghost flex-1" disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={busy}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Cerrando…" : "Cerrar el día"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
