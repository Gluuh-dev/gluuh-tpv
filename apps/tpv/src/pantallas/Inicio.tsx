import { useEffect, useState, type ReactNode } from "react";
import {
  MonitorSmartphone, Settings2, BarChart3, Users, Share2,
  ArrowRight, LogOut, LifeBuoy, Printer, Wifi, Sun, Moon,
} from "lucide-react";
import type { Vista } from "../nav";
import { useTema } from "../lib/tema";
import { Marca } from "../componentes/Marca";

// REGLAS del TPV (táctil): sin `hover`, solo animación al pulsar (`active:`);
// sombras al mínimo.

function Chip({ dot, warn, children }: Readonly<{ dot?: boolean; warn?: boolean; children: ReactNode }>) {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-paper/5 px-3.5 py-2 font-mono text-[12.5px] text-paper/90">
      {dot && <span className={`h-2 w-2 rounded-full ${warn ? "bg-amber" : "bg-mint"}`} style={{ boxShadow: `0 0 0 4px ${warn ? "rgba(245,166,35,.16)" : "rgba(63,216,164,.16)"}` }} />}
      {children}
    </span>
  );
}

// Placa con la silueta del ESCUDO del logo (icono dentro).
function Escudo({ children, fondo, tam = 56 }: Readonly<{ children: ReactNode; fondo: string; tam?: number }>) {
  return <span className="escudo grid place-items-center text-white" style={{ width: tam, height: tam, background: fondo }}>{children}</span>;
}

function Tarjeta({
  fkey, icono, placa, titulo, insignia, desc, meta, onClick,
}: Readonly<{
  fkey: string; icono: ReactNode; placa: string; titulo: string;
  insignia?: { texto: string; tono: "mint" | "lock" }; desc: string; meta: string; onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col gap-2.5 overflow-hidden rounded-3xl border border-line bg-linear-165 from-panel-2 to-ink-2 p-[22px] text-left transition-transform duration-150 active:scale-[.97]"
    >
      <span className="absolute right-4 top-4 rounded-md border border-line bg-black/10 px-1.5 py-0.5 font-mono text-[11px] text-muted">{fkey}</span>
      <Escudo fondo={placa} tam={56}>{icono}</Escudo>
      <h3 className="mt-1.5 flex items-center font-display text-[19px] font-semibold tracking-tight text-paper">
        {titulo}
        {insignia && (
          <span className={`ml-2 rounded-full border px-2 py-0.5 font-mono text-[11px] ${insignia.tono === "mint" ? "border-mint/35 bg-mint/10 text-mint" : "border-brand-lit/30 bg-brand-lit/10 text-brand-lit"}`}>
            {insignia.texto}
          </span>
        )}
      </h3>
      <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-muted">{desc}</p>
      <span className="mt-auto font-mono text-[11.5px] tracking-wide text-muted/80">{meta}</span>
    </button>
  );
}

interface Props {
  local: { nombre: string; terminal: string };
  turno: { mesasAbiertas: number; mesasTotal: number; ventas: string; comandas: number };
  onNavegar: (v: Exclude<Vista, "inicio">) => void;
  onSalir: () => void;
  onAyuda: () => void;
}

