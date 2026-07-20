import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, LogOut, LifeBuoy, Printer, Wifi, Sun, Moon, Lock, LogIn } from "lucide-react";
import { ETIQUETA_ROL, type Apartado } from "../../lib/nav";
import { useTema } from "../../lib/tema";
import { Marca, Chip, Escudo, Fkey } from "../../ui";
import { iniciales, type Usuario } from "../acceso/tipos";
import { APARTADOS } from "../meta";

// REGLAS del TPV (táctil): sin `hover`, solo animación al pulsar (`active:`);
// sombras al mínimo. El hub tiene SESIÓN: te identificas una vez y navegas lo que
// tu rol permite; lo que no, sale atenuado con candado. La sesión dura hasta
// "Cerrar sesión". (El TPV es aparte: hereda quién eres y tiene su propio velo.)

// Tarjeta secundaria del hub (Config / Análisis / Administrador / Visor Node).
function Tarjeta({
  apartado, fkey, meta, insignia, atenuada, onClick,
}: Readonly<{
  apartado: Apartado; fkey: string; meta: string;
  insignia?: { texto: string; tono: "mint" | "lock" }; atenuada?: boolean; onClick: () => void;
}>) {
  const m = APARTADOS[apartado];
  return (
    <button type="button" onClick={onClick} disabled={atenuada} aria-disabled={atenuada}
      className={`relative flex flex-col gap-2.5 overflow-hidden rounded-3xl border border-line bg-linear-165 from-panel-2 to-ink-2 p-5.5 text-left transition-transform duration-150 ${atenuada ? "opacity-45 grayscale" : "active:scale-[.97]"}`}>
      <span className="absolute right-4 top-4">{atenuada ? <Lock size={15} className="text-muted" /> : <Fkey>{fkey}</Fkey>}</span>
      <Escudo fondo={atenuada ? "var(--muted)" : m.color} tam={56}><m.Icono size={26} /></Escudo>
      <h3 className="mt-1.5 flex items-center font-display text-[19px] font-semibold tracking-tight text-paper">
        {m.titulo}
        {insignia && !atenuada && (
          <span className={`ml-2 rounded-full border px-2 py-0.5 font-mono text-[11px] ${insignia.tono === "mint" ? "border-mint/35 bg-mint/10 text-mint" : "border-brand-lit/30 bg-brand-lit/10 text-brand-lit"}`}>
            {insignia.texto}
          </span>
        )}
      </h3>
      <p className="max-w-[34ch] text-[13.5px] leading-relaxed text-muted">{m.desc}</p>
      <span className="mt-auto font-mono text-[11.5px] tracking-wide text-muted">
        {atenuada ? `Requiere ${ETIQUETA_ROL[m.requiere]}` : meta}
      </span>
    </button>
  );
}

interface Props {
  local: { nombre: string; terminal: string };
  turno: { mesasAbiertas: number; mesasTotal: number; ventas: string; comandas: number };
  /** Quién está identificado en el terminal, o null (anónimo). */
  usuario: Usuario | null;
  /** ¿El rol actual puede abrir este apartado? (anónimo = sí, lleva al login). */
  permitido: (v: Apartado) => boolean;
  onNavegar: (v: Apartado) => void;
  onIdentificarse: () => void;
  onCerrarSesion: () => void;
  onAyuda: () => void;
}

