import { Gift, Check } from "lucide-react";
import { Modal, CabeceraModal, Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { PRODUCTOS_DEMO } from "../datos";
import { useVenta } from "../store";

const nombreDe = (id: string) => PRODUCTOS_DEMO.find((p) => p.id === id.split("|")[0])?.nombre ?? "Producto";

// Invitaciones: marca qué líneas van invitadas (se cobran a 0 pero quedan en la
// comanda). Como en el TPV de Next: check por línea + invitar/quitar todo.
export function InvitacionesModal({ onCerrar }: Readonly<{ onCerrar: () => void }>) {
  const comanda = useVenta((s) => s.comanda);
  const invitadas = useVenta((s) => s.invitadas);
  const invitar = useVenta((s) => s.invitarLinea);
  const invitarTodo = useVenta((s) => s.invitarTodo);
  const precioEfectivo = useVenta((s) => s.precioEfectivo);

  const ids = Object.keys(comanda);
  const nInv = ids.filter((id) => invitadas[id]).length;

  return (
    <Modal onCerrar={onCerrar} ancho="2xl" className="overflow-hidden p-0">
      <CabeceraModal Icono={Gift} titulo="Invitaciones" derecha={<span className="text-sm text-white/80">{nInv} de {ids.length} invitadas</span>} onCerrar={onCerrar} />

      <Desplazable fuera="max-h-[52vh]" className="p-4">
        {ids.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No hay líneas en la comanda.</p>}
        <div className="space-y-1">
          {ids.map((id) => {
            const inv = !!invitadas[id];
            const q = comanda[id]!;
            return (
              <button key={id} type="button" onClick={() => invitar(id)}
                className={`grid w-full grid-cols-[36px_1fr_56px_96px] items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-transform active:scale-[.99] ${inv ? "border-success/40 bg-success/10" : "border-border bg-surface"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-md border ${inv ? "border-success bg-success text-white" : "border-border"}`}>{inv && <Check size={15} strokeWidth={3} />}</span>
                <span className="truncate font-semibold text-foreground">{nombreDe(id)}</span>
                <span className="text-center text-sm tabular-nums text-muted-foreground">×{q}</span>
                <span className={`text-right text-sm font-semibold tabular-nums ${inv ? "text-success line-through" : "text-foreground"}`}>{eur(precioEfectivo(id) * q)}</span>
              </button>
            );
          })}
        </div>
      </Desplazable>

      <footer className="flex items-center gap-2 border-t border-border p-4">
        <span className="text-sm text-muted-foreground">{nInv > 0 ? `${nInv} invitada${nInv === 1 ? "" : "s"}` : "Ninguna invitada"}</span>
        <button type="button" onClick={() => invitarTodo(false)} className="btn-ghost ml-auto">Quitar todo</button>
        <button type="button" onClick={() => invitarTodo(true)} className="rounded-full border border-success/40 bg-success/10 px-4 py-2 text-sm font-semibold text-success transition-transform active:scale-95">Invitar todo</button>
        <button type="button" onClick={onCerrar} className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition-transform active:scale-95">Hecho</button>
      </footer>
    </Modal>
  );
}
