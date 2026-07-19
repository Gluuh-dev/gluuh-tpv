import { useState } from "react";
import { Hammer, Sun, Moon } from "lucide-react";
import { MarcoApartado } from "../../ui";
import { APARTADOS } from "../meta";
import { useTema } from "../../lib/tema";
import { GRUPOS, type Seccion } from "./secciones";

// Configuración DENTRO del TPV (carta, precios, salas, impresión, cobro,
// impuestos y este terminal). El mapa de secciones está en `secciones.tsx`
// (sale del inventario del panel Next del 19-07) y se construye por fases:
// cada sección enseña HOY su alcance real; cuando se diseña, sustituye la
// ficha por su pantalla. «Preferencias» ya es funcional (tema del terminal).

// Ficha de alcance: qué se configurará en la sección (honesta: aún se hace
// desde el panel web). Es la versión informativa de <EnObras>.
function FichaAlcance({ s }: Readonly<{ s: Seccion }>) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4">
        <span className="grid h-13 w-13 flex-none place-items-center rounded-2xl bg-brand/10 text-brand-lit">
          <s.Icono size={24} />
        </span>
        <div>
          <h2 className="font-display text-[22px] font-extrabold leading-none tracking-tight">{s.titulo}</h2>
          <p className="mt-1.5 text-sm text-muted">{s.desc}</p>
        </div>
      </div>

      <p className="mt-7 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">Qué se configura aquí</p>
      <ul className="mt-3 space-y-2">
        {s.alcance.map((a) => (
          <li key={a} className="flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-[14.5px] leading-snug">
            <span className="mt-1.75 h-1.5 w-1.5 flex-none rounded-full bg-brand-lit" />
            {a}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex items-start gap-3.5 rounded-2xl border border-dashed border-line bg-paper/3 px-5 py-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-paper/5 text-muted"><Hammer size={17} /></span>
        <p className="text-sm leading-relaxed text-muted">
          Esta sección se construye aquí por fases. De momento, estos ajustes se hacen
          desde el <b className="font-semibold text-paper/80">panel web</b> (modo online).
        </p>
      </div>
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
      <div className="flex items-center gap-4">
        <span className="grid h-13 w-13 flex-none place-items-center rounded-2xl bg-brand/10 text-brand-lit">
          <s.Icono size={24} />
        </span>
        <div>
          <h2 className="font-display text-[22px] font-extrabold leading-none tracking-tight">{s.titulo}</h2>
          <p className="mt-1.5 text-sm text-muted">{s.desc}</p>
        </div>
      </div>

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

export function Configuracion({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.config;
  const [sel, setSel] = useState<Seccion>(GRUPOS[0]!.secciones[0]!);

  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <div className="flex min-h-0 flex-1">
        {/* Rail de secciones (táctil: filas ≥48px, sin hover, animación al pulsar) */}
        <nav className="w-72 flex-none space-y-5 overflow-y-auto border-r border-line px-4 py-5">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{g.titulo}</p>
              <div className="space-y-1">
                {g.secciones.map((s) => {
                  const activa = s.id === sel.id;
                  return (
                    <button key={s.id} type="button" onClick={() => setSel(s)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-semibold transition-transform active:scale-[.98] ${
                        activa ? "bg-brand text-white" : "text-paper/85"
                      }`}>
                      <s.Icono size={18} className={activa ? "text-white/90" : "text-muted"} />
                      {s.titulo}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Contenido de la sección */}
        <section className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
          {sel.id === "preferencias" ? <Preferencias s={sel} /> : <FichaAlcance s={sel} />}
        </section>
      </div>
    </MarcoApartado>
  );
}
