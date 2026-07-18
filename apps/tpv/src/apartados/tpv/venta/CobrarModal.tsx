import { useState } from "react";
import { Banknote, CreditCard, Smartphone, Check } from "lucide-react";
import { Modal, TecladoNumerico } from "../../../ui";
import { eur } from "../../../lib/dinero";

type Metodo = "EFECTIVO" | "TARJETA" | "BIZUM";
const METODOS: ReadonlyArray<{ m: Metodo; label: string; Icono: typeof Banknote }> = [
  { m: "EFECTIVO", label: "Contado", Icono: Banknote },
  { m: "TARJETA", label: "Tarjeta", Icono: CreditCard },
  { m: "BIZUM", label: "Bizum", Icono: Smartphone },
];
const RAPIDOS = [5, 10, 20, 50];

// COBRO de la cuenta: elige método; en efectivo teclea lo recibido y ve el cambio;
// tarjeta/bizum es importe exacto. Cierra la venta. El desglose fiscal e impresión/
// VERIFACTU reales se cablean al cobrar contra el gateway del nodo (E2).
export function CobrarModal({
  total, contexto, onCerrar, onCobrado,
}: Readonly<{ total: number; contexto: string; onCerrar: () => void; onCobrado: (metodo: string) => void }>) {
  const [metodo, setMetodo] = useState<Metodo>("EFECTIVO");
  const [recibido, setRecibido] = useState("");

  const rec = Number.parseFloat(recibido.replace(",", ".")) || 0;
  const esEfectivo = metodo === "EFECTIVO";
  const cambio = Math.round((rec - total) * 100) / 100;
  const cubierto = !esEfectivo || rec >= total;
  const base = Math.round((total / 1.1) * 100) / 100; // IVA 10% demo
  const impuesto = Math.round((total - base) * 100) / 100;

  const digito = (d: string) => setRecibido((v) => (d === "," && v.includes(",") ? v : (v + d).slice(0, 8)));

  return (
    <Modal onCerrar={onCerrar} ancho="2xl" className="overflow-hidden p-0">
      {/* Cabecera morada */}
      <header className="flex items-center gap-3 bg-brand px-5 py-3.5 text-white">
        <CreditCard size={20} />
        <div><h2 className="font-display text-lg font-extrabold leading-none">Cobrar</h2><p className="text-[12px] opacity-80">{contexto || "Ticket"}</p></div>
        <span className="ml-auto font-display text-3xl font-extrabold tabular-nums">{eur(total)}</span>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_220px]">
        {/* Izquierda: desglose + visor + teclado */}
        <div>
          <div className="mb-3 flex gap-4 text-sm">
            <span className="text-muted-foreground">Base <b className="text-foreground tabular-nums">{eur(base)}</b></span>
            <span className="text-muted-foreground">IVA <b className="text-foreground tabular-nums">{eur(impuesto)}</b></span>
          </div>

          <div className="mb-3 rounded-xl border border-border bg-surface-2 p-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recibido</p>
            <p className="font-display text-3xl font-bold tabular-nums text-foreground">{esEfectivo ? eur(rec) : eur(total)}</p>
          </div>

          {esEfectivo && (
            <>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setRecibido(String(total).replace(".", ","))} className="flex-1 rounded-lg border border-border bg-surface py-2 text-sm font-semibold text-foreground transition-transform active:scale-95">Exacto</button>
                {RAPIDOS.map((n) => <button key={n} type="button" onClick={() => setRecibido(String(n))} className="flex-1 rounded-lg border border-border bg-surface py-2 text-sm font-semibold text-foreground transition-transform active:scale-95">{n}€</button>)}
              </div>
              <TecladoNumerico onDigito={digito} onBorrar={() => setRecibido((v) => v.slice(0, -1))} />
              <div className={`mt-3 rounded-lg py-2 text-center text-sm font-bold ${cambio >= 0 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                {rec <= 0 ? "Introduce el importe recibido" : cambio >= 0 ? `A devolver ${eur(cambio)}` : `Falta ${eur(-cambio)}`}
              </div>
            </>
          )}
        </div>

        {/* Derecha: métodos */}
        <div className="flex flex-col gap-2.5">
          {METODOS.map(({ m, label, Icono }) => {
            const sel = m === metodo;
            return (
              <button key={m} type="button" onClick={() => { setMetodo(m); setRecibido(""); }}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-transform active:scale-95 ${sel ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface text-foreground"}`}>
                <Icono size={20} /> <span className="font-semibold">{label}</span>
                {sel && <Check size={18} className="ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pie */}
      <footer className="flex gap-2 border-t border-border p-4">
        <button type="button" onClick={onCerrar} className="btn-ghost flex-1">Cancelar</button>
        <button type="button" disabled={!cubierto || total <= 0} onClick={() => onCobrado(metodo)}
          className="flex flex-[2] items-center justify-center gap-2 rounded-full bg-cobro py-3 font-display text-lg font-bold text-white transition-transform active:scale-[.98] disabled:opacity-40">
          <CreditCard size={20} /> Cobrar {eur(total)}
        </button>
      </footer>
    </Modal>
  );
}
