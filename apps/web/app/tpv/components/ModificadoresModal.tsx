"use client";

// Modal de MODIFICADORES de un producto (estilo mockup del cliente): dos paneles
// —COMENTARIOS (de cocina, sin precio) y EXTRAS (con precio y unidades)— con una
// COLUMNA DE ACCIONES al centro (comentario manual · guardar · cancelar).
// PRESENTACIONAL: recibe datos por props, emite por callbacks; no hace fetch ni
// toca fiscalidad (el precio llega ya calculado).
// Skill: gluuh-ux-operativa (táctil ≥48px, feedback fuera del dedo).
import { useMemo, useState } from "react";
import { Minus, Plus, MessageSquarePlus, Check, AlertTriangle, X } from "lucide-react";

export interface GrupoComentario {
  nombre: string;
  /** Mínimo de opciones obligatorias (min_sel). 0/undefined = opcional. */
  min?: number;
  /** Fuerza selección única (elige uno). También se asume si min ≥ 1. */
  unica?: boolean;
  opciones: { id: string; nombre: string }[];
}

export interface ExtraArticulo {
  id: string;
  nombre: string;
  precioExtra: number;
}

export interface SeleccionModificadores {
  /** Ids de las opciones de comentario marcadas. */
  comentarios: string[];
  /** Extras elegidos con sus unidades (uds ≥ 1). */
  extras: { id: string; uds: number }[];
  /** Texto libre escrito por el camarero. */
  comentarioManual: string;
  /** Unidades del propio producto (≥ 1). Opcional: page.tsx no lo consume hoy. */
  unidades?: number;
}