// El Inicio es ANÓNIMO: nadie logueado. La identidad se pide al entrar en cada
// apartado (PIN o pulsera); «Abrir TPV» entra directo (login por operario dentro).
export function Inicio({ local, turno, onNavegar, onSalir, onAyuda }: Readonly<Props>) {
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
    <div className="relative mx-auto flex h-screen max-w-[1500px] flex-col gap-[18px] px-[clamp(18px,3vw,40px)] pb-4 pt-5 text-paper">
      {/* ── Barra superior ── */}
      <header className="flex items-center gap-[18px]">
        <div className="flex min-w-0 items-center gap-3.5">
          <Marca className="h-[52px] w-auto" alt="Gluuh" />
          <div>
            <h1 className="font-display text-[23px] font-extrabold leading-none tracking-tight">Gluuh TPV</h1>
            <span className="mt-1.5 block text-[12px] uppercase tracking-[.14em] text-muted">{local.nombre} · {local.terminal}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <Chip dot><Wifi size={13} /> Node conectado</Chip>
          <Chip dot warn><Printer size={13} /> Impresora cocina: sin papel</Chip>
          <Chip><span className="text-[14px] font-semibold tracking-wide">{hhmm}</span></Chip>
          <button type="button" onClick={alternar} aria-label="Cambiar tema"
            className="grid h-[42px] w-[42px] place-items-center rounded-full border border-line bg-paper/5 text-paper/80 transition-transform active:scale-90">
            {oscuro ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ── Saludo (anónimo, sin nombre del negocio) ── */}
      <div>
        <h2 className="font-display text-[clamp(22px,2.4vw,32px)] font-semibold tracking-tight">
          {saludo}, <em className="not-italic text-brand-lit">Equipo</em>.
        </h2>
        <p className="mt-1.5 text-sm text-muted">Elige por dónde empezar. Puedes usar las teclas F1 a F5.</p>
      </div>

      {/* ── Rejilla ── */}
      <main className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "1.25fr 1fr" }}>
        {/* Hero: Abrir TPV (entra directo) */}
        <button
          type="button"
          onClick={() => onNavegar("tpv")}
          className="group relative col-span-2 row-span-2 flex flex-col gap-2.5 overflow-hidden rounded-3xl border border-white/[.18] p-[30px] text-left text-white transition-transform duration-150 active:scale-[.985]"
          style={{ background: "linear-gradient(150deg,#8B45AC 0%, var(--brand) 52%, #3B1650 100%)" }}
        >
          <span className="absolute right-5 top-5 rounded-md border border-white/15 bg-black/15 px-1.5 py-0.5 font-mono text-[11px] text-white/60">F1</span>
          <span className="escudo pointer-events-none absolute -bottom-30 -right-24 h-100 w-100 -rotate-6 bg-white/[.07]" />
          <span className="escudo grid h-[76px] w-[76px] place-items-center bg-white/90"><MonitorSmartphone size={36} className="text-brand" strokeWidth={2} /></span>
          <h3 className="mt-2 font-display text-[clamp(30px,3.2vw,44px)] font-extrabold leading-none tracking-tight">Abrir TPV</h3>
          <p className="max-w-[30ch] text-[15px] leading-snug text-white/80">Mesas, barra, comandas y cobros del turno de hoy.</p>
          <div className="relative z-10 mt-auto flex flex-wrap gap-7">
            <div><b className="block font-display text-2xl font-extrabold tracking-tight">{turno.mesasAbiertas}/{turno.mesasTotal}</b><span className="text-[11.5px] uppercase tracking-wider text-white/70">Mesas abiertas</span></div>
            <div><b className="block font-display text-2xl font-extrabold tracking-tight">{turno.ventas}</b><span className="text-[11.5px] uppercase tracking-wider text-white/70">Ventas del turno</span></div>
            <div><b className="block font-display text-2xl font-extrabold tracking-tight">{turno.comandas}</b><span className="text-[11.5px] uppercase tracking-wider text-white/70">Comandas en cocina</span></div>
          </div>
          <span className="relative z-10 mt-3.5 inline-flex items-center gap-2.5 self-start rounded-full bg-white px-5 py-3 font-bold text-brand">
            Entrar al turno <ArrowRight size={17} strokeWidth={2.4} />
          </span>
        </button>

        <Tarjeta fkey="F2" placa="linear-gradient(150deg,var(--brand-lit),var(--brand))" icono={<Settings2 size={26} />}
          titulo="Configuración" desc="Carta, precios, salas y mesas, impresoras, métodos de pago e impuestos."
          meta="Última edición: ayer, 18:42" onClick={() => onNavegar("config")} />
        <Tarjeta fkey="F3" placa="linear-gradient(150deg,var(--brand-lit),var(--brand))" icono={<BarChart3 size={26} />}
          titulo="Análisis" desc="Ventas por hora, platos más vendidos, tickets medios y cierres de caja."
          meta="Ayer: 1.842,10 € · +8,4 %" onClick={() => onNavegar("analisis")} />
        <Tarjeta fkey="F4" placa="linear-gradient(150deg,#E3B7FF,#9A5BBE)" icono={<Users size={26} />}
          titulo="Administrador" insignia={{ texto: "Equipo Gluuh", tono: "lock" }}
          desc="Empleados, turnos, permisos, licencias y ajustes avanzados del local."
          meta="Requiere PIN de administrador" onClick={() => onNavegar("admin")} />
        <Tarjeta fkey="F5" placa="linear-gradient(150deg,#54E3B1,#159C6E)" icono={<Share2 size={26} />}
          titulo="Visor Node" insignia={{ texto: "activo", tono: "mint" }}
          desc="Estado del servidor, dispositivos conectados, colas de impresión y registro."
          meta="4 terminales · 128 ms · v2.4.1" onClick={() => onNavegar("nodo")} />
      </main>

      {/* ── Pie ── */}
      <footer className="flex flex-wrap items-center gap-3.5">
        <span className="font-mono text-[11.5px] tracking-wide text-muted">Gluuh TPV v3.2.0 · Licencia LA-ALAMEDA-0417</span>
        <button type="button" onClick={onSalir} className="btn-ghost"><LogOut size={14} /> Salir</button>
        <button type="button" onClick={onAyuda} className="ml-auto flex items-center gap-2.5 rounded-full bg-amber px-5 py-3 font-bold text-[#2b1605] transition-transform active:scale-95">
          <LifeBuoy size={18} /> Ayuda y soporte técnico
        </button>
      </footer>
    </div>
  );
}