export function Inicio({ local, turno, usuario, permitido, onNavegar, onIdentificarse, onCerrarSesion, onAyuda }: Readonly<Props>) {
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

  const heroIcono: ReactNode = (() => { const I = APARTADOS.tpv.Icono; return <I size={36} className="text-brand" strokeWidth={2} />; })();

  return (
    <div className="relative mx-auto flex h-screen max-w-[1500px] flex-col gap-4.5 px-[clamp(18px,3vw,40px)] pb-4 pt-5 text-paper">
      {/* ── Barra superior ── */}
      <header className="flex items-center gap-4.5">
        <div className="flex min-w-0 items-center gap-3.5">
          <Marca className="h-13 w-auto" alt="Gluuh" />
          <div>
            <h1 className="font-display text-[23px] font-extrabold leading-none tracking-tight">Gluuh TPV</h1>
            <span className="mt-1.5 block text-[12px] uppercase tracking-[.14em] text-muted">{local.nombre} · {local.terminal}</span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <Chip dot><Wifi size={13} /> Node conectado</Chip>
          <Chip dot warn><Printer size={13} /> Impresora cocina: sin papel</Chip>
          <Chip><span className="text-[14px] font-semibold tracking-wide">{hhmm}</span></Chip>
          {/* Quién está en el terminal. Logueado: avatar + nombre + cerrar sesión.
              Anónimo: botón para identificarse. */}
          {usuario ? (
            <span className="flex items-center gap-2 rounded-full border border-line bg-paper/5 py-1 pl-1 pr-1.5">
              <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ background: usuario.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                {iniciales(usuario.nombre)}
              </span>
              <span className="mr-1 leading-tight">
                <b className="block text-[12.5px] font-semibold text-paper">{usuario.nombre}</b>
                <small className="block text-[10.5px] capitalize text-muted">{ETIQUETA_ROL[usuario.rol]}</small>
              </span>
              <button type="button" onClick={onCerrarSesion} title="Cerrar sesión"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-transform active:scale-90">
                <LogOut size={15} />
              </button>
            </span>
          ) : (
            <button type="button" onClick={onIdentificarse}
              className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95">
              <LogIn size={16} /> Identificarse
            </button>
          )}
          <button type="button" onClick={alternar} aria-label="Cambiar tema"
            className="grid h-10.5 w-10.5 place-items-center rounded-full border border-line bg-paper/5 text-paper/80 transition-transform active:scale-90">
            {oscuro ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {/* ── Saludo: con el nombre si hay sesión; anónimo, invita a identificarse ── */}
      <div>
        <h2 className="font-display text-[clamp(22px,2.4vw,32px)] font-semibold tracking-tight">
          {saludo}, <em className="not-italic text-brand-lit">{usuario ? usuario.nombre.split(" ")[0] : "Equipo"}</em>.
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {usuario
            ? "Elige por dónde empezar. Puedes usar las teclas F1 a F5."
            : "Identifícate para entrar. También puedes pulsar cualquier tarjeta y te pedirá el PIN."}
        </p>
      </div>

      {/* ── Rejilla ── */}
      <main className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "1.25fr 1fr" }}>
        {/* Hero: Abrir TPV (entra directo) */}
        <button type="button" onClick={() => onNavegar("tpv")}
          className="relative col-span-2 row-span-2 flex flex-col gap-2.5 overflow-hidden rounded-3xl border border-white/18 p-7.5 text-left text-white transition-transform duration-150 active:scale-[.985]"
          style={{ background: "linear-gradient(150deg,#8B45AC 0%, var(--brand) 52%, #3B1650 100%)" }}>
          <span className="absolute right-5 top-5"><Fkey sobreOscuro>F1</Fkey></span>
          <span className="escudo pointer-events-none absolute -bottom-30 -right-24 h-100 w-100 -rotate-6 bg-white/[.07]" />
          <Escudo fondo="rgba(255,255,255,.92)" tam={76}>{heroIcono}</Escudo>
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

        <Tarjeta apartado="config" fkey="F2" atenuada={!permitido("config")} meta="Última edición: ayer, 18:42" onClick={() => onNavegar("config")} />
        <Tarjeta apartado="analisis" fkey="F3" atenuada={!permitido("analisis")} meta="Ayer: 1.842,10 € · +8,4 %" onClick={() => onNavegar("analisis")} />
        <Tarjeta apartado="admin" fkey="F4" atenuada={!permitido("admin")} insignia={{ texto: "Equipo Gluuh", tono: "lock" }} meta="Requiere PIN de administrador" onClick={() => onNavegar("admin")} />
        <Tarjeta apartado="nodo" fkey="F5" atenuada={!permitido("nodo")} insignia={{ texto: "activo", tono: "mint" }} meta="4 terminales · 128 ms · v2.4.1" onClick={() => onNavegar("nodo")} />
      </main>

      {/* ── Pie ── */}
      <footer className="flex flex-wrap items-center gap-3.5">
        <span className="font-mono text-[11.5px] tracking-wide text-muted">Gluuh TPV v3.2.0 · Licencia LA-ALAMEDA-0417</span>
        {usuario && (
          <button type="button" onClick={onCerrarSesion} className="btn-ghost"><LogOut size={14} /> Cerrar sesión</button>
        )}
        <button type="button" onClick={onAyuda} className="ml-auto flex items-center gap-2.5 rounded-full bg-amber px-5 py-3 font-bold text-[#2b1605] transition-transform active:scale-95">
          <LifeBuoy size={18} /> Ayuda y soporte técnico
        </button>
      </footer>
    </div>
  );
}
