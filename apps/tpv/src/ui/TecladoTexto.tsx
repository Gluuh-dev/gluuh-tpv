import { useState } from "react";
import { ArrowBigUp, Check, Delete, Space } from "lucide-react";

// Teclado QWERTY EN PANTALLA: para TPVs sin teclado físico. Overlay centrado que
// escribe sobre un campo de texto (alias, notas, búsqueda…). `valor`/`onCambio`
// son la fuente de verdad; el componente no guarda el texto, solo lo edita.
const FILAS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m", "@", ".", "-"],
];

export function TecladoTexto({
  valor, onCambio, onCerrar, titulo,
}: Readonly<{ valor: string; onCambio: (v: string) => void; onCerrar: () => void; titulo?: string }>) {
  const [mays, setMays] = useState(false);
  const tecla = (t: string) => { onCambio(valor + (mays ? t.toUpperCase() : t)); if (mays) setMays(false); };

  const btn = "grid min-h-13 min-w-11 flex-1 place-items-center rounded-md border border-border bg-surface text-lg font-semibold text-foreground transition-transform active:scale-95";

  return (
    <div className="gl-velo fixed inset-0 z-50 flex flex-col justify-end bg-black/25 backdrop-blur-[1.5px]" onClick={onCerrar}>
      <div className="gl-aparecer mx-auto w-full max-w-[880px] rounded-t-xl bg-panel p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          {titulo && <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{titulo}</span>}
          <div className="ml-auto flex min-h-11 flex-1 items-center rounded-md border border-border bg-background px-3 text-base font-semibold">
            <span className="truncate">{valor || <span className="text-muted-foreground">Escribe…</span>}</span>
            <span className="ml-0.5 inline-block h-5 w-px animate-pulse bg-foreground" />
          </div>
          <button type="button" onClick={onCerrar} className="flex min-h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-bold text-white transition-transform active:scale-95"><Check size={17} /> Listo</button>
        </div>

        <div className="flex flex-col gap-1.5">
          {FILAS.map((fila, i) => (
            <div key={i} className="flex gap-1.5" style={{ paddingInline: `${i * 14}px` }}>
              {i === 3 && (
                <button type="button" onClick={() => setMays((v) => !v)} aria-label="Mayúsculas"
                  className={`grid min-h-13 place-items-center rounded-md border px-3 transition-transform active:scale-95 ${mays ? "border-brand bg-brand text-white" : "border-border bg-surface text-foreground"}`}><ArrowBigUp size={20} /></button>
              )}
              {fila.map((t) => (
                <button key={t} type="button" onClick={() => tecla(t)} className={btn}>{mays ? t.toUpperCase() : t}</button>
              ))}
              {i === 3 && (
                <button type="button" onClick={() => onCambio(valor.slice(0, -1))} aria-label="Borrar"
                  className="grid min-h-13 place-items-center rounded-md border border-border bg-surface px-3 text-foreground transition-transform active:scale-95"><Delete size={20} /></button>
              )}
            </div>
          ))}
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onCambio("")} className="grid min-h-13 min-w-20 place-items-center rounded-md border border-border bg-surface text-sm font-bold text-muted-foreground transition-transform active:scale-95">Limpiar</button>
            <button type="button" onClick={() => tecla(" ")} aria-label="Espacio" className="grid min-h-13 flex-1 place-items-center rounded-md border border-border bg-surface text-foreground transition-transform active:scale-95"><Space size={22} /></button>
            <button type="button" onClick={onCerrar} className="grid min-h-13 min-w-20 place-items-center rounded-md bg-brand text-sm font-bold text-white transition-transform active:scale-95">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
