"use client";

// Modal DIVIDIR CUENTA (estilo Ágora): reparte las líneas/unidades de un ticket
// entre N documentos. PRESENTACIONAL: toda la lógica de reparto es LOCAL; al
// aceptar emite los documentos por callback. No toca fiscalidad (usa el precio
// unitario recibido solo para mostrar los subtotales por documento).
// Skill: gluuh-ux-operativa.
import { useMemo, useState } from "react";
import { Minus, Plus, ArrowRight, RotateCcw, Wand2, Hand } from "lucide-react";
import { eur } from "@/app/lib/money";

export interface LineaTicket {
  id: string;
  nombre: string;
  uds: number;
  /** Precio UNITARIO (impuesto incluido). Solo para mostrar subtotales. */
  precio: number;
}

export interface DividirCuentaModalProps {
  lineas: LineaTicket[];
  total: number;
  comensales?: number;
  onAceptar(docs: { lineas: { id: string; uds: number }[] }[]): void;
  onCobrarTodos(): void;
  onCancelar(): void;
  onAbrirCajon?(): void;
}


/** Reparto: para cada documento, unidades asignadas por id de línea. */
type Reparto = Record<string, number>[];

function repartoVacio(n: number): Reparto {
  return Array.from({ length: n }, () => ({}));
}

// Reparto automático: distribuye TODAS las unidades round-robin entre los N
// documentos, dejando los importes lo más igualados que permite la granularidad
// de las líneas. ponytail: reparto por unidades (no fracciona); si el negocio
// pide división exacta al céntimo, se cobra por "División automática" mostrando
// total÷N y se ajusta el último documento.
function repartirAutomatico(lineas: LineaTicket[], n: number): Reparto {
  const docs = repartoVacio(n);
  let cursor = 0;
  for (const l of lineas) {
    for (let u = 0; u < l.uds; u++) {
      const doc = docs[cursor % n]!;
      doc[l.id] = (doc[l.id] ?? 0) + 1;
      cursor++;
    }
  }
  return docs;
}

