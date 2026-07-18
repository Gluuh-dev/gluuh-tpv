import { useMemo, useRef } from "react";
import { Search, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { eur } from "../../../lib/dinero";
import { CATEGORIAS_DEMO, PRODUCTOS_DEMO } from "../datos";
import { useVenta } from "../store";

// Columna derecha de la venta, FIEL al TPV de Next: buscador + flechas, fila de
// CATEGORÍAS en horizontal (pastillas de color por familia), y debajo la sección
// con la rejilla de productos (tiles de color).
export function PanelProductos() {
  const catSel = useVenta((s) => s.catSel);
  const busqueda = useVenta((s) => s.busqueda);
  const setCatSel = useVenta((s) => s.setCatSel);
  const setBusqueda = useVenta((s) => s.setBusqueda);
  const addProd = useVenta((s) => s.addProd);
  const prodRef = useRef<HTMLDivElement>(null);

  const buscando = busqueda.trim().length > 0;
  const catEf = catSel ?? CATEGORIAS_DEMO[0]!.id;
  const cat = CATEGORIAS_DEMO.find((c) => c.id === catEf);
  const productos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q) return PRODUCTOS_DEMO.filter((p) => p.nombre.toLowerCase().includes(q));
    return PRODUCTOS_DEMO.filter((p) => p.categoria === catEf);
  }, [busqueda, catEf]);

  const scroll = (dir: -1 | 1) => prodRef.current?.scrollBy({ top: dir * 220, behavior: "smooth" });

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Buscador + flechas */}
      <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2">
        <label className="relative flex flex-1 items-center">
          <Search size={16} className="absolute left-3 text-muted-foreground" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
        </label>
        <button type="button" onClick={() => scroll(-1)} aria-label="Arriba" className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-transform active:scale-90"><ChevronUp size={18} /></button>
        <button type="button" onClick={() => scroll(1)} aria-label="Abajo" className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-transform active:scale-90"><ChevronDown size={18} /></button>
      </div>

      {/* Categorías (horizontal, color por familia) */}
      <div className="no-scrollbar flex flex-none gap-2 overflow-x-auto border-b border-border p-2.5">
        {CATEGORIAS_DEMO.map((c) => {
          const sel = c.id === catEf && !buscando;
          return (
            <button key={c.id} type="button" onClick={() => setCatSel(c.id)}
              className={`flex min-h-[64px] w-[104px] flex-none items-end rounded-[9px] p-2.5 text-left transition-transform active:scale-95 ${sel ? "ring-2 ring-inset ring-white/90" : ""}`}
              style={{ background: c.color, color: "#fff" }}>
              <span className="text-[12px] font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">{c.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* Sección + productos */}
      <div className="flex flex-none items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{buscando ? "Resultados" : cat?.nombre}</span>
      </div>
      <div ref={prodRef} className="no-scrollbar grid flex-1 auto-rows-min content-start gap-2 overflow-auto p-3"
        style={{ gridTemplateColumns: "repeat(auto-fill,minmax(124px,1fr))" }}>
        {productos.map((p) => (
          <button key={p.id} type="button" onClick={() => addProd(p.id)}
            className="flex min-h-[86px] flex-col justify-between rounded-[9px] p-2.5 text-left shadow-[0_2px_0_rgba(0,0,0,.28)] transition-transform active:translate-y-px active:scale-[.98]"
            style={{ background: CATEGORIAS_DEMO.find((c) => c.id === p.categoria)?.color ?? "#64748b", color: "#fff" }}>
            <span className="text-[12px] font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">{p.nombre}</span>
            <span className="text-sm font-semibold tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">{eur(p.precio)}</span>
          </button>
        ))}
        {!buscando && (
          <button type="button" className="flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-[9px] border-2 border-dashed border-border text-muted-foreground transition-transform active:scale-95">
            <Plus size={22} /> <span className="text-xs font-semibold">Nuevo</span>
          </button>
        )}
        {productos.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>}
      </div>
    </div>
  );
}
