"use client";

import { Check, Gift, RotateCcw } from "lucide-react";
import { eur } from "@/app/lib/money";
import { ModalTPV } from "./ModalTPV";

export interface LineaInvitacion {
  id: string;
  nombre: string;
  unidades: number;
  importe: number;
}

interface Props {
  lineas: LineaInvitacion[];
  invitadas: Record<string, boolean>;
  onCambiar: (id: string) => void;
  onInvitarTodo: () => void;
  onQuitarTodo: () => void;
  onClose: () => void;
}

export function InvitacionesModal({ lineas, invitadas, onCambiar, onInvitarTodo, onQuitarTodo, onClose }: Readonly<Props>) {
  const importeInvitado = lineas.reduce((total, linea) => total + (invitadas[linea.id] ? linea.importe : 0), 0);
  const total = lineas.reduce((acumulado, linea) => acumulado + linea.importe, 0);
  const lineasInvitadas = lineas.filter((linea) => invitadas[linea.id]).length;

  return (
    <ModalTPV
      titulo="Invitaciones y descuentos"
      subtitulo="Marca las líneas que se cobran a 0,00 € sin borrar su rastro"
      ancho={980}
      alto={660}
      onClose={onClose}
      derecha={<div className="text-right"><div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ticket</div><b className="text-lg tabular-nums">{eur(total)}</b></div>}
    >
      <div className="flex h-full min-h-0 flex-col bg-surface">
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[54px_1fr_74px_112px] gap-px bg-border px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="py-3 text-center">Inv.</span>
              <span className="py-3">Artículo</span>
              <span className="py-3 text-right">Uds.</span>
              <span className="py-3 text-right">Importe</span>
            </div>
            {lineas.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No hay líneas en el ticket.</p>
            ) : lineas.map((linea) => {
              const invitada = !!invitadas[linea.id];
              return (
                <button
                  key={linea.id}
                  type="button"
                  onClick={() => onCambiar(linea.id)}
                  className={`grid w-full grid-cols-[54px_1fr_74px_112px] items-center gap-px border-t border-border text-left transition-colors ${invitada ? "bg-success/10" : "hover:bg-accent"}`}
                >
                  <span className="grid h-full min-h-14 place-items-center bg-surface-2">
                    <span className={`grid h-7 w-7 place-items-center rounded-md border-2 ${invitada ? "border-success bg-success text-success-foreground" : "border-border bg-card text-transparent"}`}>
                      <Check size={16} strokeWidth={3} />
                    </span>
                  </span>
                  <span className="min-w-0 px-3 py-2.5">
                    <span className="block truncate text-sm font-bold">{linea.nombre}</span>
                    {invitada ? <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success"><Gift size={12} /> Invitado</span> : null}
                  </span>
                  <span className="px-3 text-right text-sm font-semibold tabular-nums">{linea.unidades}</span>
                  <span className={`px-3 text-right text-sm font-bold tabular-nums ${invitada ? "text-success line-through" : ""}`}>{eur(linea.importe)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-surface-2 px-4 py-3">
          <div><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Líneas invitadas</span><b className="text-lg tabular-nums text-success">{lineasInvitadas}</b></div>
          <div><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Importe invitado</span><b className="text-lg tabular-nums text-success">{eur(importeInvitado)}</b></div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onQuitarTodo} className="flex h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-muted-foreground hover:bg-accent"><RotateCcw size={16} /> Quitar</button>
            <button type="button" onClick={onInvitarTodo} className="flex h-11 items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 text-sm font-bold text-success hover:bg-success/20"><Gift size={16} /> Invitar todo</button>
            <button type="button" onClick={onClose} className="h-11 rounded-md bg-success px-5 text-sm font-bold text-success-foreground hover:brightness-95">Hecho</button>
          </div>
        </div>
      </div>
    </ModalTPV>
  );
}