export function DividirCuentaModal({
  lineas,
  total,
  comensales,
  onAceptar,
  onCobrarTodos,
  onCancelar,
  onAbrirCajon,
}: DividirCuentaModalProps) {
  const [nDocs, setNDocs] = useState(() => Math.max(2, comensales ?? 2));
  const [reparto, setReparto] = useState<Reparto>(() => repartoVacio(Math.max(2, comensales ?? 2)));
  const [modo, setModo] = useState<"manual" | "automatica">("manual");
  const [docSel, setDocSel] = useState(0);
  const [lineaSel, setLineaSel] = useState<string | null>(null);
  const [udsMover, setUdsMover] = useState(1);

  const precioDe = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lineas) m[l.id] = l.precio;
    return m;
  }, [lineas]);
  const nombreDe = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lineas) m[l.id] = l.nombre;
    return m;
  }, [lineas]);

  // Unidades ya asignadas (en cualquier documento) por línea.
  const asignadas = useMemo(() => {
    const m: Record<string, number> = {};
    for (const doc of reparto) for (const [id, u] of Object.entries(doc)) m[id] = (m[id] ?? 0) + u;
    return m;
  }, [reparto]);

  // "Ticket Actual" = lo que queda por repartir.
  const pendientes = lineas
    .map((l) => ({ ...l, restantes: l.uds - (asignadas[l.id] ?? 0) }))
    .filter((l) => l.restantes > 0);
  const udsPendientes = pendientes.reduce((s, l) => s + l.restantes, 0);
  const totalPendiente = pendientes.reduce((s, l) => s + l.restantes * l.precio, 0);

  function totalDoc(doc: Record<string, number>) {
    return Object.entries(doc).reduce((s, [id, u]) => s + u * (precioDe[id] ?? 0), 0);
  }

  function cambiarNDocs(delta: number) {
    const n = Math.min(12, Math.max(2, nDocs + delta));
    if (n === nDocs) return;
    setNDocs(n);
    setReparto(repartoVacio(n)); // cambiar el nº de docs reinicia el reparto (evita casos borde)
    setDocSel((s) => Math.min(s, n - 1));
    setModo("manual");
  }

  function divisionAutomatica() {
    setReparto(repartirAutomatico(lineas, nDocs));
    setModo("automatica");
    setLineaSel(null);
  }

  function divisionManual() {
    setReparto(repartoVacio(nDocs));
    setModo("manual");
    setLineaSel(null);
  }

  // Traspasa `udsMover` unidades de la línea seleccionada (del pendiente) al doc activo.
  function traspasar() {
    if (!lineaSel) return;
    const pend = pendientes.find((l) => l.id === lineaSel);
    if (!pend) return;
    const mover = Math.min(udsMover, pend.restantes);
    if (mover <= 0) return;
    setReparto((prev) =>
      prev.map((doc, i) => (i === docSel ? { ...doc, [lineaSel]: (doc[lineaSel] ?? 0) + mover } : doc)),
    );
  }

  // Devuelve 1 unidad de una línea de un documento al pendiente.
  function devolverUnidad(docIdx: number, id: string) {
    setReparto((prev) =>
      prev.map((doc, i) => {
        if (i !== docIdx) return doc;
        const u = (doc[id] ?? 0) - 1;
        const next = { ...doc };
        if (u <= 0) delete next[id];
        else next[id] = u;
        return next;
      }),
    );
  }

  const todoAsignado = udsPendientes === 0;
  const importePorDoc = total / nDocs;

  function aceptar() {
    const docs = reparto
      .map((doc) => ({
        lineas: Object.entries(doc)
          .filter(([, u]) => u > 0)
          .map(([id, u]) => ({ id, uds: u })),
      }))
      .filter((d) => d.lineas.length > 0);
    onAceptar(docs);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Dividir cuenta"
    >
      {/* Cabecera */}
      <header className="flex flex-none items-center justify-between gap-4 border-b border-border bg-surface px-5 py-3">
        <div>
          <h2 className="text-xl font-bold">Dividir cuenta</h2>
          <p className="text-xs text-muted-foreground">
            Reparte líneas y unidades entre {nDocs} documentos · Automática = {eur(importePorDoc)} / doc
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-1.5 text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total ticket</div>
          <div className="text-2xl font-bold tabular-nums">{eur(total)}</div>
        </div>
      </header>

      {/* Cuerpo: documentos (centro) + ticket actual (derecha) */}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* Zona central: documentos */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Documentos
            {todoAsignado ? (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold normal-case text-success">
                Todo repartido
              </span>
            ) : (
              <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold normal-case text-warning">
                Quedan {udsPendientes} uds sin asignar
              </span>
            )}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 lg:grid-cols-3">
            {reparto.map((doc, i) => {
              const activo = i === docSel;
              const items = Object.entries(doc).filter(([, u]) => u > 0);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDocSel(i)}
                  className={`flex min-h-32 flex-col rounded-xl border-2 p-2.5 text-left transition-all active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activo ? "border-brand bg-brand/10 shadow-md" : "border-border bg-card hover:border-border-strong hover:bg-accent"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`text-sm font-bold ${activo ? "text-brand" : ""}`}>Doc {i + 1}</span>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-sm font-bold tabular-nums text-brand">{eur(totalDoc(doc))}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
                    {items.length === 0 && <span className="text-xs text-muted-foreground">Vacío</span>}
                    {items.map(([id, u]) => (
                      <span
                        key={id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          devolverUnidad(i, id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            devolverUnidad(i, id);
                          }
                        }}
                        className="flex items-center justify-between rounded px-1.5 py-1 text-xs transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Tocar para devolver 1 unidad al ticket"
                      >
                        <span className="truncate">
                          <b className="tabular-nums">{u}×</b> {nombreDe[id]}
                        </span>
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel derecho: Ticket Actual (pendiente de repartir) */}
        <aside className="flex w-72 flex-none flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ticket Actual</span>
            {udsPendientes > 0 && (
              <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {udsPendientes} uds
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pendientes.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">Todo repartido.</p>
            )}
            {pendientes.map((l) => {
              const sel = lineaSel === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLineaSel(l.id)}
                  aria-pressed={sel}
                  className={`mb-1 flex w-full min-h-12 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-all active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    sel ? "border-brand bg-brand/10" : "border-border bg-background hover:border-border-strong hover:bg-accent"
                  }`}
                >
                  <span className={`grid h-7 min-w-7 place-items-center rounded px-1 text-sm font-bold tabular-nums ${sel ? "bg-brand text-white" : "bg-surface"}`}>
                    {l.restantes}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.nombre}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{eur(l.restantes * l.precio)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-surface px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Pendiente</span>
            <span className="text-base font-bold tabular-nums">{eur(totalPendiente)}</span>
          </div>
        </aside>
      </div>

      {/* Controles de reparto */}
      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-2">
        {/* Nº Docs */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nº Docs</span>
          <button type="button" onClick={() => cambiarNDocs(-1)} aria-label="Menos documentos" className="grid h-10 w-10 place-items-center rounded transition-all hover:bg-accent active:scale-95 disabled:opacity-30 disabled:active:scale-100" disabled={nDocs <= 2}>
            <Minus size={16} />
          </button>
          <span className="w-6 text-center text-lg font-bold tabular-nums">{nDocs}</span>
          <button type="button" onClick={() => cambiarNDocs(+1)} aria-label="Más documentos" className="grid h-10 w-10 place-items-center rounded transition-all hover:bg-accent active:scale-95 disabled:opacity-30 disabled:active:scale-100" disabled={nDocs >= 12}>
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={divisionManual}
          className={`flex min-h-12 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-all active:scale-[.98] ${
            modo === "manual" ? "border-brand bg-brand/10 text-brand" : "border-border bg-card hover:bg-accent"
          }`}
        >
          <Hand size={16} /> División manual
        </button>
        <button
          type="button"
          onClick={divisionAutomatica}
          className={`flex min-h-12 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-all active:scale-[.98] ${
            modo === "automatica" ? "border-brand bg-brand/10 text-brand" : "border-border bg-card hover:bg-accent"
          }`}
        >
          <Wand2 size={16} /> División automática
        </button>

        {/* Unidades a mover */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unidades</span>
          <button type="button" onClick={() => setUdsMover((u) => Math.max(1, u - 1))} aria-label="Menos unidades" className="grid h-10 w-10 place-items-center rounded transition-all hover:bg-accent active:scale-95">
            <Minus size={16} />
          </button>
          <span className="w-6 text-center text-lg font-bold tabular-nums">{udsMover}</span>
          <button type="button" onClick={() => setUdsMover((u) => u + 1)} aria-label="Más unidades" className="grid h-10 w-10 place-items-center rounded transition-all hover:bg-accent active:scale-95">
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={traspasar}
          disabled={!lineaSel}
          className="flex min-h-12 items-center gap-1.5 rounded-md border border-brand/50 bg-brand/5 px-4 text-sm font-semibold text-brand transition-all hover:bg-brand/10 active:scale-[.98] disabled:border-border disabled:bg-card disabled:text-foreground disabled:opacity-40 disabled:active:scale-100"
        >
          Traspasar a Doc {docSel + 1} <ArrowRight size={16} />
        </button>
        <button
          type="button"
          onClick={divisionManual}
          className="flex min-h-12 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]"
        >
          <RotateCcw size={16} /> Cancelar división
        </button>
      </div>

      {/* Pie: acciones globales */}
      <footer className="flex flex-none items-center gap-2 border-t border-border bg-surface px-3 py-3">
        <button type="button" onClick={onCancelar} className="min-h-14 rounded-md border border-border bg-card px-5 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          Cancelar
        </button>
        {onAbrirCajon && (
          <button type="button" onClick={onAbrirCajon} className="min-h-14 rounded-md border border-border bg-card px-5 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">
            Abrir cajón
          </button>
        )}
        <button type="button" onClick={onCobrarTodos} className="ml-auto min-h-14 rounded-md border border-border bg-card px-5 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">
          Cobrar todos
        </button>
        <button
          type="button"
          onClick={aceptar}
          disabled={!todoAsignado}
          className="min-h-14 rounded-md bg-brand px-8 text-lg font-bold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-40 disabled:shadow-none disabled:hover:bg-brand disabled:active:scale-100"
          title={todoAsignado ? undefined : "Reparte todas las unidades para aceptar"}
        >
          Aceptar
        </button>
      </footer>
    </div>
  );
}
