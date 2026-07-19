import { useMemo, useState } from "react";
import { House, Search, Sun, Moon } from "lucide-react";
import { MarcoApartado } from "../../ui";
import { APARTADOS } from "../meta";
import { useTema } from "../../lib/tema";
import { GRUPOS, type Seccion } from "./secciones";

// Configuración DENTRO del TPV. El mapa vive en `secciones.tsx` (inventario del
// panel Next, 19-07) y esta pantalla lo sirve en plan ajustes profesionales:
// buscador (encuentra por título, descripción o alcance, sin acentos), vista
// general por dominios, y ficha por sección con su estado. Cada sección se
// construye por fases: cuando se diseña, sustituye su ficha por la pantalla
// real («Preferencias» ya lo es: tema del terminal).

// «impresion» debe encontrar «Impresión»: fuera acentos y mayúsculas.
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function BadgeEstado({ funcional }: Readonly<{ funcional?: boolean }>) {
  return funcional ? (
    <span className="flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 text-[11px] font-semibold text-paper">
      <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Funciona en este terminal
    </span>
  ) : (
    <span className="rounded-full border border-line bg-paper/5 px-2.5 py-1 text-[11px] font-semibold text-muted">
      Hoy, en el panel web
    </span>
  );
}

function CabeceraSeccion({ s }: Readonly<{ s: Seccion }>) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-13 w-13 flex-none place-items-center rounded-2xl bg-brand/10 text-brand-lit">
        <s.Icono size={24} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-display text-[22px] font-extrabold leading-none tracking-tight">{s.titulo}</h2>
          <BadgeEstado funcional={s.funcional} />
        </div>
        <p className="mt-1.5 text-sm text-muted">{s.desc}</p>
      </div>
    </div>
  );
}

