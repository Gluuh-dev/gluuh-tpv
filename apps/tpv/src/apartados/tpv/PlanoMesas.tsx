import { useState } from "react";
import { Users, Clock, Plus } from "lucide-react";
import { eur } from "../../lib/dinero";
import { SALAS_DEMO, type Mesa } from "./datos";

// Estilo de la mesa según su estado (operativa: colores claros de estado).
function estiloMesa(estado: Mesa["estado"]): string {
  if (estado === "OCUPADA") return "border-brand/45 bg-brand/10";
  if (estado === "POR_COBRAR") return "border-amber/55 bg-amber/12";
  return "border-line bg-paper/[.03]"; // LIBRE
}

function MesaBoton({ mesa, onClick }: Readonly<{ mesa: Mesa; onClick: () => void }>) {
  const libre = mesa.estado === "LIBRE";
  return (
    <button type="button" onClick={onClick}
      className={`flex aspect-4/3 flex-col rounded-2xl border p-3.5 text-left transition-transform active:scale-95 ${estiloMesa(mesa.estado)}`}>
      <div className="flex items-start justify-between">
        <span className="font-display text-2xl font-extrabold tracking-tight text-paper">{mesa.nombre}</span>
        {mesa.estado === "POR_COBRAR" && <span className="rounded-full bg-amber/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber">POR COBRAR</span>}
      </div>
      {libre ? (
        <span className="mt-auto text-[12px] font-medium text-muted">Libre</span>
      ) : (
        <div className="mt-auto flex items-end justify-between">
          <span className="flex items-center gap-2 text-[12px] text-muted">
            <span className="flex items-center gap-1"><Users size={12} /> {mesa.comensales}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {mesa.abiertaMin}′</span>
          </span>
          <span className="font-display text-lg font-bold tabular-nums text-paper">{eur(mesa.total ?? 0)}</span>
        </div>
      )}
    </button>
  );
}

export function PlanoMesas({
  onAbrirMesa, onNuevaBarra,
}: Readonly<{ onAbrirMesa: (m: Mesa) => void; onNuevaBarra: () => void }>) {
  const [salaId, setSalaId] = useState(SALAS_DEMO[0]!.id);
  const sala = SALAS_DEMO.find((s) => s.id === salaId)!;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Pestañas de sala */}
      <div className="flex flex-none gap-2 border-b border-line px-6 py-3">
        {SALAS_DEMO.map((s) => {
          const activa = s.id === salaId;
          const ocupadas = s.mesas.filter((m) => m.estado !== "LIBRE").length;
          return (
            <button key={s.id} type="button" onClick={() => setSalaId(s.id)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-transform active:scale-95 ${activa ? "border-transparent bg-brand text-white" : "border-line bg-paper/5 text-muted"}`}>
              {s.nombre}
              {s.mesas.length > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${activa ? "bg-white/20" : "bg-paper/10"}`}>{ocupadas}/{s.mesas.length}</span>}
            </button>
          );
        })}
      </div>

      {/* Rejilla de mesas */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-3 overflow-auto p-6 sm:grid-cols-4 lg:grid-cols-6">
        {sala.mesas.map((m) => <MesaBoton key={m.id} mesa={m} onClick={() => onAbrirMesa(m)} />)}
        {sala.id === "barra" && (
          <button type="button" onClick={onNuevaBarra}
            className="flex aspect-4/3 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-lit/50 bg-brand/5 text-brand-lit transition-transform active:scale-95">
            <Plus size={26} /> <span className="text-sm font-semibold">Nueva cuenta</span>
          </button>
        )}
        {sala.mesas.length === 0 && sala.id !== "barra" && (
          <p className="col-span-full py-10 text-center text-sm text-muted">Esta sala no tiene mesas.</p>
        )}
      </div>
    </div>
  );
}
