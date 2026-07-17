"use client";

// Modal MESA (fiel a docs/diseño/gluuh-mesa.html): "Pasar el ticket a una mesa" con el
// PLANO real (salas + mesas por posición), leyenda, zoom y panel "Mesa elegida". Reusa los
// datos reales de mesas/salas del TPV; al asignar llama a pasarAMesa (misma lógica de antes).
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Maximize, Minus, Plus, Info } from "lucide-react";
import { eur } from "@/app/lib/money";
import type { Mesa } from "../hooks/useTpvStore";
import { ModalTPV } from "./ModalTPV";
import { PlanoMesasSimplificado } from "./PlanoMesasSimplificado";

interface Room { id: string; nombre: string }
interface Elemento {
  id: string;
  room_id: string;
  tipo: string;
  icono: string | null;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  rotacion: number;
}

// Lienzo virtual compartido con PlanoSalas: el selector enseña la sala real,
// no una aproximación con tarjetas rectangulares.
const LIENZO = { w: 800, h: 600 };

export function MesaModal({
  mesas, rooms, elementos, totalesMesa, reservasPorMesa, mesaActualId, artics, total, busy, onAsignar, onClose,
}: Readonly<{
  mesas: Mesa[]; rooms: Room[]; elementos: Elemento[]; totalesMesa: Record<string, number>;
  reservasPorMesa: Record<string, unknown[]>; mesaActualId: string | null;
  artics: number; total: number; busy: boolean;
  onAsignar: (m: Mesa) => void; onClose: () => void;
}>) {
  const [sala, setSala] = useState<string>(rooms[0]?.id ?? "");
  const [selId, setSelId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [arrastrandoPlano, setArrastrandoPlano] = useState(false);
  const visorPlanoRef = useRef<HTMLDivElement | null>(null);
  const arrastrePlanoRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const delSala = useMemo(() => mesas.filter((m) => m.room_id === sala), [mesas, sala]);
  const separacionesSala = useMemo(() => elementos.filter((e) => e.room_id === sala), [elementos, sala]);
  const sel = mesas.find((m) => m.id === selId) ?? null;

  const estadoDe = (m: Mesa): { etiqueta: string; cls: string; color: string; borde: string; texto: string } => {
    if (m.id === mesaActualId) return { etiqueta: "Tuya", cls: "border-[#7c3d9b] bg-[#f3edf7] text-[#572370]", color: "#7c3d9b", borde: "#572370", texto: "#ffffff" };
    if ((reservasPorMesa[m.id]?.length ?? 0) > 0) return { etiqueta: "Reservada", cls: "border-[#38bdf8] bg-sky-50 text-sky-700", color: "#38bdf8", borde: "#0284c7", texto: "#1e2430" };
    if (m.estado === "POR_COBRAR") return { etiqueta: "Por cobrar", cls: "border-[#eab308] bg-yellow-50 text-yellow-800", color: "#eab308", borde: "#ca8a04", texto: "#1e2430" };
    if ((totalesMesa[m.id] ?? 0) > 0 || m.estado !== "LIBRE") return { etiqueta: "Ocupada", cls: "border-[#f5a623] bg-[#fdf1dc] text-[#9a6a12]", color: "#f5a623", borde: "#d97706", texto: "#1e2430" };
    return { etiqueta: "Libre", cls: "border-[#cfd5de] bg-white text-[#4a5262]", color: "#ffffff", borde: "#cbd5e1", texto: "#1e2430" };
  };

  function ajustarPlano() {
    const visor = visorPlanoRef.current;
    if (!visor) return;
    const zoomAjustado = Math.max(0.5, Math.min(1.4, (visor.clientWidth - 24) / LIENZO.w));
    setZoom(zoomAjustado);
    requestAnimationFrame(() => visor.scrollTo({ left: 0, top: 0 }));
  }

  useEffect(() => {
    const visor = visorPlanoRef.current;
    if (!visor) return;
    const frame = requestAnimationFrame(ajustarPlano);
    const observador = new ResizeObserver(ajustarPlano);
    observador.observe(visor);
    return () => { cancelAnimationFrame(frame); observador.disconnect(); };
    // Se reajusta al montar el modal, cambiar de sala o redimensionar su ventana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala]);

  const primeraLibre = () => {
    const libre = delSala.find((m) => m.estado === "LIBRE" && (reservasPorMesa[m.id]?.length ?? 0) === 0)
      ?? mesas.find((m) => m.estado === "LIBRE" && (reservasPorMesa[m.id]?.length ?? 0) === 0);
    if (libre) { if (libre.room_id) setSala(libre.room_id); setSelId(libre.id); }
  };

  function cambiarSala(id: string) {
    setSala(id);
    setSelId(null);
    requestAnimationFrame(() => visorPlanoRef.current?.scrollTo({ left: 0, top: 0 }));
  }

  function iniciarArrastrePlano(evento: React.PointerEvent<HTMLDivElement>) {
    if (evento.target instanceof Element && evento.target.closest("button")) return;
    const visor = visorPlanoRef.current;
    if (!visor) return;
    arrastrePlanoRef.current = { x: evento.clientX, y: evento.clientY, left: visor.scrollLeft, top: visor.scrollTop };
    evento.currentTarget.setPointerCapture(evento.pointerId);
    setArrastrandoPlano(true);
  }

  function moverPlano(evento: React.PointerEvent<HTMLDivElement>) {
    const arrastre = arrastrePlanoRef.current;
    const visor = visorPlanoRef.current;
    if (!arrastre || !visor) return;
    visor.scrollLeft = arrastre.left - (evento.clientX - arrastre.x);
    visor.scrollTop = arrastre.top - (evento.clientY - arrastre.y);
  }

  function terminarArrastrePlano(evento: React.PointerEvent<HTMLDivElement>) {
    if (!arrastrePlanoRef.current) return;
    arrastrePlanoRef.current = null;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId);
    setArrastrandoPlano(false);
  }

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
                <button key={r.id} type="button" onClick={() => cambiarSala(r.id)}
                  className={`h-9 rounded-md border px-3 text-xs font-bold ${sala === r.id ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>{r.nombre}</button>
              ))}
              {rooms.length === 0 && <span className="text-sm text-muted-foreground">No hay salas configuradas.</span>}
            </div>

            {/* Plano */}
            <section className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
              <div
                ref={visorPlanoRef}
                onPointerDown={iniciarArrastrePlano}
                onPointerMove={moverPlano}
                onPointerUp={terminarArrastrePlano}
                onPointerCancel={terminarArrastrePlano}
                className={`absolute inset-0 overflow-auto p-3 touch-none select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${arrastrandoPlano ? "cursor-grabbing" : "cursor-grab"}`}
              >
                <div className="relative origin-top-left" style={{ width: LIENZO.w * zoom, height: LIENZO.h * zoom }}>
                  <PlanoMesasSimplificado mesas={delSala} separaciones={separacionesSala} zoom={zoom} mesaSeleccionadaId={selId} estadoDe={estadoDe} onSeleccionar={setSelId} />
                  {delSala.length === 0 && <p className="grid h-full place-items-center text-sm text-muted-foreground">Esta sala no tiene mesas.</p>}
                </div>
              </div>
              {/* Zoom */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-border bg-card/90 p-1 shadow">
                <button type="button" aria-label="Ajustar plano" title="Ajustar plano" onClick={ajustarPlano} className="grid h-7 w-7 place-items-center rounded hover:bg-accent"><Maximize size={14} /></button>
                <button type="button" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="grid h-7 w-7 place-items-center rounded hover:bg-accent"><Minus size={15} /></button>
                <span className="w-9 text-center text-[11px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} className="grid h-7 w-7 place-items-center rounded hover:bg-accent"><Plus size={15} /></button>
              </div>
            </section>

            {/* Leyenda */}
            <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <Leyenda c="border-[#cfd5de] bg-white" t="Libre" />
              <Leyenda c="border-[#7c3d9b] bg-[#7c3d9b]" t="Tuya" />
              <Leyenda c="border-[#f5a623] bg-[#f5a623]" t="Ocupada" />
              <Leyenda c="border-[#eab308] bg-[#eab308]" t="Por cobrar" />
              <Leyenda c="border-[#38bdf8] bg-[#38bdf8]" t="Reservada" />
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
                    <div className={`mt-1 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${estadoDe(sel).cls}`}>{estadoDe(sel).etiqueta}</div>
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
          <span className="ml-1 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Info size={14} /> Arrastra para mover, toca para seleccionar y usa ⛶ para encajar.</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent">Cancelar</button>
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
