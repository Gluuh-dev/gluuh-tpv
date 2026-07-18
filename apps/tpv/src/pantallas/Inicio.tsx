import { useEffect, useState, type ReactNode } from "react";
import {
  MonitorSmartphone, Settings2, BarChart3, Users, Share2,
  ArrowRight, LogOut, LifeBuoy, Printer, Wifi, Sun, Moon,
} from "lucide-react";
import type { Vista } from "../nav";
import { useTema } from "../lib/tema";

// ── Pentágono de marca (el motivo de los iconos del mockup) ──────────────────
const PENTA = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
const MARCA = "linear-gradient(160deg,#7c3d9b,#4a1e63)";

function Pentagono({ children, fondo, tam = 56 }: Readonly<{ children: ReactNode; fondo: string; tam?: number }>) {
  return (
    <span className="grid place-items-center text-white" style={{ width: tam, height: tam, background: fondo, clipPath: PENTA }}>
      {children}
    </span>
  );
}

function Fkey({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="rounded-md bg-foreground/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted-foreground">{children}</span>;
}

function PillEstado({ color, children }: Readonly<{ color: string; children: ReactNode }>) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-overlay px-3 py-1.5 text-[13px] font-medium text-secondary-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {children}
    </span>
  );
}

// ── Tarjeta secundaria (Configuración / Análisis / Administrador / Visor) ─────
function Tarjeta({
  fkey, icono, iconoFondo, titulo, insignia, desc, pie, onClick,
}: Readonly<{
  fkey: string; icono: ReactNode; iconoFondo: string; titulo: string;
  insignia?: { texto: string; color: string }; desc: string; pie: string; onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:border-border-strong hover:bg-surface-overlay active:scale-[.995]"
    >
      <div className="absolute right-5 top-5"><Fkey>{fkey}</Fkey></div>
      <Pentagono fondo={iconoFondo} tam={52}>{icono}</Pentagono>
      <div className="mt-5 flex items-center gap-2">
        <h3 className="text-xl font-bold text-foreground">{titulo}</h3>
        {insignia && (
          <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: `${insignia.color}22`, color: insignia.color }}>
            {insignia.texto}
          </span>
        )}
      </div>
      <p className="mt-2 max-w-[34ch] text-[15px] leading-snug text-muted-foreground">{desc}</p>
      <p className="mt-auto pt-6 text-[13px] text-muted-foreground/70">{pie}</p>
    </button>
  );
}

interface Props {
  local: { nombre: string; terminal: string };
  turno: { mesasAbiertas: number; mesasTotal: number; ventas: string; comandas: number };
  onNavegar: (v: Exclude<Vista, "inicio">) => void;
  onSalir: () => void;
}

