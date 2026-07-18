import { Moon, Sun, ShoppingCart } from "lucide-react";
import { useTema } from "./lib/tema";

// STARTER de la SPA del TPV (Vite). No es la operativa final: es el lienzo con el
// sistema de diseño Gluuh ya cargado (tokens claro/oscuro, marca), listo para
// empezar a diseñar aquí. La operativa de apps/web/app/tpv se irá moviendo por
// fases (guía 22), sin romper el TPV Next que sigue de referencia.
export function App() {
  const { oscuro, alternar } = useTema();

  const demo = [
    { n: "Café solo", p: "1,20 €", c: "bg-brand text-brand-foreground" },
    { n: "Caña", p: "1,80 €", c: "bg-surface" },
    { n: "Tostada", p: "2,50 €", c: "bg-surface" },
    { n: "Zumo", p: "2,20 €", c: "bg-surface" },
    { n: "Croissant", p: "1,60 €", c: "bg-surface" },
    { n: "Bocadillo", p: "4,50 €", c: "bg-surface" },
  ];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-none items-center gap-3 bg-brand px-4 py-3 text-brand-foreground">
        <ShoppingCart size={22} />
        <h1 className="text-lg font-bold tracking-tight">Gluuh TPV</h1>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">Vite · React · Tailwind 4</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={alternar}
          className="flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
        >
          {oscuro ? <Sun size={16} /> : <Moon size={16} />} {oscuro ? "Claro" : "Oscuro"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Rejilla de productos (mock) — sitio donde se diseñará la venta */}
        <main className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-auto p-4 sm:grid-cols-4">
          {demo.map((d) => (
            <button
              key={d.n}
              type="button"
              className={`flex min-h-24 flex-col items-start justify-between rounded-lg border border-border p-3 text-left shadow-sm transition-transform active:scale-[.98] ${d.c}`}
            >
              <span className="font-semibold leading-tight">{d.n}</span>
              <span className="text-sm opacity-80 tabular-nums">{d.p}</span>
            </button>
          ))}
        </main>

        {/* Ticket (mock) — la comanda en curso */}
        <aside className="flex w-72 flex-none flex-col border-l border-border bg-surface">
          <div className="flex-1 space-y-2 overflow-auto p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ticket</p>
            <div className="flex justify-between text-sm"><span>1 · Café solo</span><span className="tabular-nums">1,20 €</span></div>
            <div className="flex justify-between text-sm"><span>2 · Caña</span><span className="tabular-nums">3,60 €</span></div>
          </div>
          <div className="flex-none border-t border-border p-4">
            <div className="mb-3 flex justify-between text-lg font-bold"><span>Total</span><span className="tabular-nums">4,80 €</span></div>
            <button type="button" className="btn-primary w-full">Cobrar</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
