"use client";

// Modal MESA (fiel a docs/diseño/gluuh-mesa.html): "Pasar el ticket a una mesa" con el
// PLANO real (salas + mesas por posición), leyenda, zoom y panel "Mesa elegida". Reusa los
// datos reales de mesas/salas del TPV; al asignar llama a pasarAMesa (misma lógica de antes).
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Info } from "lucide-react";
import { eur } from "@/app/lib/money";
import type { Mesa } from "../hooks/useTpvStore";
import { ModalTPV } from "./ModalTPV";

interface Room { id: string; nombre: string }

// Lienzo virtual (igual criterio que PlanoSalas) escalado para caber.
const LIENZO = { w: 800, h: 600 };
const sizeMesa = (cap: number) => (cap <= 2 ? { w: 66, h: 60 } : cap <= 4 ? { w: 92, h: 72 } : { w: 128, h: 84 });

export function MesaModal({
  mesas, rooms, totalesMesa, reservasPorMesa, mesaActualId, artics, total, busy, onAsignar, onClose,
}: Readonly<{
  mesas: Mesa[]; rooms: Room[]; totalesMesa: Record<string, number>;
  reservasPorMesa: Record<string, unknown[]>; mesaActualId: string | null;
  artics: number; total: number; busy: boolean;
  onAsignar: (m: Mesa) => void; onClose: () => void;
}>) {
  const [sala, setSala] = useState<string>(rooms[0]?.id ?? "");
  const [selId, setSelId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const delSala = useMemo(() => mesas.filter((m) => m.room_id === sala), [mesas, sala]);
  const sel = mesas.find((m) => m.id === selId) ?? null;

  const estadoDe = (m: Mesa): { k: string; cls: string } => {
    if (m.id === mesaActualId) return { k: "Tuya", cls: "border-brand bg-brand/15 text-brand" };
    if ((reservasPorMesa[m.id]?.length ?? 0) > 0) return { k: "Reservada", cls: "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400" };
    if (m.estado === "POR_COBRAR") return { k: "Por cobrar", cls: "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" };
    if (m.estado === "OCUPADA") return { k: "Ocupada", cls: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-500" };
    return { k: "Libre", cls: "border-border bg-background text-foreground hover:bg-accent" };
  };

  const primeraLibre = () => {
    const libre = delSala.find((m) => m.estado === "LIBRE" && (reservasPorMesa[m.id]?.length ?? 0) === 0)
      ?? mesas.find((m) => m.estado === "LIBRE" && (reservasPorMesa[m.id]?.length ?? 0) === 0);
    if (libre) { if (libre.room_id) setSala(libre.room_id); setSelId(libre.id); }
  };

  return (
    <ModalTPV
      titulo="Pasar el ticket a una mesa"
      subtitulo={`${artics} artículo${artics === 1 ? "" : "s"}`}
      ancho={980}
      alto={660}
      onClose={onClose}
      derecha={<div className="text-right"><div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ticket</div><b className="text-lg tabular-nums">{eur(total)}</b></div>}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px] gap-3 p-3">
          {/* ── Izquierda: salas + plano + leyenda ── */}
          <div className="flex min-h-0 flex-col gap-2">
            {/* Pestañas de sala */}
            <div className="flex flex-none flex-wrap gap-1.5">
              {rooms.map((r) => (
                <button key={r.id} type="button" onClick={() => { setSala(r.id); setSelId(null); }}
                  className={`h-9 rounded-md border px-3 text-xs font-bold ${sala === r.id ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>{r.nombre}</button>
              ))}
              {rooms.length === 0 && <span className="text-sm text-muted-foreground">No hay salas configuradas.</span>}
            </div>

            {/* Plano */}
            <section className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
              <div className="absolute inset-0 overflow-auto p-3">
                <div className="relative origin-top-left" style={{ width: LIENZO.w * zoom, height: LIENZO.h * zoom }}>
                  {delSala.map((m) => {
                    const s = estadoDe(m);
                    const sz = sizeMesa(m.capacidad || 4);
                    const x = (m.pos_x ?? 80) * zoom, y = (m.pos_y ?? 80) * zoom;
                    return (
                      <button key={m.id} type="button" onClick={() => setSelId(m.id)}
                        style={{ left: x, top: y, width: sz.w * zoom, height: sz.h * zoom }}
                        className={`absolute flex flex-col items-center justify-center rounded-lg border-2 text-xs font-bold transition-all ${s.cls} ${selId === m.id ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""}`}>
                        <span className="text-sm">{m.nombre}</span>
                        <span className="text-[9px] font-semibold opacity-70">{m.capacidad || 4} pax{totalesMesa[m.id] ? ` · ${eur(totalesMesa[m.id]!)}` : ""}</span>
                      </button>
                    );
                  })}
                  {delSala.length === 0 && <p className="p-6 text-sm text-muted-foreground">Esta sala no tiene mesas.</p>}
                </div>
              </div>
              {/* Zoom */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-border bg-card/90 p-1 shadow">
                <button type="button" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="grid h-7 w-7 place-items-center rounded hover:bg-accent"><Minus size={15} /></button>
                <span className="w-9 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} className="grid h-7 w-7 place-items-center rounded hover:bg-accent"><Plus size={15} /></button>
              </div>
            </section>

            {/* Leyenda */}
            <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <Leyenda c="border-border bg-background" t="Libre" />
              <Leyenda c="border-brand bg-brand/30" t="Tuya" />
              <Leyenda c="border-amber-500 bg-amber-500/40" t="Ocupada" />
              <Leyenda c="border-yellow-500 bg-yellow-500/40" t="Por cobrar" />
              <Leyenda c="border-sky-500 bg-sky-500/40" t="Reservada" />
            </div>
          </div>

          {/* ── Derecha: mesa elegida ── */}
          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
            <h3 className="flex-none border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mesa elegida</h3>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {sel ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-black">{sel.nombre}</div>
                    <div className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${estadoDe(sel).cls}`}>{estadoDe(sel).k}</div>
                  </div>
                  <Dato l="Capacidad" v={`${sel.capacidad || 4} pax`} />
                  <Dato l="Cuenta actual" v={totalesMesa[sel.id] ? eur(totalesMesa[sel.id]!) : "—"} />
                  <Dato l="Sala" v={rooms.find((r) => r.id === sel.room_id)?.nombre ?? "—"} />
                  {(sel.estado === "OCUPADA" || sel.estado === "POR_COBRAR") && sel.id !== mesaActualId && (
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-500">La mesa está ocupada: el ticket se sumará a su cuenta.</p>
                  )}
                </div>
              ) : (
                <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                  <div><b className="mb-1 block text-foreground">Ninguna mesa elegida</b>Toca una mesa del plano.</div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-none items-center gap-2 border-t border-border bg-surface px-3 py-2.5">
          <button type="button" onClick={primeraLibre} className="flex h-11 items-center gap-2 rounded-md border border-brand/40 bg-brand/10 px-4 text-sm font-bold text-brand hover:bg-brand/20"><Check size={17} /> Primera libre</button>
          <span className="ml-1 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Info size={14} /> Toca la mesa donde se sientan.</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent"><ArrowLeft size={16} /> Cancelar</button>
            <button type="button" onClick={() => sel && onAsignar(sel)} disabled={!sel || busy} className="flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-bold text-brand-foreground hover:bg-brand-hover disabled:opacity-40"><Check size={17} /> Asignar</button>
          </div>
        </div>
      </div>
    </ModalTPV>
  );
}

function Leyenda({ c, t }: Readonly<{ c: string; t: string }>) {
  return <span className="inline-flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded border-2 ${c}`} />{t}</span>;
}
function Dato({ l, v }: Readonly<{ l: string; v: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-muted py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</span>
      <span className="text-sm font-medium">{v}</span>
    </div>
  );
}
