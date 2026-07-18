import { useMemo, useState } from "react";
import { ArrowLeft, Trash2, Plus, Minus, CreditCard } from "lucide-react";
import { eur } from "../../lib/dinero";
import { CATEGORIAS_DEMO, PRODUCTOS_DEMO } from "./datos";

// Pantalla de VENTA (esqueleto funcional): rejilla de productos + ticket vivo +
// total + cobrar. La comanda es estado local demo; al cablear el motor real usa
// el catálogo del nodo y los módulos ya extraídos (precio/nombres/pagos/reparto).
// Reglas del TPV: sin hover, solo animación al pulsar.
export function Venta({
  contexto, comensales, onVolver, onCobrar,
}: Readonly<{ contexto: string; comensales?: number; onVolver: () => void; onCobrar: (total: number) => void }>) {
  const [catId, setCatId] = useState(CATEGORIAS_DEMO[0]!.id);
  const [comanda, setComanda] = useState<Record<string, number>>({});

  const productos = PRODUCTOS_DEMO.filter((p) => p.categoria === catId);
  const lineas = useMemo(
    () => Object.entries(comanda).map(([id, q]) => ({ p: PRODUCTOS_DEMO.find((x) => x.id === id)!, q })),
    [comanda],
  );
  const total = lineas.reduce((s, { p, q }) => s + p.precio * q, 0);

  const add = (id: string) => setComanda((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const menos = (id: string) => setComanda((c) => {
    const n = (c[id] ?? 0) - 1;
    const nc = { ...c };
    if (n <= 0) delete nc[id]; else nc[id] = n;
    return nc;
  });

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Productos ── */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Categorías */}
        <div className="no-scrollbar flex flex-none gap-2 overflow-x-auto border-b border-line px-6 py-3">
          {CATEGORIAS_DEMO.map((c) => {
            const activa = c.id === catId;
            return (
              <button key={c.id} type="button" onClick={() => setCatId(c.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-transform active:scale-95 ${activa ? "border-transparent bg-brand text-white" : "border-line bg-paper/5 text-muted"}`}>
                {c.nombre}
              </button>
            );
          })}
        </div>
        {/* Rejilla de productos */}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-auto p-6 sm:grid-cols-3 lg:grid-cols-4">
          {productos.map((p) => (
            <button key={p.id} type="button" onClick={() => add(p.id)}
              className="flex aspect-4/3 flex-col justify-between rounded-2xl border border-line bg-linear-165 from-panel-2 to-ink-2 p-4 text-left transition-transform active:scale-95">
              <span className="font-display font-semibold leading-tight text-paper">{p.nombre}</span>
              <span className="font-mono text-sm tabular-nums text-muted">{eur(p.precio)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Ticket ── */}
      <aside className="flex w-[360px] flex-none flex-col border-l border-line bg-panel/40">
        <header className="flex flex-none items-center gap-3 border-b border-line px-5 py-4">
          <button type="button" onClick={onVolver} aria-label="Volver al plano" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper/5 text-paper/80 transition-transform active:scale-90">
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <b className="block truncate font-display text-lg font-bold text-paper">{contexto}</b>
            {comensales != null && <small className="text-[12px] text-muted">{comensales} comensales</small>}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-1 overflow-auto p-4">
          {lineas.length === 0 && <p className="mt-8 text-center text-sm text-muted">Toca un producto para empezar la comanda.</p>}
          {lineas.map(({ p, q }) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm text-paper">{p.nombre}</span>
              <button type="button" onClick={() => menos(p.id)} aria-label="Quitar uno" className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted transition-transform active:scale-90"><Minus size={14} /></button>
              <span className="w-6 text-center font-mono text-sm font-semibold tabular-nums text-paper">{q}</span>
              <button type="button" onClick={() => add(p.id)} aria-label="Añadir uno" className="grid h-7 w-7 place-items-center rounded-md border border-line text-muted transition-transform active:scale-90"><Plus size={14} /></button>
              <span className="w-16 text-right font-mono text-sm tabular-nums text-paper">{eur(p.precio * q)}</span>
            </div>
          ))}
        </div>

        <footer className="flex-none border-t border-line p-4">
          <div className="mb-3 flex items-end justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              {lineas.length > 0 && (
                <button type="button" onClick={() => setComanda({})} className="flex items-center gap-1 text-[13px] transition-transform active:scale-95"><Trash2 size={13} /> Vaciar</button>
              )}
            </span>
            <span className="font-display text-3xl font-extrabold tabular-nums text-paper">{eur(total)}</span>
          </div>
          <button type="button" disabled={total <= 0} onClick={() => onCobrar(total)}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand py-4 font-display text-lg font-bold text-white transition-transform active:scale-[.98] disabled:opacity-40">
            <CreditCard size={20} /> Cobrar {total > 0 && eur(total)}
          </button>
        </footer>
      </aside>
    </div>
  );
}
