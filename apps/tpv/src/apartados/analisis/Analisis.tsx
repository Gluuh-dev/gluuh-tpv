import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Package, Users, Banknote, Landmark, Download,
  type LucideIcon,
} from "lucide-react";
import { ShellApartado, BarraSeccion, Caja, type SeccionShell } from "../../ui";
import { eur } from "../../lib/dinero";

// ANÁLISIS — cuadro de mando del local con lenguaje de app: barra de 56px,
// secciones laterales plegables y contenido denso (tablas de 40px con cabecera
// fija). Datos DEMO con la forma que traerá la jornada del nodo: al cablear no
// cambia la pantalla, solo la fuente.

type Periodo = "hoy" | "ayer" | "semana" | "mes";
const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" }, { id: "ayer", label: "Ayer" },
  { id: "semana", label: "7 días" }, { id: "mes", label: "Mes" },
];

const SECCIONES: readonly SeccionShell[] = [
  { id: "resumen", label: "Resumen", Icono: LayoutDashboard },
  { id: "ventas", label: "Ventas", Icono: TrendingUp },
  { id: "productos", label: "Productos", Icono: Package },
  { id: "camareros", label: "Camareros", Icono: Users },
  { id: "caja", label: "Caja y cierres", Icono: Banknote },
  { id: "impuestos", label: "Impuestos", Icono: Landmark },
];

interface Fila { etiqueta: string; tickets: number; ventas: number }
interface Datos {
  ventas: number; tickets: number; propinas: number; comensales: number; variacion: number;
  franjas: Fila[];
  top: { nombre: string; familia: string; uds: number; importe: number }[];
  camareros: { nombre: string; tickets: number; ventas: number; propinas: number }[];
  pagos: { nombre: string; importe: number }[];
  cierres: { cuando: string; ventas: number; efectivo: number; tarjeta: number; descuadre: number }[];
  impuestos: { tipo: string; base: number; cuota: number }[];
}

const CAMAREROS = [
  { nombre: "María Ruiz", tickets: 24, ventas: 612.4, propinas: 18.5 },
  { nombre: "Berto Sanz", tickets: 21, ventas: 498.9, propinas: 13.0 },
  { nombre: "Lucía Gil", tickets: 18, ventas: 375.0, propinas: 10.0 },
];
const CIERRES = [
  { cuando: "Ayer · 23:48", ventas: 1370.2, efectivo: 442.2, tarjeta: 806, descuadre: -2.15 },
  { cuando: "17-07 · 23:52", ventas: 1512.8, efectivo: 508.4, tarjeta: 884.4, descuadre: 0 },
  { cuando: "16-07 · 23:41", ventas: 1408.4, efectivo: 471.1, tarjeta: 812.3, descuadre: 1.05 },
];

// IGIC canario (7 % general, 3 % reducido): el desglose sale hacia atrás del PVP.
const impuestosDe = (ventas: number) => {
  const baseG = (ventas * 0.82) / 1.07, baseR = (ventas * 0.18) / 1.03;
  return [
    { tipo: "IGIC 7 % (general)", base: baseG, cuota: baseG * 0.07 },
    { tipo: "IGIC 3 % (reducido)", base: baseR, cuota: baseR * 0.03 },
  ];
};

