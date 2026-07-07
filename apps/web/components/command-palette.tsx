"use client";

// Buscador global del panel (estilo Supabase): botón en la cabecera + atajo
// Ctrl/⌘+K → modal centrado que busca en TODO: páginas del panel (lib/nav) y
// datos (productos, familias, categorías). Teclado ↑↓ Enter Esc. Sin dependencias.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { NAV } from "@/app/lib/nav";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";

interface Item { tipo: string; label: string; sub?: string; href: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Páginas del panel (estáticas, desde el menú); una por href.
const PAGINAS: Item[] = Array.from(
  new Map(
    NAV.flatMap((e) =>
      e.sections.flatMap((s) =>
        s.items
          .filter((i) => i.href && !i.soon)
          .map((i) => ({ tipo: "Página", label: i.label, sub: e.title, href: i.href! })),
      ),
    ).map((p) => [p.href, p]),
  ).values(),
);

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [datos, setDatos] = useState<Item[]>([]);
  const [cargado, setCargado] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const esMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  // Atajo global Ctrl/⌘+K.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Índice de datos: se carga la primera vez que se abre.
  useEffect(() => {
    if (!open || cargado) return;
    (async () => {
      const sb = supabaseBrowser();
      const [{ data: p }, { data: f }, { data: c }] = await Promise.all([
        sb.from("product").select("id,nombre").order("nombre").limit(2000),
        sb.from("family").select("id,nombre").order("nombre"),
        sb.from("category").select("id,nombre").order("nombre"),
      ]);
      const map = (arr: unknown, tipo: string, ruta: string): Item[] =>
        ((arr as { id: string; nombre: string }[] | null) ?? []).map((x) => ({ tipo, label: x.nombre, href: `${ruta}/${x.id}` }));
      setDatos([...map(p, "Producto", "/productos"), ...map(f, "Familia", "/familias"), ...map(c, "Categoría", "/categorias")]);
      setCargado(true);
    })();
  }, [open, cargado]);

  useEffect(() => {
    if (open) { const t = setTimeout(() => inputRef.current?.focus(), 30); return () => clearTimeout(t); }
    setQ(""); setSel(0);
  }, [open]);

  const resultados = useMemo(() => {
    const term = norm(q.trim());
    if (!term) return PAGINAS.slice(0, 8); // sin texto: accesos rápidos a páginas
    const todo = [...PAGINAS, ...datos];
    return todo.filter((i) => norm(i.label).includes(term) || (i.sub ? norm(i.sub).includes(term) : false)).slice(0, 50);
  }, [q, datos]);

  useEffect(() => { setSel(0); }, [q]);

  const irA = useCallback((i: Item) => { setOpen(false); router.push(i.href); }, [router]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = resultados[sel]; if (it) irA(it); }
  }

  return (
    <>
      {/* Disparador en la cabecera */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 items-center gap-2 rounded-md border border-border bg-(--search-bg) px-2.5 text-[13px] text-(--text-muted) transition-colors hover:text-foreground"
        aria-label="Buscar (Ctrl+K)"
        title="Buscar en todo"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Buscar…</span>
        <kbd className="hidden rounded border border-border bg-surface px-1 font-mono text-[10px] md:inline">{esMac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Buscar en el panel"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Buscar páginas, productos, familias, categorías…"
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Buscar"
              />
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-1.5">
              {resultados.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Sin resultados para «{q}».</p>
              ) : (
                resultados.map((i, idx) => (
                  <button
                    key={`${i.href}-${idx}`}
                    type="button"
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => irA(i)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm ${idx === sel ? "bg-surface-muted text-foreground" : "text-(--text-secondary)"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{i.label}</span>
                    {i.sub && <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{i.sub}</span>}
                    <span className="shrink-0 rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{i.tipo}</span>
                    {idx === sel && <CornerDownLeft className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              <span><kbd className="font-mono">↑↓</kbd> moverse</span>
              <span><kbd className="font-mono">↵</kbd> abrir</span>
              <span><kbd className="font-mono">Esc</kbd> cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