// Ficha de alcance: qué se configurará en la sección (honesta con el estado).
function FichaAlcance({ s }: Readonly<{ s: Seccion }>) {
  return (
    <div className="max-w-3xl">
      <CabeceraSeccion s={s} />
      <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">Qué se configura aquí</p>
      <ul className="mt-3 space-y-2">
        {s.alcance.map((a) => (
          <li key={a} className="flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-[14.5px] leading-snug">
            <span className="mt-1.75 h-1.5 w-1.5 flex-none rounded-full bg-brand-lit" />
            {a}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        Esta sección se construye en el terminal por fases; mientras tanto, estos
        ajustes viven en el panel web (modo online).
      </p>
    </div>
  );
}

// «Preferencias» — la primera sección FUNCIONAL: tema de este terminal.
function Preferencias({ s }: Readonly<{ s: Seccion }>) {
  const { oscuro, fijar } = useTema();
  const opciones = [
    { clave: "light" as const, titulo: "Claro", desc: "Para barras con mucha luz.", Icono: Sun, activa: !oscuro },
    { clave: "dark" as const, titulo: "Oscuro", desc: "Para salas y turnos de noche.", Icono: Moon, activa: oscuro },
  ];
  return (
    <div className="max-w-3xl">
      <CabeceraSeccion s={s} />
      <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">Tema de este terminal</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {opciones.map((o) => (
          <button key={o.clave} type="button" onClick={() => fijar(o.clave)}
            className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-transform active:scale-[.98] ${
              o.activa ? "border-brand-lit bg-accent-soft" : "border-line bg-panel"
            }`}>
            <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl ${o.activa ? "bg-brand text-white" : "bg-paper/5 text-muted"}`}>
              <o.Icono size={20} />
            </span>
            <span>
              <b className="block font-display text-[16px] font-bold">{o.titulo}</b>
              <span className="text-[13px] text-muted">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-muted">Se guarda en este terminal; los demás no cambian.</p>
    </div>
  );
}

// Portada del apartado: los dominios de un vistazo, con sus secciones.
function VistaGeneral({ onIr }: Readonly<{ onIr: (s: Seccion) => void }>) {
  const total = GRUPOS.reduce((n, g) => n + g.secciones.length, 0);
  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-[22px] font-extrabold leading-none tracking-tight">Todo lo del local, en un sitio</h2>
      <p className="mt-1.5 text-sm text-muted">
        {total} secciones agrupadas por dominios. Entra por un dominio o busca el ajuste directamente.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-3">
        {GRUPOS.map((g) => (
          <button key={g.titulo} type="button" onClick={() => onIr(g.secciones[0]!)}
            className="flex flex-col gap-3.5 rounded-2xl border border-line bg-panel p-5 text-left transition-transform active:scale-[.98]">
            <span className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand-lit"><g.Icono size={20} /></span>
              <span className="font-mono text-[11px] text-muted">{g.secciones.length} {g.secciones.length === 1 ? "sección" : "secciones"}</span>
            </span>
            <span>
              <b className="block font-display text-[16.5px] font-bold tracking-tight">{g.titulo}</b>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
                {g.secciones.map((s) => s.titulo).join(" · ")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilaSeccion({ s, activa, detalle, onClick }: Readonly<{
  s: Seccion; activa: boolean; detalle?: string; onClick: () => void;
}>) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-transform active:scale-[.98] ${
        activa ? "bg-brand text-white" : "text-paper/85"
      }`}>
      <s.Icono size={18} className={`flex-none ${activa ? "text-white/90" : "text-muted"}`} />
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-semibold leading-tight">{s.titulo}</span>
        {detalle && <span className={`block truncate text-[11.5px] ${activa ? "text-white/70" : "text-muted"}`}>{detalle}</span>}
      </span>
    </button>
  );
}

export function Configuracion({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.config;
  const [sel, setSel] = useState<Seccion | null>(null); // null = vista general
  const [q, setQ] = useState("");

  // Resultados del buscador: sección + su dominio (para situarla).
  const resultados = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return null;
    return GRUPOS.flatMap((g) =>
      g.secciones
        .filter((s) => norm(`${s.titulo} ${s.desc} ${s.alcance.join(" ")}`).includes(nq))
        .map((s) => ({ grupo: g.titulo, s })),
    );
  }, [q]);

  const abrir = (s: Seccion) => setSel(s);

  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <div className="flex min-h-0 flex-1">
        {/* ── Rail: buscador + secciones (táctil: filas ≥48px, sin hover) ── */}
        <nav className="flex w-76 flex-none flex-col border-r border-line">
          <div className="px-4 pb-3 pt-5">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); } }}
                placeholder="Buscar un ajuste…"
                className="h-11 w-full rounded-xl border border-line bg-panel pl-9.5 pr-3 text-[14px] text-paper placeholder:text-muted focus:border-brand-lit focus:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-5">
            {resultados ? (
              <div className="space-y-1">
                {resultados.map(({ grupo, s }) => (
                  <FilaSeccion key={s.id} s={s} activa={sel?.id === s.id} detalle={grupo} onClick={() => abrir(s)} />
                ))}
                {resultados.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted">Ningún ajuste se llama «{q.trim()}».</p>
                )}
              </div>
            ) : (
              <>
                <button type="button" onClick={() => setSel(null)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold transition-transform active:scale-[.98] ${
                    sel === null ? "bg-brand text-white" : "text-paper/85"
                  }`}>
                  <House size={18} className={sel === null ? "text-white/90" : "text-muted"} />
                  Vista general
                </button>
                {GRUPOS.map((g) => (
                  <div key={g.titulo}>
                    <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{g.titulo}</p>
                    <div className="space-y-1">
                      {g.secciones.map((s) => (
                        <FilaSeccion key={s.id} s={s} activa={sel?.id === s.id} onClick={() => abrir(s)} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </nav>

        {/* ── Contenido ── */}
        <section className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          {sel === null && <VistaGeneral onIr={abrir} />}
          {sel !== null && (sel.id === "preferencias" ? <Preferencias s={sel} /> : <FichaAlcance s={sel} />)}
        </section>
      </div>
    </MarcoApartado>
  );
}