// El Inicio es ANÓNIMO: aquí no hay nadie logueado. La identidad del trabajador se
// pide al ENTRAR en cada apartado (Config/Análisis/Admin/Visor Node) con su PIN;
// «Abrir TPV» entra directo y el login por operario ocurre dentro del TPV, por
// acción (por si hay varios trabajadores en el mismo terminal).
export function Inicio({ local, turno, onNavegar, onSalir }: Readonly<Props>) {
  const { oscuro, alternar } = useTema();
  const [hora, setHora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  const hhmm = hora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const h = hora.getHours();
  let saludo = "Buenas noches";
  if (h >= 6 && h < 14) saludo = "Buenos días";
  else if (h >= 14 && h < 21) saludo = "Buenas tardes";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Textura de rejilla sutil (se adapta al tema vía currentColor) */}
      <div
        className="pointer-events-none absolute inset-0 text-foreground opacity-[.04]"
        style={{
          backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-130 w-130 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3d9baa, transparent 70%)" }}
      />

      {/* ── Cabecera ── */}
      <header className="relative z-10 flex flex-none items-center gap-4 px-8 pt-6">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: MARCA }}>
          <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-7 w-7" />
        </span>
        <div className="mr-auto">
          <h1 className="text-lg font-black leading-none tracking-tight">Gluuh TPV</h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[.15em] text-muted-foreground">
            {local.nombre} · {local.terminal}
          </p>
        </div>
        <PillEstado color="#34b476"><Wifi size={14} /> Node conectado</PillEstado>
        <PillEstado color="#e0a83b"><Printer size={14} /> Impresora cocina: sin papel</PillEstado>
        <span className="rounded-full border border-border bg-surface-overlay px-3.5 py-1.5 text-[13px] font-semibold tabular-nums text-secondary-foreground">{hhmm}</span>
        <button
          type="button"
          onClick={alternar}
          aria-label="Cambiar tema"
          className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-overlay text-secondary-foreground hover:bg-surface-muted"
        >
          {oscuro ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      {/* ── Saludo (anónimo: el equipo del local) ── */}
      <div className="relative z-10 flex-none px-8 pb-2 pt-6">
        <h2 className="text-3xl font-black tracking-tight">
          {saludo}, <span className="text-brand">Equipo de {local.nombre}</span>.
          <span className="ml-3 align-middle text-base font-medium text-muted-foreground">Elige por dónde empezar. Puedes usar las teclas F1 a F5.</span>
        </h2>
      </div>

      {/* ── Rejilla del hub ── */}
      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-4 px-8 pb-4 pt-4">
        {/* Abrir TPV — carta grande a la izquierda (entra DIRECTO, sin PIN) */}
        <button
          type="button"
          onClick={() => onNavegar("tpv")}
          className="group relative col-span-1 row-span-2 flex flex-col overflow-hidden rounded-2xl border border-[#8a55a8]/30 p-8 text-left text-white transition-transform active:scale-[.995]"
          style={{ background: "linear-gradient(155deg,#6a2d87 0%,#4a1e63 55%,#3a1650 100%)" }}
        >
          <div className="absolute right-6 top-6"><span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/60">F1</span></div>
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 opacity-[.13]" style={{ background: "#fff", clipPath: PENTA }} />
          <Pentagono fondo="rgba(255,255,255,.14)" tam={72}><MonitorSmartphone size={34} /></Pentagono>
          <h3 className="mt-6 text-5xl font-black leading-none tracking-tight">Abrir TPV</h3>
          <p className="mt-4 max-w-[28ch] text-lg leading-snug text-white/70">Mesas, barra, comandas y cobros del turno de hoy.</p>

          <div className="mt-auto">
            <div className="flex items-end gap-8">
              <div><p className="text-3xl font-black tabular-nums">{turno.mesasAbiertas}/{turno.mesasTotal}</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Mesas abiertas</p></div>
              <div><p className="text-3xl font-black tabular-nums">{turno.ventas}</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Ventas del turno</p></div>
              <div><p className="text-3xl font-black tabular-nums">{turno.comandas}</p><p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Comandas en cocina</p></div>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-[#3a1650] transition-transform group-hover:gap-3">
              Entrar al turno <ArrowRight size={18} />
            </span>
          </div>
        </button>

        <Tarjeta
          fkey="F2" iconoFondo={MARCA} icono={<Settings2 size={26} />}
          titulo="Configuración" desc="Carta, precios, salas y mesas, impresoras, métodos de pago e impuestos."
          pie="Última edición: ayer, 18:42" onClick={() => onNavegar("config")}
        />
        <Tarjeta
          fkey="F3" iconoFondo={MARCA} icono={<BarChart3 size={26} />}
          titulo="Análisis" desc="Ventas por hora, platos más vendidos, tickets medios y cierres de caja."
          pie="Ayer: 1.842,10 € · +8,4 %" onClick={() => onNavegar("analisis")}
        />
        <Tarjeta
          fkey="F4" iconoFondo={MARCA} icono={<Users size={26} />}
          titulo="Administrador" insignia={{ texto: "Equipo Gluuh", color: "#7c3d9b" }}
          desc="Empleados, turnos, permisos, licencias y ajustes avanzados del local."
          pie="Requiere PIN de administrador" onClick={() => onNavegar("admin")}
        />
        <Tarjeta
          fkey="F5" iconoFondo="linear-gradient(160deg,#34b476,#1f7a4e)" icono={<Share2 size={26} />}
          titulo="Visor Node" insignia={{ texto: "activo", color: "#2ea06a" }}
          desc="Estado del servidor, dispositivos conectados, colas de impresión y registro."
          pie="4 terminales · 128 ms · v2.4.1" onClick={() => onNavegar("nodo")}
        />
      </main>

      {/* ── Pie ── */}
      <footer className="relative z-10 flex flex-none items-center gap-4 px-8 pb-5 pt-1 text-[13px] text-muted-foreground">
        <span className="font-mono">Gluuh TPV v3.2.0 · Licencia LA-ALAMEDA-0417</span>
        <button type="button" onClick={onSalir} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-semibold text-secondary-foreground hover:bg-surface-overlay"><LogOut size={14} /> Salir</button>
        <button type="button" className="ml-auto flex items-center gap-2 rounded-full bg-[#f0b429] px-5 py-2.5 font-bold text-[#3a2c07] hover:brightness-105">
          <LifeBuoy size={16} /> Ayuda y soporte técnico
        </button>
      </footer>
    </div>
  );
}
