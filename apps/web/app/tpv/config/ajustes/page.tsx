"use client";

// AJUSTES DEL TERMINAL dentro del TPV: preferencias LOCALES de este aparato
// (tema claro/oscuro, modo zurdo). Son de este terminal, no del tenant — por eso
// viven en el tema del sistema (next-themes) y en la store del TPV (localStorage),
// exactamente donde el TPV ya las lee.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun, Hand } from "lucide-react";
import { NavbarTPV } from "../../components/NavbarTPV";
import { useTpvStore } from "../../hooks/useTpvStore";

export default function AjustesTPV() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const modoZurdo = useTpvStore((s) => s.modoZurdo);
  const setModoZurdo = useTpvStore((s) => s.setModoZurdo);
  // next-themes necesita montar antes de saber el tema real (evita el flash SSR).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const oscuro = montado && resolvedTheme === "dark";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <NavbarTPV operario="Configuración" subtitulo="Ajustes del terminal">
        <h1 className="flex-none text-lg font-bold tracking-tight">Ajustes del terminal</h1>
        <span className="flex-1" />
        <button type="button" onClick={() => router.push("/tpv/config")}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <ArrowLeft size={16} /> Configuración
        </button>
      </NavbarTPV>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 overflow-y-auto p-4">
        <button type="button" onClick={() => setTheme(oscuro ? "light" : "dark")}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand/40 active:scale-[.99]">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-brand/10 text-brand">{oscuro ? <Moon size={24} /> : <Sun size={24} />}</span>
          <span className="min-w-0 flex-1">
            <b className="block text-base">Tema {oscuro ? "oscuro" : "claro"}</b>
            <span className="text-sm text-muted-foreground">Toca para cambiar a {oscuro ? "claro" : "oscuro"}. La operativa está pensada en claro.</span>
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${oscuro ? "bg-brand text-white" : "bg-surface text-muted-foreground"}`}>{oscuro ? "Oscuro" : "Claro"}</span>
        </button>

        <button type="button" onClick={() => setModoZurdo(!modoZurdo)}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand/40 active:scale-[.99]">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-brand/10 text-brand"><Hand size={24} /></span>
          <span className="min-w-0 flex-1">
            <b className="block text-base">Modo zurdo</b>
            <span className="text-sm text-muted-foreground">El ticket y el teclado pasan al lado derecho de la pantalla de venta.</span>
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${modoZurdo ? "bg-brand text-white" : "bg-surface text-muted-foreground"}`}>{modoZurdo ? "Activo" : "No"}</span>
        </button>

        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          La configuración de impresoras y rutas de impresión se gestiona en el panel
          (Impresoras); los módulos, desde Utilidades → Módulos.
        </p>
      </div>
    </div>
  );
}
