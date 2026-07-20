import { useMemo, useRef } from "react";
import { Plus, Check } from "lucide-react";
import { CATEGORIAS_DEMO, PRODUCTOS_DEMO, colorCategoria } from "../datos";
import { BotonProducto } from "./BotonProducto";
import { Flechas } from "../../../ui";
import { useVenta } from "../store";

function Banda({ children, color, contenedor }: Readonly<{ children: React.ReactNode; color?: string; contenedor: React.RefObject<HTMLDivElement | null> }>) {
  return (
    <div className="flex flex-none items-center justify-between border-b border-border bg-surface px-3 py-1" style={color ? { borderLeft: `4px solid ${color}` } : undefined}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</span>
      <Flechas contenedor={contenedor} />
    </div>
  );
}

// Columna derecha de la venta (familias + artículos), como en el TPV de Next.
// El buscador vive en el navbar; aquí solo las rejillas con sus flechas.
export function PanelProductos() {
  const catSel = useVenta((s) => s.catSel);
  const busqueda = useVenta((s) => s.busqueda);
  const setCatSel = useVenta((s) => s.setCatSel);
  const addProd = useVenta((s) => s.addProd);
  const catRef = useRef<HTMLDivElement>(null);
  const prodRef = useRef<HTMLDivElement>(null);

  const buscando = busqueda.trim().length > 0;
  const catEf = catSel ?? CATEGORIAS_DEMO[0]!.id;
  const cat = CATEGORIAS_DEMO.find((c) => c.id === catEf);
  const productos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q) return PRODUCTOS_DEMO.filter((p) => p.nombre.toLowerCase().includes(q));
    return PRODUCTOS_DEMO.filter((p) => p.categoria === catEf);
  }, [busqueda, catEf]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Familias */}
      <Banda contenedor={catRef}>Familias</Banda>
      <div ref={catRef} className="no-scrollbar grid h-2/5 flex-none auto-rows-min content-start gap-2 overflow-auto p-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))" }}>
        {CATEGORIAS_DEMO.map((c) => {
          const sel = c.id === catEf && !buscando;
          return (
            <button key={c.id} type="button" onClick={() => setCatSel(c.id)}
              className={`relative flex min-h-[76px] flex-col justify-end rounded-[9px] p-2 text-left transition-transform active:scale-95 ${sel ? "ring-2 ring-inset ring-white/95" : ""}`}
              style={{ background: c.color, color: "#fff" }}>
              {sel && <Check size={18} strokeWidth={3} className="absolute right-1.5 top-1.5" />}
              <span className="text-[12px] font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.45)]">{c.nombre}</span>
            </button>
          );
        })}
      </div>

      {/* Artículos */}
      <Banda contenedor={prodRef} color={cat?.color}>{buscando ? "Resultados" : cat?.nombre}</Banda>
      <div ref={prodRef} className="no-scrollbar grid flex-1 auto-rows-min content-start gap-2 overflow-auto p-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))" }}>
        {productos.map((p) => (
          <BotonProducto key={p.id} nombre={p.nombre} precio={p.precio}
            color={p.color ?? colorCategoria(p.categoria)} foto={p.foto} icono={p.icono}
            onClick={() => addProd(p.id)} />
        ))}
        {!buscando && (
          <button type="button" className="flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-[9px] border-2 border-dashed border-border text-muted-foreground transition-transform active:scale-95">
            <Plus size={20} /> <span className="text-[11px] font-semibold">Nuevo</span>
          </button>
        )}
        {productos.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>}
      </div>
    </div>
  );
}
