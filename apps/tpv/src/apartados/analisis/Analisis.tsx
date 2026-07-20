import { useState, type ReactNode } from "react";
import { TrendingUp, TrendingDown, Receipt, Coins, Users, Clock, type LucideIcon } from "lucide-react";
import { MarcoApartado } from "../../ui";
import { eur } from "../../lib/dinero";
import { APARTADOS } from "../meta";

// ANÁLISIS — cuadro de mando del local: cifras del periodo, ventas por hora, lo
// más vendido, cómo se cobra y cierres de caja. Datos DEMO con la MISMA forma que
// traerá el nodo (jornada + sales_order agregados): al cablear no cambia la UI.

type Periodo = "hoy" | "ayer" | "semana" | "mes";
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" }, { id: "ayer", label: "Ayer" },
  { id: "semana", label: "7 días" }, { id: "mes", label: "Mes" },
];

interface Datos {
  ventas: number; tickets: number; propinas: number; comensales: number;
  variacion: number;                       // % respecto al periodo anterior
  barras: { h: string; v: number }[];      // por hora (día) o por día/semana
  top: { nombre: string; uds: number; importe: number }[];
  pagos: { nombre: string; importe: number }[];
  cierres: { cuando: string; ventas: number; descuadre: number }[];
}

const CIERRES_DEMO = [
  { cuando: "Ayer, 23:48", ventas: 1370.2, descuadre: -2.15 },
  { cuando: "17-07, 23:52", ventas: 1512.8, descuadre: 0 },
  { cuando: "16-07, 23:41", ventas: 1408.4, descuadre: 1.05 },
];

const DEMO: Record<Periodo, Datos> = {
  hoy: {
    ventas: 1486.3, tickets: 63, propinas: 41.5, comensales: 148, variacion: 8.4,
    barras: [
      { h: "08", v: 42 }, { h: "09", v: 78 }, { h: "10", v: 96 }, { h: "11", v: 64 },
      { h: "12", v: 118 }, { h: "13", v: 246 }, { h: "14", v: 288 }, { h: "15", v: 152 },
      { h: "16", v: 61 }, { h: "17", v: 44 }, { h: "18", v: 72 }, { h: "19", v: 125 },
    ],
    top: [
      { nombre: "Menú del día", uds: 38, importe: 494 },
      { nombre: "Caña", uds: 96, importe: 240 },
      { nombre: "Croquetas caseras", uds: 27, importe: 226.8 },
      { nombre: "Café solo", uds: 74, importe: 96.2 },
      { nombre: "Tortilla", uds: 19, importe: 85.5 },
    ],
    pagos: [{ nombre: "Tarjeta", importe: 892 }, { nombre: "Efectivo", importe: 458.3 }, { nombre: "Bizum", importe: 136 }],
    cierres: CIERRES_DEMO.slice(0, 2),
  },
  ayer: {
    ventas: 1370.2, tickets: 58, propinas: 33.8, comensales: 131, variacion: -3.1,
    barras: [
      { h: "08", v: 38 }, { h: "09", v: 71 }, { h: "10", v: 88 }, { h: "11", v: 59 },
      { h: "12", v: 104 }, { h: "13", v: 228 }, { h: "14", v: 262 }, { h: "15", v: 141 },
      { h: "16", v: 55 }, { h: "17", v: 40 }, { h: "18", v: 66 }, { h: "19", v: 118 },
    ],
    top: [
      { nombre: "Menú del día", uds: 34, importe: 442 },
      { nombre: "Caña", uds: 88, importe: 220 },
      { nombre: "Café solo", uds: 69, importe: 89.7 },
      { nombre: "Croquetas caseras", uds: 21, importe: 176.4 },
      { nombre: "Tarta de queso", uds: 16, importe: 80 },
    ],
    pagos: [{ nombre: "Tarjeta", importe: 806 }, { nombre: "Efectivo", importe: 442.2 }, { nombre: "Bizum", importe: 122 }],
    cierres: CIERRES_DEMO.slice(1),
  },
  semana: {
    ventas: 9842.6, tickets: 402, propinas: 246.9, comensales: 951, variacion: 5.7,
    barras: [
      { h: "L", v: 1180 }, { h: "M", v: 1265 }, { h: "X", v: 1342 }, { h: "J", v: 1408 },
      { h: "V", v: 1836 }, { h: "S", v: 1945 }, { h: "D", v: 866 },
    ],
    top: [
      { nombre: "Menú del día", uds: 236, importe: 3068 },
      { nombre: "Caña", uds: 612, importe: 1530 },
      { nombre: "Croquetas caseras", uds: 168, importe: 1411.2 },
      { nombre: "Café solo", uds: 465, importe: 604.5 },
      { nombre: "Vino de la casa", uds: 142, importe: 497 },
    ],
    pagos: [{ nombre: "Tarjeta", importe: 5905 }, { nombre: "Efectivo", importe: 3035.6 }, { nombre: "Bizum", importe: 902 }],
    cierres: CIERRES_DEMO,
  },
  mes: {
    ventas: 38610.4, tickets: 1584, propinas: 968.2, comensales: 3742, variacion: 11.2,
    barras: [
      { h: "Sem 1", v: 8920 }, { h: "Sem 2", v: 9310 }, { h: "Sem 3", v: 9538 }, { h: "Sem 4", v: 10842 },
    ],
    top: [
      { nombre: "Menú del día", uds: 928, importe: 12064 },
      { nombre: "Caña", uds: 2410, importe: 6025 },
      { nombre: "Croquetas caseras", uds: 654, importe: 5493.6 },
      { nombre: "Café solo", uds: 1832, importe: 2381.6 },
      { nombre: "Vino de la casa", uds: 561, importe: 1963.5 },
    ],
    pagos: [{ nombre: "Tarjeta", importe: 23166 }, { nombre: "Efectivo", importe: 11968 }, { nombre: "Bizum", importe: 3476.4 }],
    cierres: CIERRES_DEMO,
  },
};

