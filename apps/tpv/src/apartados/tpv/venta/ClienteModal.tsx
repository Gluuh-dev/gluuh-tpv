import { useState } from "react";
import { UserRound, Search, Check, TriangleAlert, Coins, Building2, X } from "lucide-react";
import { Modal, CabeceraModal } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { CLIENTES_DEMO } from "../datos";
import { useVenta } from "../store";

function iniciales(n: string) { return n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

// Asignar un cliente al ticket (facturación, deuda, alergias), como en el TPV de
// Next: buscador + lista + ficha; asignar / quitar.
export function ClienteModal({ onCerrar }: Readonly<{ onCerrar: () => void }>) {
  const cliente = useVenta((s) => s.cliente);
  const setCliente = useVenta((s) => s.setCliente);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(cliente?.id ?? null);

  const lista = CLIENTES_DEMO.filter((c) => c.nombre.toLowerCase().includes(q.trim().toLowerCase()));
  const elegido = CLIENTES_DEMO.find((c) => c.id === sel);

  return (
    <Modal onCerrar={onCerrar} ancho="3xl" className="overflow-hidden p-0">
      <CabeceraModal Icono={UserRound} titulo="Cliente del ticket" onCerrar={onCerrar} />

      <div className="grid gap-0 sm:grid-cols-[1fr_300px]">
        {/* Lista */}
        <div className="flex min-h-[300px] flex-col border-r border-border p-4">
          <label className="relative mb-3 flex items-center">
            <Search size={16} className="absolute left-3 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none" />
          </label>
          <div className="no-scrollbar max-h-[44vh] space-y-1 overflow-auto">
            {lista.map((c) => (
              <button key={c.id} type="button" onClick={() => setSel(c.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-transform active:scale-[.99] ${sel === c.id ? "border-brand bg-brand/10" : "border-border bg-surface"}`}>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{iniciales(c.nombre)}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-semibold text-foreground">{c.nombre}</b>
                  <small className="text-[12px] text-muted-foreground">{c.telefono}</small>
                </span>
                {c.deuda ? <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold text-danger">DEBE</span> : null}
                {c.alergias ? <TriangleAlert size={15} className="text-warning" /> : null}
                {sel === c.id && <Check size={16} className="text-brand" />}
              </button>
            ))}
            {lista.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin clientes.</p>}
          </div>
        </div>

        {/* Ficha */}
        <div className="p-4">
          {elegido ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand/15 font-bold text-brand">{iniciales(elegido.nombre)}</span>
                <div><b className="block font-display text-lg font-bold text-foreground">{elegido.nombre}</b><small className="text-muted-foreground">{elegido.telefono}</small></div>
              </div>
              {elegido.nombre.includes("S.L.") && <p className="flex items-center gap-2 rounded-lg bg-info/10 px-3 py-2 text-sm text-info"><Building2 size={15} /> Empresa · facturación</p>}
              {elegido.deuda ? <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"><Coins size={15} /> Deuda pendiente: <b className="tabular-nums">{eur(elegido.deuda)}</b></p> : null}
              {elegido.alergias ? <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"><TriangleAlert size={15} /> Alergias: {elegido.alergias}</p> : null}
            </div>
          ) : <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">Elige un cliente de la lista.</p>}
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-border p-4">
        {cliente && <button type="button" onClick={() => { setCliente(null); onCerrar(); }} className="btn-ghost"><X size={15} /> Quitar del ticket</button>}
        <button type="button" onClick={onCerrar} className="btn-ghost ml-auto">Cancelar</button>
        <button type="button" disabled={!elegido} onClick={() => { if (elegido) { setCliente({ id: elegido.id, nombre: elegido.nombre, telefono: elegido.telefono, deuda: elegido.deuda, alergias: elegido.alergias }); onCerrar(); } }}
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-40">Asignar al ticket</button>
      </footer>
    </Modal>
  );
}