const DEMO: Record<Periodo, Datos> = {
  hoy: {
    ventas: 1486.3, tickets: 63, propinas: 41.5, comensales: 148, variacion: 8.4,
    franjas: [
      { etiqueta: "08–10", tickets: 9, ventas: 120 }, { etiqueta: "10–12", tickets: 11, ventas: 160 },
      { etiqueta: "12–14", tickets: 18, ventas: 364 }, { etiqueta: "14–16", tickets: 14, ventas: 440 },
      { etiqueta: "16–18", tickets: 5, ventas: 105 }, { etiqueta: "18–20", tickets: 6, ventas: 197 },
    ],
    top: [
      { nombre: "Menú del día", familia: "Cocina", uds: 38, importe: 494 },
      { nombre: "Caña", familia: "Cervezas", uds: 96, importe: 240 },
      { nombre: "Croquetas caseras", familia: "Cocina", uds: 27, importe: 226.8 },
      { nombre: "Café solo", familia: "Cafés", uds: 74, importe: 96.2 },
      { nombre: "Tortilla", familia: "Cocina", uds: 19, importe: 85.5 },
      { nombre: "Vino de la casa", familia: "Vinos", uds: 24, importe: 84 },
    ],
    camareros: CAMAREROS, cierres: CIERRES.slice(0, 2), impuestos: impuestosDe(1486.3),
    pagos: [{ nombre: "Tarjeta", importe: 892 }, { nombre: "Efectivo", importe: 458.3 }, { nombre: "Bizum", importe: 136 }],
  },
  ayer: {
    ventas: 1370.2, tickets: 58, propinas: 33.8, comensales: 131, variacion: -3.1,
    franjas: [
      { etiqueta: "08–10", tickets: 8, ventas: 109 }, { etiqueta: "10–12", tickets: 10, ventas: 147 },
      { etiqueta: "12–14", tickets: 17, ventas: 332 }, { etiqueta: "14–16", tickets: 13, ventas: 403 },
      { etiqueta: "16–18", tickets: 4, ventas: 95 }, { etiqueta: "18–20", tickets: 6, ventas: 184 },
    ],
    top: [
      { nombre: "Menú del día", familia: "Cocina", uds: 34, importe: 442 },
      { nombre: "Caña", familia: "Cervezas", uds: 88, importe: 220 },
      { nombre: "Café solo", familia: "Cafés", uds: 69, importe: 89.7 },
      { nombre: "Croquetas caseras", familia: "Cocina", uds: 21, importe: 176.4 },
      { nombre: "Tarta de queso", familia: "Postres", uds: 16, importe: 80 },
    ],
    camareros: CAMAREROS, cierres: CIERRES.slice(1), impuestos: impuestosDe(1370.2),
    pagos: [{ nombre: "Tarjeta", importe: 806 }, { nombre: "Efectivo", importe: 442.2 }, { nombre: "Bizum", importe: 122 }],
  },
  semana: {
    ventas: 9842.6, tickets: 402, propinas: 246.9, comensales: 951, variacion: 5.7,
    franjas: [
      { etiqueta: "Lunes", tickets: 48, ventas: 1180 }, { etiqueta: "Martes", tickets: 52, ventas: 1265 },
      { etiqueta: "Miércoles", tickets: 55, ventas: 1342 }, { etiqueta: "Jueves", tickets: 58, ventas: 1408 },
      { etiqueta: "Viernes", tickets: 76, ventas: 1836 }, { etiqueta: "Sábado", tickets: 78, ventas: 1945 },
      { etiqueta: "Domingo", tickets: 35, ventas: 866 },
    ],
    top: [
      { nombre: "Menú del día", familia: "Cocina", uds: 236, importe: 3068 },
      { nombre: "Caña", familia: "Cervezas", uds: 612, importe: 1530 },
      { nombre: "Croquetas caseras", familia: "Cocina", uds: 168, importe: 1411.2 },
      { nombre: "Café solo", familia: "Cafés", uds: 465, importe: 604.5 },
      { nombre: "Vino de la casa", familia: "Vinos", uds: 142, importe: 497 },
    ],
    camareros: CAMAREROS, cierres: CIERRES, impuestos: impuestosDe(9842.6),
    pagos: [{ nombre: "Tarjeta", importe: 5905 }, { nombre: "Efectivo", importe: 3035.6 }, { nombre: "Bizum", importe: 902 }],
  },
  mes: {
    ventas: 38610.4, tickets: 1584, propinas: 968.2, comensales: 3742, variacion: 11.2,
    franjas: [
      { etiqueta: "Semana 1", tickets: 366, ventas: 8920 }, { etiqueta: "Semana 2", tickets: 382, ventas: 9310 },
      { etiqueta: "Semana 3", tickets: 391, ventas: 9538 }, { etiqueta: "Semana 4", tickets: 445, ventas: 10842 },
    ],
    top: [
      { nombre: "Menú del día", familia: "Cocina", uds: 928, importe: 12064 },
      { nombre: "Caña", familia: "Cervezas", uds: 2410, importe: 6025 },
      { nombre: "Croquetas caseras", familia: "Cocina", uds: 654, importe: 5493.6 },
      { nombre: "Café solo", familia: "Cafés", uds: 1832, importe: 2381.6 },
      { nombre: "Vino de la casa", familia: "Vinos", uds: 561, importe: 1963.5 },
    ],
    camareros: CAMAREROS, cierres: CIERRES, impuestos: impuestosDe(38610.4),
    pagos: [{ nombre: "Tarjeta", importe: 23166 }, { nombre: "Efectivo", importe: 11968 }, { nombre: "Bizum", importe: 3476.4 }],
  },
};

