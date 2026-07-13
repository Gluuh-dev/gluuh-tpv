"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Check, AlertTriangle, X } from "lucide-react";
import { eur } from "@/app/lib/money";

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
  /** Unidades del propio producto (≥ 1). */
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
  onEliminar?(): void;
}

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
  onEliminar,
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
  const [unidades, setUnidades] = useState(
    () => Math.max(1, seleccionInicial?.unidades ?? unidadesInicial ?? 1),
  );

  const totalExtras = useMemo(
    () => extras.reduce((s, e) => s + e.precioExtra * (extrasUds[e.id] ?? 0), 0),
    [extras, extrasUds],
  );
  const total = producto.precio * unidades + totalExtras;

  // Primer grupo obligatorio (min>0) sin cubrir: deshabilita Aceptar y avisa.
  const grupoFaltante = useMemo(
    () => gruposComentario.find(
      (g) => (g.min ?? 0) > 0 && g.opciones.filter((o) => comentarios.has(o.id)).length < g.min!,
    ),
    [gruposComentario, comentarios],
  );

  function triggerAutoSave(
    currentComentarios: Set<string>,
    currentExtrasUds: Record<string, number>,
    currentManual: string,
    currentUnidades: number
  ) {
    onGuardar({
      comentarios: [...currentComentarios],
      extras: extras
        .filter((e) => (currentExtrasUds[e.id] ?? 0) > 0)
        .map((e) => ({ id: e.id, uds: currentExtrasUds[e.id]! })),
      comentarioManual: currentManual.trim(),
      unidades: currentUnidades,
    });
  }

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
      triggerAutoSave(next, extrasUds, comentarioManual, unidades);
      return next;
    });
  }

  const segmentos = comentarioManual.split("·").map((s) => s.trim()).filter(Boolean);
  const anotActiva = (txt: string) => segmentos.includes(txt);
  function toggleAnotacion(txt: string) {
    const set = new Set(segmentos);
    if (set.has(txt)) set.delete(txt);
    else set.add(txt);
    const newManual = [...set].join(" · ");
    setComentarioManual(newManual);
    triggerAutoSave(comentarios, extrasUds, newManual, unidades);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => { if (!grupoFaltante) onCancelar(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Modificadores de ${producto.nombre}`}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
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
              disabled={!!grupoFaltante}
              aria-label="Cerrar"
              className="grid h-11 w-11 flex-none place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Cuerpo: Comentarios (izq) y Extras (der) */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto bg-background/40 p-4">
          
          {/* Panel izquierdo: Comentarios */}
          <section className="flex flex-col rounded-lg border border-border bg-card p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Comentarios</h3>
              <div className="flex items-baseline gap-2 rounded-md bg-surface px-3 py-2 text-xs tabular-nums text-muted-foreground">
                <span>Precio base: <strong>{eur(producto.precio)}</strong></span>
                <span>·</span>
                <span>Total línea: <strong className="text-brand">{eur(total)}</strong></span>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {gruposComentario.map((grupo) => {
                const unica = esUnicaGrupo(grupo);
                return (
                  <div key={grupo.nombre} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      {grupo.nombre}
                      {unica && <span className="text-xs font-normal text-muted-foreground">· elige uno</span>}
                      {(grupo.min ?? 0) > 0 && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">
                          Obligatorio
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {grupo.opciones.map((op) => {
                        const activo = comentarios.has(op.id);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => toggleComentario(grupo, op.id)}
                            className={`flex min-h-12 items-center justify-center text-center rounded-md border px-2 py-1.5 text-xs font-semibold transition-all active:scale-[.98] ${
                              activo
                                ? "border-brand bg-brand/10 text-brand shadow-[0_0_0_1px_rgba(13,143,162,0.2)]"
                                : "border-border bg-background hover:border-border-strong hover:bg-accent"
                            }`}
                          >
                            {op.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {anotaciones.map((grupo) => (
                <div key={grupo.grupo} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                  <div className="mb-2 text-sm font-semibold">{grupo.grupo}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {grupo.opciones.map((txt) => {
                      const activo = anotActiva(txt);
                      return (
                        <button
                          key={txt}
                          type="button"
                          onClick={() => toggleAnotacion(txt)}
                          className={`flex min-h-12 items-center justify-center text-center rounded-md border px-2 py-1.5 text-xs font-semibold transition-all active:scale-[.98] ${
                            activo
                              ? "border-brand bg-brand/10 text-brand"
                              : "border-border bg-background hover:border-strong hover:bg-accent"
                          }`}
                        >
                          {txt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {gruposComentario.length === 0 && anotaciones.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-sm text-muted-foreground">
                  Este producto no tiene comentarios predefinidos.
                </p>
              )}

              {/* Comentario manual */}
              <div className="pt-2">
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comentario manual</div>
                <textarea
                  value={comentarioManual}
                  onChange={(e) => {
                    setComentarioManual(e.target.value);
                    triggerAutoSave(comentarios, extrasUds, e.target.value, unidades);
                  }}
                  placeholder="Escribe un comentario personalizado para cocina..."
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-brand"
                />
              </div>
            </div>
          </section>

          {/* Panel derecho: Extras en un grid rápido (Estilo checkbox) */}
          <section className="flex flex-col rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Extras y añadidos</h3>
            
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {extras.map((e) => {
                  const activo = (extrasUds[e.id] ?? 0) > 0;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        setExtrasUds((prev) => {
                          const next = { ...prev };
                          if (prev[e.id] > 0) {
                            delete next[e.id];
                          } else {
                            next[e.id] = 1;
                          }
                          triggerAutoSave(comentarios, next, comentarioManual, unidades);
                          return next;
                        });
                      }}
                      className={`flex flex-col items-center justify-center text-center min-h-[64px] rounded-md border px-2 py-1.5 transition-all active:scale-[.98] ${
                        activo
                          ? "border-brand bg-brand/10 text-brand shadow-[0_0_0_1px_rgba(13,143,162,0.2)]"
                          : "border-border bg-background hover:border-strong hover:bg-accent"
                      }`}
                    >
                      <span className="text-xs font-semibold truncate w-full">{e.nombre}</span>
                      <span className={`text-[10px] ${activo ? "text-brand" : "text-muted-foreground"} mt-0.5 tabular-nums`}>+{eur(e.precioExtra)}</span>
                    </button>
                  );
                })}
              </div>

              {extras.length === 0 && (
                <p className="rounded-md border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                  Este producto no admite extras.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Pie de página con unidades y acciones */}
        <footer className="flex flex-none flex-wrap items-center justify-between gap-4 border-t border-border bg-surface px-5 py-4">
          {/* Unidades del plato */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Unidades del plato</span>
            <button
              type="button"
              onClick={() => setUnidades((u) => {
                const next = Math.max(1, u - 1);
                triggerAutoSave(comentarios, extrasUds, comentarioManual, next);
                return next;
              })}
              disabled={unidades <= 1}
              className="grid h-11 w-11 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95 disabled:opacity-30"
            >
              <Minus size={18} />
            </button>
            <span className="w-8 text-center text-lg font-bold tabular-nums">{unidades}</span>
            <button
              type="button"
              onClick={() => setUnidades((u) => {
                const next = u + 1;
                triggerAutoSave(comentarios, extrasUds, comentarioManual, next);
                return next;
              })}
              className="grid h-11 w-11 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Acciones principales */}
          <div className="flex items-center gap-3">
            {onEliminar && (
              <button
                type="button"
                onClick={onEliminar}
                className="min-h-12 rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-600 px-6 text-sm font-bold transition-all hover:bg-rose-500/20 active:scale-[.98]"
              >
                Quitar plato
              </button>
            )}
            <button
              type="button"
              onClick={onCancelar}
              disabled={!!grupoFaltante}
              className="min-h-12 rounded-md bg-brand px-8 text-base font-bold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand/90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aceptar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