function Cifra({ label, valor, sub, Icono }: Readonly<{ label: string; valor: string; sub?: string; Icono: LucideIcon }>) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-panel p-4">
      <span className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted">{label}</span>
        <Icono size={16} className="text-muted" />
      </span>
      <b className="font-display text-[26px] font-extrabold leading-none tracking-tight">{valor}</b>
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </div>
  );
}

function Panel({ titulo, children }: Readonly<{ titulo: string; children: ReactNode }>) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h3 className="pb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

export function Analisis({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.analisis;
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const d = DEMO[periodo];
  const maxBarra = Math.max(...d.barras.map((b) => b.v), 1);
  const maxTop = Math.max(...d.top.map((t) => t.importe), 1);
  const totalPagos = d.pagos.reduce((a, p) => a + p.importe, 0) || 1;
  const ticketMedio = d.tickets ? d.ventas / d.tickets : 0;
  const porDia = periodo === "semana" || periodo === "mes";

  return (
    <MarcoApartado
      titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}
      acciones={
        <div className="flex gap-1 rounded-xl border border-line bg-panel p-1">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriodo(p.id)}
              className={`min-h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-transform active:scale-95 ${
                periodo === p.id ? "bg-brand text-white" : "text-muted"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Cifra label="Ventas" valor={eur(d.ventas)} Icono={TrendingUp}
            sub={`${d.variacion >= 0 ? "+" : ""}${d.variacion.toFixed(1)} % vs. anterior`} />
          <Cifra label="Tickets" valor={String(d.tickets)} Icono={Receipt} sub={`Ticket medio ${eur(ticketMedio)}`} />
          <Cifra label="Propinas" valor={eur(d.propinas)} Icono={Coins} sub="Incluidas en el total" />
          <Cifra label="Comensales" valor={String(d.comensales)} Icono={Users}
            sub={`${(d.comensales / Math.max(d.tickets, 1)).toFixed(1)} por ticket`} />
        </div>

        <div className="mt-4">
          <Panel titulo={porDia ? "Ventas por periodo" : "Ventas por hora"}>
            <div className="flex h-44 items-end gap-1.5">
              {d.barras.map((b) => {
                const punta = b.v === maxBarra;
                return (
                  <div key={b.h} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className={`text-[10px] font-semibold tabular-nums ${punta ? "text-brand-lit" : "text-muted"}`}>{b.v}</span>
                    <div className={`w-full rounded-t-md ${punta ? "bg-brand" : "bg-brand/35"}`}
                      style={{ height: `${Math.max(Math.round((b.v / maxBarra) * 100), 3)}%` }} />
                    <span className="truncate text-[10.5px] font-semibold text-muted">{b.h}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel titulo="Lo más vendido">
            <ul className="space-y-2.5">
              {d.top.map((t, i) => (
                <li key={t.nombre} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand/10 font-mono text-[12px] font-bold text-brand-lit">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <b className="truncate text-[14px] font-semibold">{t.nombre}</b>
                      <span className="flex-none text-[13px] font-semibold tabular-nums">{eur(t.importe)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper/10">
                        <span className="block h-full rounded-full bg-brand-lit" style={{ width: `${(t.importe / maxTop) * 100}%` }} />
                      </span>
                      <span className="flex-none font-mono text-[11px] text-muted">{t.uds} uds</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel titulo="Cómo se cobra">
            <ul className="space-y-3">
              {d.pagos.map((p) => {
                const pct = (p.importe / totalPagos) * 100;
                return (
                  <li key={p.nombre}>
                    <span className="flex items-baseline justify-between gap-2">
                      <b className="text-[14px] font-semibold">{p.nombre}</b>
                      <span className="text-[13px] tabular-nums">{eur(p.importe)} <span className="text-muted">· {pct.toFixed(0)} %</span></span>
                    </span>
                    <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-paper/10">
                      <span className="block h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              Salen de las formas de pago activas del local; el arqueo solo cuenta las
              marcadas para caja.
            </p>
          </Panel>
        </div>

        <div className="mt-4">
          <Panel titulo="Últimos cierres de caja (Z)">
            <ul className="divide-y divide-line">
              {d.cierres.map((c) => {
                const cuadra = Math.abs(c.descuadre) < 0.005;
                return (
                  <li key={c.cuando} className="flex items-center gap-3 py-2.5">
                    <Clock size={15} className="flex-none text-muted" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{c.cuando}</span>
                    <span className="flex-none text-[13.5px] tabular-nums">{eur(c.ventas)}</span>
                    <span className={`flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${cuadra ? "bg-mint/15" : "bg-amber/15"}`}>
                      {!cuadra && (c.descuadre < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />)}
                      {cuadra ? "Cuadra" : eur(c.descuadre)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <p className="mt-5 text-[12.5px] text-muted">
          Cifras de ejemplo. Al cablear el nodo salen de las ventas reales del local
          (jornada y cierres Z) sin tocar esta pantalla.
        </p>
      </div>
    </MarcoApartado>
  );
}