export interface ModificadoresModalProps {
  producto: { nombre: string; precio: number };
  gruposComentario: GrupoComentario[];
  extras: ExtraArticulo[];
  /** Anotaciones rápidas globales del tenant (nota_preparacion) agrupadas por
   *  su `descripcion`: el texto se pliega en la nota de cocina al tocarlo
   *  (poco hecha, sin sal, sin gluten…). Disponibles en cualquier producto. */
  anotaciones?: { grupo: string; opciones: string[] }[];
  seleccionInicial?: SeleccionModificadores;
  /** Unidades de partida si no vienen en seleccionInicial (por defecto 1). */
  unidadesInicial?: number;
  onGuardar(seleccion: SeleccionModificadores): void;
  onCancelar(): void;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";
const esUnicaGrupo = (g: GrupoComentario) => !!g.unica || (g.min ?? 0) >= 1;

export function ModificadoresModal({
  producto,
  gruposComentario,
  extras,
  anotaciones = [],
  seleccionInicial,
  unidadesInicial,
  onGuardar,
  onCancelar,
}: ModificadoresModalProps) {
  const [comentarios, setComentarios] = useState<Set<string>>(
    () => new Set(seleccionInicial?.comentarios ?? []),
  );
  const [extrasUds, setExtrasUds] = useState<Record<string, number>>(() => {
    const r: Record<string, number> = {};
    for (const e of seleccionInicial?.extras ?? []) r[e.id] = e.uds;
    return r;
  });
  const [comentarioManual, setComentarioManual] = useState(seleccionInicial?.comentarioManual ?? "");
  const [mostrarManual, setMostrarManual] = useState(!!seleccionInicial?.comentarioManual);
  const [unidades, setUnidades] = useState(
    () => Math.max(1, seleccionInicial?.unidades ?? unidadesInicial ?? 1),
  );

  const totalExtras = useMemo(
    () => extras.reduce((s, e) => s + e.precioExtra * (extrasUds[e.id] ?? 0), 0),
    [extras, extrasUds],
  );
  const total = producto.precio * unidades + totalExtras;

  // Primer grupo obligatorio (min>0) sin cubrir: deshabilita Guardar y avisa.
  const grupoFaltante = useMemo(
    () => gruposComentario.find(
      (g) => (g.min ?? 0) > 0 && g.opciones.filter((o) => comentarios.has(o.id)).length < g.min!,
    ),
    [gruposComentario, comentarios],
  );

  function toggleComentario(grupo: GrupoComentario, id: string) {
    setComentarios((prev) => {
      const next = new Set(prev);
      if (esUnicaGrupo(grupo)) {
        const yaActiva = next.has(id);
        for (const o of grupo.opciones) next.delete(o.id); // desmarca las hermanas
        // obligatorio: siempre queda una elegida; opcional: permite desmarcar.
        if (!yaActiva || (grupo.min ?? 0) >= 1) next.add(id);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function cambiarUds(id: string, delta: number) {
    setExtrasUds((prev) => {
      const uds = Math.max(0, (prev[id] ?? 0) + delta);
      const next = { ...prev };
      if (uds === 0) delete next[id];
      else next[id] = uds;
      return next;
    });
  }

  function guardar() {
    if (grupoFaltante) return; // grupo obligatorio sin cubrir (además del disabled del botón)
    onGuardar({
      comentarios: [...comentarios],
      extras: extras
        .filter((e) => (extrasUds[e.id] ?? 0) > 0)
        .map((e) => ({ id: e.id, uds: extrasUds[e.id]! })),
      comentarioManual: comentarioManual.trim(),
      unidades,
    });
  }

  const manualTexto = comentarioManual.trim();

  // Anotaciones rápidas: se pliegan en el comentario manual como segmentos "· ".
  // Un chip está activo si su texto ya es un segmento de la nota.
  const segmentos = comentarioManual.split("·").map((s) => s.trim()).filter(Boolean);
  const anotActiva = (txt: string) => segmentos.includes(txt);
  function toggleAnotacion(txt: string) {
    const set = new Set(segmentos);
    if (set.has(txt)) set.delete(txt);
    else set.add(txt);
    setComentarioManual([...set].join(" · "));
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
      aria-label={`Modificadores de ${producto.nombre}`}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera: nombre del producto (acento cian) + total + cerrar */}
        <header className="flex flex-none items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4">
          <h2 className="truncate text-2xl font-black uppercase tracking-wide text-brand">
            {producto.nombre}
          </h2>
          <div className="flex flex-none items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</div>
              <div className="text-2xl font-black leading-none tabular-nums text-brand">{eur(total)}</div>
            </div>
            <button
              type="button"
              onClick={onCancelar}
              aria-label="Cerrar"
              className="grid h-11 w-11 flex-none place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Cuerpo: panel Comentarios · acciones · panel Extras (apilado en móvil) */}
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto bg-background/40 p-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* ── Panel izquierdo: Comentarios ── */}
          <section className="order-1 flex flex-col rounded-lg border border-border bg-card p-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comentarios</h3>

            {/* Fila de precio: recalcula con unidades y extras */}
            <div className="mb-3 flex items-baseline gap-2 rounded-md bg-surface px-3 py-2 text-sm tabular-nums">
              <span className="text-muted-foreground">Precio:</span>
              <span className="font-semibold">{eur(producto.precio)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-brand">{eur(total)}</span>
            </div>

            <div className="flex flex-col gap-4">
              {gruposComentario.map((grupo) => {
                const unica = esUnicaGrupo(grupo);
                return (
                  <div key={grupo.nombre}>
                    <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                      {grupo.nombre}
                      {unica && <span className="text-xs font-normal text-muted-foreground">· elige uno</span>}
                      {(grupo.min ?? 0) > 0 && (
                        <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                          Obligatorio
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {grupo.opciones.map((op) => {
                        const activo = comentarios.has(op.id);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => toggleComentario(grupo, op.id)}
                            aria-pressed={activo}
                            className={`flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-all active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                              activo
                                ? "border-brand bg-brand/10 text-brand"
                                : "border-border bg-background hover:border-border-strong hover:bg-accent"
                            }`}
                          >
                            <span
                              className={`grid h-5 w-5 flex-none place-items-center border transition-colors ${
                                unica ? "rounded-full" : "rounded"
                              } ${activo ? "border-brand bg-brand text-white" : "border-border-strong"}`}
                            >
                              {activo ? <Check size={14} strokeWidth={3} /> : null}
                            </span>
                            <span className="truncate">{op.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {gruposComentario.length === 0 && anotaciones.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
                  Este producto no tiene comentarios predefinidos. Usa «Comentario manual».
                </p>
              )}

              {/* Anotaciones rápidas del tenant (nota_preparacion), agrupadas por
                  descripcion: toggles que se pliegan en la nota de cocina. */}
              {anotaciones.map((grupo) => (
                <div key={grupo.grupo}>
                  <div className="mb-1.5 text-sm font-semibold">{grupo.grupo}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {grupo.opciones.map((txt) => {
                      const activo = anotActiva(txt);
                      return (
                        <button
                          key={txt}
                          type="button"
                          onClick={() => toggleAnotacion(txt)}
                          aria-pressed={activo}
                          className={`flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-all active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            activo
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border bg-background hover:border-border-strong hover:bg-accent"
                          }`}
                        >
                          <span
                            className={`grid h-5 w-5 flex-none place-items-center rounded border transition-colors ${
                              activo ? "border-brand bg-brand text-white" : "border-border-strong"
                            }`}
                          >
                            {activo ? <Check size={14} strokeWidth={3} /> : null}
                          </span>
                          <span className="truncate">{txt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Comentario manual: edición inline o vista entre comillas */}
              {mostrarManual ? (
                <textarea
                  autoFocus
                  value={comentarioManual}
                  onChange={(e) => setComentarioManual(e.target.value)}
                  onBlur={() => setMostrarManual(!!manualTexto)}
                  placeholder="Comentario manual a cocina…"
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                />
              ) : (
                manualTexto && (
                  <button
                    type="button"
                    onClick={() => setMostrarManual(true)}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-left text-sm italic text-foreground transition-colors hover:border-brand"
                  >
                    «{manualTexto}»
                  </button>
                )
              )}
            </div>
          </section>

          {/* ── Columna central: acciones ── */}
          <div className="order-3 flex flex-col justify-center gap-3 md:order-2 md:w-44">
            <button
              type="button"
              onClick={() => setMostrarManual(true)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <MessageSquarePlus size={18} strokeWidth={1.5} /> Comentario manual
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={!!grupoFaltante}
              className="min-h-14 rounded-md bg-[#c46a2a] px-4 text-base font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:bg-[#d47c34] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-[#c46a2a] disabled:active:scale-100"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={onCancelar}
              className="min-h-14 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Cancelar
            </button>
            {grupoFaltante && (
              <div
                className="flex items-center justify-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-2 text-center text-xs font-semibold text-warning"
                role="alert"
              >
                <AlertTriangle size={14} strokeWidth={2.5} /> Elige {grupoFaltante.nombre}
              </div>
            )}
          </div>

          {/* ── Panel derecho: Extras (con unidades del producto) ── */}
          <section className="order-2 flex flex-col rounded-lg border border-border bg-card p-3 md:order-3">
            {/* Cabecera con stepper de unidades del producto */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Extras</h3>
              <div className="flex items-center gap-1">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unidades</span>
                <button
                  type="button"
                  onClick={() => setUnidades((u) => Math.max(1, u - 1))}
                  disabled={unidades <= 1}
                  aria-label="Quitar unidad"
                  className="grid h-11 w-11 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                >
                  <Minus size={18} />
                </button>
                <span className="w-8 text-center text-lg font-bold tabular-nums">{unidades}</span>
                <button
                  type="button"
                  onClick={() => setUnidades((u) => u + 1)}
                  aria-label="Añadir unidad"
                  className="grid h-11 w-11 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {extras.map((e) => {
                const uds = extrasUds[e.id] ?? 0;
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                      uds > 0 ? "border-brand bg-brand/5" : "border-border bg-background"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.nombre}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">+{eur(e.precioExtra)}</div>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarUds(e.id, -1)}
                        disabled={uds === 0}
                        aria-label={`Quitar ${e.nombre}`}
                        className="grid h-12 w-12 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                      >
                        <Minus size={18} />
                      </button>
                      <span className="w-9 text-center text-lg font-bold tabular-nums">{uds}</span>
                      <button
                        type="button"
                        onClick={() => cambiarUds(e.id, +1)}
                        aria-label={`Añadir ${e.nombre}`}
                        className="grid h-12 w-12 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {extras.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
                  Este producto no admite extras.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
