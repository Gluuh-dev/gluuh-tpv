import { useMemo } from "react";
import { Check } from "lucide-react";
import { eur } from "../../../lib/dinero";
import { CATEGORIAS_DEMO, PRODUCTOS_DEMO, colorCategoria } from "../datos";
import { useVenta } from "../store";

// Columna derecha de la venta: rejilla de CATEGORÍAS (arriba, 2/5) + rejilla de
// PRODUCTOS (abajo). Colores por categoría, como las familias del Next.
export function PanelProductos() {
  const catSel = useVenta((s) => s.catSel);
  const busqueda = useVenta((s) => s.busqueda);
  const setCatSel = useVenta((s) => s.setCatSel);
  const addProd = useVenta((s) => s.addProd);

  const buscando = busqueda.trim().length > 0;
  const catEf = catSel ?? CATEGORIAS_DEMO[0]!.id;
  const productos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q) return PRODUCTOS_DEMO.filter((p) => p.nombre.toLowerCase().includes(q));
    return PRODUCTOS_DEMO.filter((p) => p.categoria === catEf);
  }, [busqueda, catEf]);
  const cat = CATEGORIAS_DEMO.find((c) => c.id === catEf);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Categorías */}
      <div className="no-scrollbar grid h-2/5 flex-none auto-rows-min content-start gap-2 overflow-auto border-b border-border p-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))" }}>
        {CATEGORIAS_DEMO.map((c) => {
          const sel = c.id === catEf && !buscando;
          return (
            <button key={c.id} type="button" onClick={() => setCatSel(c.id)}
              className={`relative flex min-h-[76px] items-end overflow-hidden rounded-[9px] p-2 text-left transition-transform active:scale-95 ${sel ? "ring-2 ring-inset ring-white/95" : ""}`}
              style={{ background: c.color, color: "#fff" }}>
              {sel && <Check size={18} className="absolute right-1.5 top-1.5" strokeWidth={3} />}
              <span className="text-xs font-bold uppercase leading-tight tracking-wide [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">{c.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* Cabecera de la categoría activa */}
      {!buscando && cat && (
        <div className="flex flex-none items-center gap-2 border-b border-border bg-surface px-3 py-1.5" style={{ borderLeft: `4px solid ${cat.color}` }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat.nombre}</span>
        </div>
      )}

      {/* Productos */}
      <div className="no-scrollbar grid flex-1 auto-rows-min content-start gap-2 overflow-auto p-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))" }}>
        {productos.map((p) => (
          <button key={p.id} type="button" onClick={() => addProd(p.id)}
            className="flex min-h-[78px] flex-col justify-between rounded-[9px] p-2 text-left shadow-[0_2px_0_rgba(0,0,0,.28)] transition-transform active:translate-y-px active:scale-[.98]"
            style={{ background: colorCategoria(p.categoria), color: "#fff" }}>
            <span className="text-xs font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">{p.nombre}</span>
            <span className="text-sm font-semibold tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">{eur(p.precio)}</span>
          </button>
        ))}
        {productos.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>}
      </div>
    </div>
  );
}
