"use client";

// Modal MENÚ por pasos (estilo Ágora/Glop "Menú del día"): compone un menú combo
// eligiendo UNA opción por grupo (Bebida, Primero, Segundo, Postre…). PRESENTACIONAL:
// recibe el menú por props y emite la selección por callback; no hace fetch ni toca
// fiscalidad (el precio del menú llega ya calculado). Skill: gluuh-ux-operativa
// (táctil ≥44px, un acento = bg-brand; la acción de dinero = naranja).
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { eur } from "@/app/lib/money";

export interface MenuGrupo {
  id: string;
  nombre: string;
  /** Pase de cocina CONFIGURADO (0133). Sin él se deduce del nombre. */
  orden_prep?: number | null;
  opciones: { id: string; nombre: string }[];
}

export interface MenuModalProps {
  menu: { nombre: string; precio: number; grupos: MenuGrupo[] };
  onAceptar(
    seleccion: { grupoId: string; grupoNombre: string; grupoOrdenPrep?: number | null; opcionId: string; opcionNombre: string }[],
  ): void;
  onCancelar(): void;
}


export function MenuModal({ menu, onAceptar, onCancelar }: MenuModalProps) {
  // Estado interno: una opción elegida por grupo.
  const [elegidas, setElegidas] = useState<Record<string, string>>({});

  // Completo cuando TODOS los grupos tienen una opción elegida.
  const completo = useMemo(
    () => menu.grupos.length > 0 && menu.grupos.every((g) => elegidas[g.id]),
    [menu.grupos, elegidas],
  );

  function elegir(grupoId: string, opcionId: string) {
    setElegidas((prev) => ({ ...prev, [grupoId]: opcionId }));
  }

  function aceptar() {
    if (!completo) return; // además del disabled del botón
    onAceptar(
      menu.grupos.map((g) => {
        const opcionId = elegidas[g.id]!;
        const opcion = g.opciones.find((o) => o.id === opcionId)!;
        return { grupoId: g.id, grupoNombre: g.nombre, grupoOrdenPrep: g.orden_prep, opcionId, opcionNombre: opcion.nombre };
      }),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
      aria-label={`Menú ${menu.nombre}`}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera: nombre del menú + precio (cian, como el mockup) */}
        <header className="flex flex-none items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4">
          <h2 className="truncate text-xl font-bold uppercase tracking-wide">{menu.nombre}</h2>
          <div className="flex-none text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Precio menú
            </div>
            <div className="text-3xl font-black leading-none tabular-nums text-brand">
              {eur(menu.precio)}
            </div>
          </div>
        </header>

        {/* Cuerpo: un bloque por grupo, opciones como botones (selección única) */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto bg-background/40 p-4">
          {menu.grupos.map((grupo) => {
            const elegidaId = elegidas[grupo.id];
            return (
              <section key={grupo.id}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {grupo.nombre}
                  {elegidaId ? (
                    <Check size={16} strokeWidth={3} className="text-brand" />
                  ) : (
                    <span className="text-[11px] font-medium normal-case text-muted-foreground">
                      Elige uno
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {grupo.opciones.map((op) => {
                    const activo = elegidaId === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => elegir(grupo.id, op.id)}
                        aria-pressed={activo}
                        className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          activo
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-border bg-background hover:border-border-strong hover:bg-accent"
                        }`}
                      >
                        <span
                          className={`grid h-5 w-5 flex-none place-items-center rounded-full border transition-colors ${
                            activo ? "border-brand bg-brand text-white" : "border-border-strong"
                          }`}
                        >
                          {activo ? <Check size={13} strokeWidth={3} /> : null}
                        </span>
                        <span className="truncate">{op.nombre}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {menu.grupos.length === 0 && (
            <p className="text-sm text-muted-foreground">Este menú no tiene pasos configurados.</p>
          )}
        </div>

        {/* Pie: Cancelar / Añadir menú (naranja = acción de dinero) */}
        <footer className="flex flex-none items-center gap-2 border-t border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={onCancelar}
            className="min-h-14 flex-1 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aceptar}
            disabled={!completo}
            className="min-h-14 flex-[2] rounded-md bg-[#c46a2a] px-4 text-base font-bold text-white shadow-md shadow-orange-500/25 transition-all hover:bg-[#d47c34] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-[#c46a2a] disabled:active:scale-100"
            title={completo ? undefined : "Elige una opción de cada grupo"}
          >
            Añadir menú
          </button>
        </footer>
      </div>
    </div>
  );
}
