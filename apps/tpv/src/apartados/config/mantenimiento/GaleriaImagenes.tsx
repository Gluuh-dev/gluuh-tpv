import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Desplazable } from "../../../ui";
import { refDeFoto, type FotoGaleria } from "../../../lib/galeria";

// Selector de fotos de la galería (las que vienen dentro de la app). Buscador +
// rejilla de miniaturas agrupada por categoría; al tocar una, devuelve su
// referencia estable. Reutilizable en «Aspecto» de artículo y de familia.

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function GaleriaImagenes({ fotos, actual, onElegir }: Readonly<{
  fotos: FotoGaleria[];
  /** Valor actual de `foto` (para marcar la elegida). */
  actual?: string;
  onElegir: (ref: string) => void;
}>) {
  const [q, setQ] = useState("");

  const grupos = useMemo(() => {
    const nq = norm(q.trim());
    const filtradas = nq ? fotos.filter((f) => norm(`${f.grupo} ${f.nombre}`).includes(nq)) : fotos;
    const m = new Map<string, FotoGaleria[]>();
    for (const f of filtradas) { const l = m.get(f.grupo) ?? []; l.push(f); m.set(f.grupo, l); }
    return [...m.entries()];
  }, [fotos, q]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="relative flex-none">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar foto…"
          className="h-8 w-full rounded-[5px] border border-line bg-background pl-8 pr-3 text-[12.5px] text-paper outline-none placeholder:text-muted focus:border-brand-lit" />
      </div>
      <Desplazable fuera="min-h-0 flex-1 rounded-[6px] border border-line bg-panel-2/40">
        <div className="flex flex-col gap-3 p-2">
          {grupos.map(([grupo, lista]) => (
            <div key={grupo}>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">{grupo}</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                {lista.map((f) => {
                  const on = actual === refDeFoto(f);
                  return (
                    <button key={f.id} type="button" title={f.nombre} aria-pressed={on}
                      onClick={() => onElegir(refDeFoto(f))}
                      className={`aspect-[4/3] overflow-hidden rounded-[6px] border-2 transition-transform active:scale-95 ${
                        on ? "border-brand-lit" : "border-transparent"
                      }`}>
                      <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {grupos.length === 0 && <p className="py-8 text-center text-[13px] text-muted">Sin fotos que coincidan.</p>}
        </div>
      </Desplazable>
    </div>
  );
}
