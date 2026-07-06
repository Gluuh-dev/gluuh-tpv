"use client";

// Buscador con sugerencias para AÑADIR elementos a una lista (patrón Ágora
// "Buscar (F3) y añadir"): al teclear filtra las opciones y al elegir una
// llama a onAnadir. Se usa en fichas de familia/categoría/producto/grupo mayor.
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface OpcionAnadir { id: string; etiqueta: string; extra?: string }

export function BuscarAnadir({
  opciones,
  onAnadir,
  placeholder = "Buscar y añadir…",
}: Readonly<{ opciones: OpcionAnadir[]; onAnadir: (id: string) => void; placeholder?: string }>) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const term = q.trim().toLowerCase();
  const lista = term ? opciones.filter((o) => o.etiqueta.toLowerCase().includes(term)).slice(0, 8) : [];

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={placeholder}
        />
      </div>
      {abierto && lista.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {lista.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onAnadir(o.id); setQ(""); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">{o.etiqueta}</span>
              {o.extra && <span className="shrink-0 text-xs text-muted-foreground">{o.extra}</span>}
            </button>
          ))}
        </div>
      )}
      {abierto && term && lista.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          Sin resultados.
        </div>
      )}
    </div>
  );
}