// ── piezas de tabla (densidad de app: filas de 40px, números tabulares) ──
const TH = "sticky top-0 z-10 bg-panel px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-muted";
const THn = `${TH} text-right`;
const TD = "px-3 py-2.5 text-[13px]";
const TDn = `${TD} text-right tabular-nums`;

function Kpi({ label, valor, sub, delta }: Readonly<{ label: string; valor: string; sub?: string; delta?: number }>) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted">{label}</span>
      <div className="mt-1.5 flex items-baseline gap-2">
        <b className="font-display text-[22px] font-extrabold leading-none tracking-tight">{valor}</b>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-[12px] font-bold tabular-nums ${delta >= 0 ? "text-mint" : "text-danger"}`}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta).toFixed(1)} %
          </span>
        )}
      </div>
      {sub && <span className="mt-1 block text-[11.5px] text-muted">{sub}</span>}
    </div>
  );
}

function Barras({ filas }: Readonly<{ filas: Fila[] }>) {
  const max = Math.max(...filas.map((f) => f.ventas), 1);
  return (
    <div className="flex h-40 items-end gap-2">
      {filas.map((f) => {
        const punta = f.ventas === max;
        return (
          <div key={f.etiqueta} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className={`text-[10.5px] font-bold tabular-nums ${punta ? "text-brand-lit" : "text-muted"}`}>{Math.round(f.ventas)}</span>
            <div className={`w-full rounded-t ${punta ? "bg-brand" : "bg-brand/35"}`} style={{ height: `${Math.max((f.ventas / max) * 100, 3)}%` }} />
            <span className="w-full truncate text-center text-[10.5px] font-semibold text-muted">{f.etiqueta}</span>
          </div>
        );
      })}
    </div>
  );
}

function Vacio({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="px-1 py-6 text-center text-[13px] text-muted">{children}</p>;
}

export function Analisis({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [seccion, setSeccion] = useState("resumen");
  const [ordenProd, setOrdenProd] = useState<"importe" | "uds">("importe");
  const d = DEMO[periodo];

  const etiquetaPeriodo = PERIODOS.find((p) => p.id === periodo)?.label ?? "";
  const ticketMedio = d.tickets ? d.ventas / d.tickets : 0;
  const totalPagos = d.pagos.reduce((a, p) => a + p.importe, 0) || 1;
  const top = [...d.top].sort((a, b) => (ordenProd === "importe" ? b.importe - a.importe : b.uds - a.uds));
  const cuotaTotal = d.impuestos.reduce((a, i) => a + i.cuota, 0);
  const baseTotal = d.impuestos.reduce((a, i) => a + i.base, 0);

  const selector = (
    <div className="flex gap-0.5 rounded-lg bg-white/10 p-0.5">
      {PERIODOS.map((p) => (
        <button key={p.id} type="button" onClick={() => setPeriodo(p.id)}
          className={`min-h-8 rounded-md px-3 text-[12.5px] font-bold transition-transform active:scale-95 ${
            periodo === p.id ? "bg-white text-brand" : "text-white/80"
          }`}>
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <ShellApartado titulo="Análisis" claveLateral="analisis" secciones={SECCIONES}
      seccion={seccion} onSeccion={setSeccion} onVolver={onVolver} acciones={selector}>

      {seccion === "resumen" && (
        <>
          <BarraSeccion titulo="Resumen" sub={`${etiquetaPeriodo} · ${d.tickets} tickets`} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi label="Ventas" valor={eur(d.ventas)} delta={d.variacion} sub="Impuestos incluidos" />
              <Kpi label="Tickets" valor={String(d.tickets)} sub={`Medio ${eur(ticketMedio)}`} />
              <Kpi label="Propinas" valor={eur(d.propinas)} sub={`${((d.propinas / d.ventas) * 100).toFixed(1)} % sobre ventas`} />
              <Kpi label="Comensales" valor={String(d.comensales)} sub={`${(d.comensales / Math.max(d.tickets, 1)).toFixed(1)} por ticket`} />
            </div>

            <div className="mt-3">
              <Caja titulo="Ventas por franja"><Barras filas={d.franjas} /></Caja>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <Caja titulo="Lo más vendido" contador={`${d.top.length} artículos`}>
                <table className="w-full border-collapse">
                  <thead><tr><th className={TH}>Artículo</th><th className={THn}>Uds</th><th className={THn}>Importe</th></tr></thead>
                  <tbody>
                    {d.top.slice(0, 6).map((t) => (
                      <tr key={t.nombre} className="border-t border-line">
                        <td className={TD}><b className="font-semibold">{t.nombre}</b> <span className="text-muted">· {t.familia}</span></td>
                        <td className={TDn}>{t.uds}</td>
                        <td className={`${TDn} font-semibold`}>{eur(t.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Caja>

              <Caja titulo="Cómo se cobra">
                <ul className="space-y-3">
                  {d.pagos.map((p) => {
                    const pct = (p.importe / totalPagos) * 100;
                    return (
                      <li key={p.nombre}>
                        <span className="flex items-baseline justify-between gap-2 text-[13px]">
                          <b className="font-semibold">{p.nombre}</b>
                          <span className="tabular-nums">{eur(p.importe)} <span className="text-muted">· {pct.toFixed(0)} %</span></span>
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper/10">
                          <span className="block h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Caja>
            </div>
          </div>
        </>
      )}

      {seccion === "ventas" && (
        <>
          <BarraSeccion titulo="Ventas" sub={`${etiquetaPeriodo} · detalle por franja`}>
            <button type="button" className="flex min-h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[12.5px] font-semibold text-muted transition-transform active:scale-95">
              <Download size={14} /> Exportar
            </button>
          </BarraSeccion>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Detalle por franja">
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Franja</th><th className={THn}>Tickets</th><th className={THn}>Ventas</th><th className={THn}>Ticket medio</th><th className={THn}>% del total</th></tr></thead>
                <tbody>
                  {d.franjas.map((f) => (
                    <tr key={f.etiqueta} className="border-t border-line">
                      <td className={`${TD} font-semibold`}>{f.etiqueta}</td>
                      <td className={TDn}>{f.tickets}</td>
                      <td className={`${TDn} font-semibold`}>{eur(f.ventas)}</td>
                      <td className={TDn}>{eur(f.ventas / Math.max(f.tickets, 1))}</td>
                      <td className={`${TDn} text-muted`}>{((f.ventas / d.ventas) * 100).toFixed(1)} %</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line">
                    <td className={`${TD} font-bold`}>Total</td>
                    <td className={`${TDn} font-bold`}>{d.franjas.reduce((a, f) => a + f.tickets, 0)}</td>
                    <td className={`${TDn} font-bold`}>{eur(d.franjas.reduce((a, f) => a + f.ventas, 0))}</td>
                    <td className={TDn} /><td className={TDn} />
                  </tr>
                </tbody>
              </table>
            </Caja>
          </div>
        </>
      )}

      {seccion === "productos" && (
        <>
          <BarraSeccion titulo="Productos" sub={`${etiquetaPeriodo} · ${d.top.length} artículos con venta`}>
            <div className="flex gap-0.5 rounded-lg border border-line bg-panel p-0.5">
              {(["importe", "uds"] as const).map((o) => (
                <button key={o} type="button" onClick={() => setOrdenProd(o)}
                  className={`min-h-8 rounded-md px-3 text-[12px] font-bold transition-transform active:scale-95 ${ordenProd === o ? "bg-brand text-white" : "text-muted"}`}>
                  {o === "importe" ? "Por importe" : "Por unidades"}
                </button>
              ))}
            </div>
          </BarraSeccion>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Ranking de artículos">
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>#</th><th className={TH}>Artículo</th><th className={TH}>Familia</th><th className={THn}>Uds</th><th className={THn}>Importe</th><th className={THn}>% del total</th></tr></thead>
                <tbody>
                  {top.map((t, i) => (
                    <tr key={t.nombre} className="border-t border-line">
                      <td className={`${TD} font-mono text-muted`}>{i + 1}</td>
                      <td className={`${TD} font-semibold`}>{t.nombre}</td>
                      <td className={`${TD} text-muted`}>{t.familia}</td>
                      <td className={TDn}>{t.uds}</td>
                      <td className={`${TDn} font-semibold`}>{eur(t.importe)}</td>
                      <td className={`${TDn} text-muted`}>{((t.importe / d.ventas) * 100).toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Caja>
          </div>
        </>
      )}

      {seccion === "camareros" && (
        <>
          <BarraSeccion titulo="Camareros" sub={`${etiquetaPeriodo} · rendimiento por operario`} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Ventas por operario">
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Operario</th><th className={THn}>Tickets</th><th className={THn}>Ventas</th><th className={THn}>Ticket medio</th><th className={THn}>Propinas</th></tr></thead>
                <tbody>
                  {d.camareros.map((c) => (
                    <tr key={c.nombre} className="border-t border-line">
                      <td className={`${TD} font-semibold`}>{c.nombre}</td>
                      <td className={TDn}>{c.tickets}</td>
                      <td className={`${TDn} font-semibold`}>{eur(c.ventas)}</td>
                      <td className={TDn}>{eur(c.ventas / Math.max(c.tickets, 1))}</td>
                      <td className={`${TDn} text-muted`}>{eur(c.propinas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Caja>
          </div>
        </>
      )}

      {seccion === "caja" && (
        <>
          <BarraSeccion titulo="Caja y cierres" sub="Cierres Z con su descuadre" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Últimos cierres (Z)" contador={`${d.cierres.length} cierres`}>
              {d.cierres.length === 0 ? <Vacio>Aún no hay cierres en este periodo.</Vacio> : (
                <table className="w-full border-collapse">
                  <thead><tr><th className={TH}>Cierre</th><th className={THn}>Ventas</th><th className={THn}>Efectivo</th><th className={THn}>Tarjeta</th><th className={THn}>Descuadre</th></tr></thead>
                  <tbody>
                    {d.cierres.map((c) => {
                      const cuadra = Math.abs(c.descuadre) < 0.005;
                      return (
                        <tr key={c.cuando} className="border-t border-line">
                          <td className={`${TD} font-semibold`}>{c.cuando}</td>
                          <td className={`${TDn} font-semibold`}>{eur(c.ventas)}</td>
                          <td className={TDn}>{eur(c.efectivo)}</td>
                          <td className={TDn}>{eur(c.tarjeta)}</td>
                          <td className={TDn}>
                            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${cuadra ? "bg-mint/15" : "bg-amber/15"}`}>
                              {cuadra ? "Cuadra" : eur(c.descuadre)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Caja>
          </div>
        </>
      )}

      {seccion === "impuestos" && (
        <>
          <BarraSeccion titulo="Impuestos" sub={`${etiquetaPeriodo} · desglose IGIC (Canarias)`} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Desglose por tipo">
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Tipo</th><th className={THn}>Base imponible</th><th className={THn}>Cuota</th><th className={THn}>Total</th></tr></thead>
                <tbody>
                  {d.impuestos.map((i) => (
                    <tr key={i.tipo} className="border-t border-line">
                      <td className={`${TD} font-semibold`}>{i.tipo}</td>
                      <td className={TDn}>{eur(i.base)}</td>
                      <td className={TDn}>{eur(i.cuota)}</td>
                      <td className={`${TDn} font-semibold`}>{eur(i.base + i.cuota)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line">
                    <td className={`${TD} font-bold`}>Total</td>
                    <td className={`${TDn} font-bold`}>{eur(baseTotal)}</td>
                    <td className={`${TDn} font-bold`}>{eur(cuotaTotal)}</td>
                    <td className={`${TDn} font-bold`}>{eur(baseTotal + cuotaTotal)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Los precios de carta llevan el impuesto incluido: la base se desglosa hacia
                atrás según la clase fiscal de cada artículo y el territorio del local.
              </p>
            </Caja>
          </div>
        </>
      )}
    </ShellApartado>
  );
}
