"use client";

// Avatar del usuario en el navbar con popup: cabecera (avatar + nombre + rol),
// selector de tema (claro/oscuro de la superficie panel) y cerrar sesión.
// Dropdown propio (sin dependencias): click-fuera y Escape lo cierran.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { useSurfaceTheme } from "@/app/lib/surface-theme";

const iniciales = (s: string) => s.trim().split(/[\s@.]+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";

export function UserMenu({ nombre, rol, email }: Readonly<{ nombre?: string; rol?: string; email?: string }>) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setSurfaceTheme } = useSurfaceTheme("panel");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [open]);

  const etiqueta = nombre || email || "Usuario";
  const dark = resolvedTheme === "dark";

  async function salir() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }

  const temaBtn = (activo: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[12.5px] transition-colors ${
      activo ? "border-brand bg-brand/10 font-medium text-foreground" : "border-border text-muted-foreground hover:bg-surface-overlay"
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={etiqueta}
        className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition-colors hover:bg-surface-overlay"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">{iniciales(etiqueta)}</span>
        <span className="hidden max-w-32 truncate text-[13px] font-medium sm:inline">{nombre || email}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-brand-foreground">{iniciales(etiqueta)}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{nombre || email}</div>
              {rol && <div className="truncate text-[11px] capitalize text-muted-foreground">{rol.toLowerCase()}</div>}
            </div>
          </div>

          <div className="p-1.5">
            <div className="px-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Tema</div>
            {mounted ? (
              <div className="flex gap-1">
                <button type="button" onClick={() => setSurfaceTheme("light")} className={temaBtn(!dark)}>
                  <Sun className="h-3.5 w-3.5" /> Claro
                </button>
                <button type="button" onClick={() => setSurfaceTheme("dark")} className={temaBtn(dark)}>
                  <Moon className="h-3.5 w-3.5" /> Oscuro
                </button>
              </div>
            ) : <div className="h-8" />}
          </div>

          <div className="border-t border-border p-1.5">
            <button
              type="button"
              onClick={() => void salir()}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
