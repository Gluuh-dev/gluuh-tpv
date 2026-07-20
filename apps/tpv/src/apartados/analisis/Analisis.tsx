import { useMemo, useState } from "react";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Package, Users, Banknote, Landmark, FileText, Receipt,
} from "lucide-react";
import { CatalogoInformes } from "./CatalogoInformes";
import { disponibles, totalInformes } from "./informes";
import {
  ShellApartado, Tarjeta, Segmento, BarraInforme, RC, TH, TD,
  type SeccionShell, type ColumnaInforme,
} from "../../ui";
import { eur } from "../../lib/dinero";

// Los informes se descargan con el MISMO número que se ve en pantalla: los
// importes van con coma decimal (formato español) para que Excel los sume.
const num = (n: number) => n.toFixed(2).replace(".", ",");
const pct = (parte: number, total: number) => `${((parte / (total || 1)) * 100).toFixed(1)} %`;

/** Filtro de texto sin acentos (buscar "cana" encuentra "Caña"). */
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function filtrar<T>(filas: T[], busq: string, campos: (f: T) => string[]): T[] {
  const q = sinAcentos(busq.trim());
  if (!q) return filas;
  return filas.filter((f) => campos(f).some((c) => sinAcentos(c).includes(q)));
}

// ANÁLISIS — cuadro de mando del local con el lenguaje de gestión (lateral a
// toda altura, barra de 60px, tablas densas). Datos DEMO con la forma que traerá
// la jornada del nodo: al cablear cambia la fuente, no la pantalla.

type Periodo = "hoy" | "ayer" | "semana" | "mes";
const PERIODOS = [
  { id: "hoy" as const, label: "Hoy" }, { id: "ayer" as const, label: "Ayer" },
  { id: "semana" as const, label: "7 días" }, { id: "mes" as const, label: "Mes" },
];

// ── Rango de fechas ─────────────────────────────────────────────────────────
// El gestor no pide «los últimos 7 días»: pide «del 1 al 31 de marzo». Los cuatro
// atajos son eso, atajos; el rango es lo que manda y lo que viajará a la consulta
// del nodo (`created_at between desde and hasta`).
// OJO: NO se puede usar `toISOString()`. Convierte a UTC, y la medianoche
// española (UTC+1/+2) cae en el día ANTERIOR: un informe de «hoy» saldría
// fechado ayer, y el «Mes» empezaría el 28 del mes pasado. Se arma con las
// partes LOCALES, que es el día que vive el bar.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoyISO = () => iso(new Date());
const sumarDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Fechas que cubre cada atajo, para que el rango y el atajo digan lo mismo. */
export function rangoDe(p: Periodo, hoy = new Date()): { desde: string; hasta: string } {
  if (p === "ayer") { const a = sumarDias(hoy, -1); return { desde: iso(a), hasta: iso(a) }; }
  if (p === "semana") return { desde: iso(sumarDias(hoy, -6)), hasta: iso(hoy) };
  if (p === "mes") return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) };
  return { desde: iso(hoy), hasta: iso(hoy) };
}

/** «12/03/2026» o «12/03/2026 – 31/03/2026». Un informe sin fechas no vale. */
export function etiquetaRango(desde: string, hasta: string): string {
  const f = (s: string) => s.split("-").reverse().join("/");
  return desde === hasta ? f(desde) : `${f(desde)} – ${f(hasta)}`;
}

const SECCIONES: readonly SeccionShell[] = [
  { id: "informes", label: "Informes", Icono: FileText },
  { id: "resumen", label: "Resumen", Icono: LayoutDashboard },
  { id: "ventas", label: "Ventas", Icono: TrendingUp },
  { id: "diario", label: "Diario de tickets", Icono: Receipt },
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

// ── Diario de tickets ───────────────────────────────────────────────────────
// El informe que más pide un dueño: VER LOS TICKETS, uno a uno, y poder buscar
// «¿qué pasó con la mesa 7 del sábado?». Se genera a partir del propio periodo
// (mismo nº de tickets y mismo importe total) para que no contradiga a los KPI:
// dos pantallas del mismo día que no cuadran destruyen la confianza en las dos.
export interface Ticket {
  numero: string; hora: string; mesa: string; operario: string; pago: string;
  comensales: number; total: number;
}

const MESAS = ["Mesa 1", "Mesa 3", "Mesa 5", "Mesa 7", "Terraza 2", "Terraza 4", "Barra"];
const PAGOS = ["Efectivo", "Tarjeta", "Tarjeta", "Bizum"];   // la tarjeta pesa más, como en un bar

export function diarioDe(tickets: number, ventasTotal: number, serie: number): Ticket[] {
  const filas: Ticket[] = [];
  // Importes variados pero DETERMINISTAS (nada de Math.random: la pantalla no
  // puede cambiar sola entre dos repintados). Los pesos se NORMALIZAN por su
  // suma: si no, la media (~1,1) se pasa del total y el último ticket salía
  // negativo — se recortaba a 0 y el diario sumaba más que los KPI.
  const pesos = Array.from({ length: tickets }, (_, i) => 0.6 + ((i * 37) % 100) / 100);
  const sumaPesos = pesos.reduce((a, p) => a + p, 0) || 1;
  let repartido = 0;
  for (let i = 0; i < tickets; i++) {
    // El último se lleva lo que quede, para que la suma cuadre al céntimo.
    const total = i === tickets - 1
      ? Math.round((ventasTotal - repartido) * 100) / 100
      : Math.round((ventasTotal * (pesos[i]! / sumaPesos)) * 100) / 100;
    repartido = Math.round((repartido + total) * 100) / 100;
    const minuto = 8 * 60 + Math.floor((i * 733) % (13 * 60));   // repartidos entre 08:00 y 21:00
    filas.push({
      numero: `F-2026-${String(serie + i).padStart(4, "0")}`,
      hora: `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`,
      mesa: MESAS[i % MESAS.length]!,
      operario: CAMAREROS[i % CAMAREROS.length]!.nombre,
      pago: PAGOS[i % PAGOS.length]!,
      comensales: 1 + (i % 4),
      total: Math.max(total, 0),
    });
  }
  return filas.sort((a, b) => b.hora.localeCompare(a.hora));   // lo último, arriba
}

// ── Familias ────────────────────────────────────────────────────────────────
// «¿Cuánto pesa la cocina frente a la barra?» — la pregunta con la que se decide
// una carta. Se AGRUPA el ranking que ya está en pantalla en vez de traer otra
// lista: así el total por familias y el total por artículos no pueden discrepar.
export interface FilaFamilia { familia: string; articulos: number; uds: number; importe: number }

export function porFamilia(top: readonly { familia: string; uds: number; importe: number }[]): FilaFamilia[] {
  const m = new Map<string, FilaFamilia>();
  for (const t of top) {
    const f = m.get(t.familia) ?? { familia: t.familia, articulos: 0, uds: 0, importe: 0 };
    f.articulos += 1; f.uds += t.uds; f.importe = Math.round((f.importe + t.importe) * 100) / 100;
    m.set(t.familia, f);
  }
  return [...m.values()].sort((a, b) => b.importe - a.importe);
}

// IGIC canario (7 % general, 3 % reducido): el desglose sale hacia atrás del PVP.
const impuestosDe = (ventas: number) => {
  const baseG = (ventas * 0.82) / 1.07, baseR = (ventas * 0.18) / 1.03;
  return [
    { tipo: "IGIC 7 % (general)", base: baseG, cuota: baseG * 0.07 },
    { tipo: "IGIC 3 % (reducido)", base: baseR, cuota: baseR * 0.03 },
  ];
};

export const DEMO: Record<Periodo, Datos> = {
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

function Kpi({ label, valor, sub, delta }: Readonly<{ label: string; valor: string; sub?: string; delta?: number }>) {
  return (
    <div className={`${RC} border border-line bg-panel px-3.5 py-3`}>
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
      <div className="mt-1 flex items-baseline gap-2">
        <b className="text-[19px] font-semibold leading-none tracking-tight">{valor}</b>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11.5px] font-medium tabular-nums ${delta >= 0 ? "text-mint" : "text-danger"}`}>
            {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(delta).toFixed(1)} %
          </span>
        )}
      </div>
      {sub && <span className="mt-1 block text-[11px] text-muted">{sub}</span>}
    </div>
  );
}

function Barras({ filas }: Readonly<{ filas: Fila[] }>) {
  const max = Math.max(...filas.map((f) => f.ventas), 1);
  return (
    <div className="flex h-36 items-end gap-2">
      {filas.map((f) => {
        const punta = f.ventas === max;
        return (
          <div key={f.etiqueta} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className={`text-[10.5px] tabular-nums ${punta ? "font-semibold text-brand-lit" : "text-muted"}`}>{Math.round(f.ventas)}</span>
            <div className={`w-full rounded-t-[3px] ${punta ? "bg-brand" : "bg-brand/30"}`} style={{ height: `${Math.max((f.ventas / max) * 100, 3)}%` }} />
            <span className="w-full truncate text-center text-[10.5px] text-muted">{f.etiqueta}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Analisis({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [seccion, setSeccion] = useState("resumen");
  const [ordenProd, setOrdenProd] = useState<"importe" | "uds">("importe");
  // Un buscador por sección: lo que se escribe filtra la tabla Y lo que se exporta.
  const [busq, setBusq] = useState("");
  const irA = (s: string) => { setSeccion(s); setBusq(""); };
  // El rango manda; los atajos solo lo rellenan. Al tocar una fecha a mano, el
  // atajo se desmarca (`suelto`) para no decir «Hoy» encima de otro rango.
  const [rango, setRango] = useState(() => rangoDe("hoy"));
  const [suelto, setSuelto] = useState(false);
  const elegirPeriodo = (p: Periodo) => { setPeriodo(p); setRango(rangoDe(p)); setSuelto(false); };
  const cambiarFecha = (cual: "desde" | "hasta", v: string) => {
    if (!v) return;
    setRango((r) => {
      const n = { ...r, [cual]: v };
      // Si se cruzan, las dos pasan a la fecha tocada: un rango invertido no da
      // cero filas, da confusión («no vendí nada en marzo»).
      return n.desde > n.hasta ? { desde: v, hasta: v } : n;
    });
    setSuelto(true);
  };
  const d = DEMO[periodo];

  // Lo que se imprime en la cabecera de cada informe: con un atajo, su nombre y
  // las fechas; con un rango a mano, solo las fechas. Un PDF sin fechas no vale.
  const fechas = etiquetaRango(rango.desde, rango.hasta);
  const etiquetaPeriodo = suelto
    ? fechas
    : `${PERIODOS.find((p) => p.id === periodo)?.label ?? ""} · ${fechas}`;
  const ticketMedio = d.tickets ? d.ventas / d.tickets : 0;
  const totalPagos = d.pagos.reduce((a, p) => a + p.importe, 0) || 1;
  const top = [...d.top].sort((a, b) => (ordenProd === "importe" ? b.importe - a.importe : b.uds - a.uds));
  const cuotaTotal = d.impuestos.reduce((a, i) => a + i.cuota, 0);
  const baseTotal = d.impuestos.reduce((a, i) => a + i.base, 0);
  const porDia = periodo === "semana" || periodo === "mes";

  // ── Los informes: filas ya filtradas + columnas. Las mismas columnas alimentan
  // la tabla que se ve y el CSV/PDF que se descarga, así no pueden desfasarse.
  const franjas = useMemo(() => filtrar(d.franjas, busq, (f) => [f.etiqueta]), [d.franjas, busq]);
  const productos = useMemo(() => filtrar(top, busq, (t) => [t.nombre, t.familia]), [top, busq]);
  const camareros = useMemo(() => filtrar(d.camareros, busq, (c) => [c.nombre]), [d.camareros, busq]);
  const cierres = useMemo(() => filtrar(d.cierres, busq, (c) => [c.cuando]), [d.cierres, busq]);
  const impuestos = useMemo(() => filtrar(d.impuestos, busq, (i) => [i.tipo]), [d.impuestos, busq]);
  // Las formas de pago NO se filtran con el buscador de la sección: son tres filas
  // y buscar un cierre no debe hacer desaparecer el efectivo del cuadre.
  const pagos = d.pagos;
  // El % de una familia se mide sobre el ranking, no sobre las ventas del día:
  // el top es una parte de la venta, y dividir por el total daría porcentajes
  // que no suman 100 y parecen un error de cuentas.
  const familias = useMemo(() => filtrar(porFamilia(top), busq, (f) => [f.familia]), [top, busq]);
  const ventaTop = top.reduce((a, t) => a + t.importe, 0);
  // El diario se deriva del periodo (mismo nº de tickets y mismo total que los KPI).
  const diarioTodo = useMemo(() => diarioDe(d.tickets, d.ventas, 1000), [d.tickets, d.ventas]);
  const diario = useMemo(
    () => filtrar(diarioTodo, busq, (t) => [t.numero, t.mesa, t.operario, t.pago, t.hora]),
    [diarioTodo, busq],
  );

  const COL_FRANJAS: ColumnaInforme<typeof d.franjas[number]>[] = [
    { titulo: "Franja", valor: (f) => f.etiqueta },
    { titulo: "Tickets", valor: (f) => f.tickets, derecha: true },
    { titulo: "Ventas", valor: (f) => num(f.ventas), derecha: true },
    { titulo: "Ticket medio", valor: (f) => num(f.ventas / Math.max(f.tickets, 1)), derecha: true },
    { titulo: "% del total", valor: (f) => pct(f.ventas, d.ventas), derecha: true },
  ];
  const COL_PRODUCTOS: ColumnaInforme<typeof top[number]>[] = [
    { titulo: "Artículo", valor: (t) => t.nombre },
    { titulo: "Familia", valor: (t) => t.familia },
    { titulo: "Uds", valor: (t) => t.uds, derecha: true },
    { titulo: "Importe", valor: (t) => num(t.importe), derecha: true },
    { titulo: "% del total", valor: (t) => pct(t.importe, d.ventas), derecha: true },
  ];
  const COL_CAMAREROS: ColumnaInforme<typeof d.camareros[number]>[] = [
    { titulo: "Operario", valor: (c) => c.nombre },
    { titulo: "Tickets", valor: (c) => c.tickets, derecha: true },
    { titulo: "Ventas", valor: (c) => num(c.ventas), derecha: true },
    { titulo: "Ticket medio", valor: (c) => num(c.ventas / Math.max(c.tickets, 1)), derecha: true },
    { titulo: "Propinas", valor: (c) => num(c.propinas), derecha: true },
  ];
  const COL_CIERRES: ColumnaInforme<typeof d.cierres[number]>[] = [
    { titulo: "Cierre", valor: (c) => c.cuando },
    { titulo: "Ventas", valor: (c) => num(c.ventas), derecha: true },
    { titulo: "Efectivo", valor: (c) => num(c.efectivo), derecha: true },
    { titulo: "Tarjeta", valor: (c) => num(c.tarjeta), derecha: true },
    { titulo: "Descuadre", valor: (c) => (Math.abs(c.descuadre) < 0.005 ? "Cuadra" : num(c.descuadre)), derecha: true },
  ];
  const COL_DIARIO: ColumnaInforme<Ticket>[] = [
    { titulo: "Ticket", valor: (t) => t.numero },
    { titulo: "Hora", valor: (t) => t.hora },
    { titulo: "Mesa", valor: (t) => t.mesa },
    { titulo: "Operario", valor: (t) => t.operario },
    { titulo: "Pago", valor: (t) => t.pago },
    { titulo: "Pax", valor: (t) => t.comensales, derecha: true },
    { titulo: "Total", valor: (t) => num(t.total), derecha: true },
  ];
  const COL_FAMILIAS: ColumnaInforme<FilaFamilia>[] = [
    { titulo: "Familia", valor: (f) => f.familia },
    { titulo: "Artículos", valor: (f) => f.articulos, derecha: true },
    { titulo: "Uds", valor: (f) => f.uds, derecha: true },
    { titulo: "Importe", valor: (f) => num(f.importe), derecha: true },
    { titulo: "% del total", valor: (f) => pct(f.importe, ventaTop), derecha: true },
  ];
  const COL_PAGOS: ColumnaInforme<typeof d.pagos[number]>[] = [
    { titulo: "Forma de pago", valor: (p) => p.nombre },
    { titulo: "Importe", valor: (p) => num(p.importe), derecha: true },
    { titulo: "% del total", valor: (p) => pct(p.importe, totalPagos), derecha: true },
  ];
  const COL_IMPUESTOS: ColumnaInforme<typeof d.impuestos[number]>[] = [
    { titulo: "Tipo", valor: (i) => i.tipo },
    { titulo: "Base imponible", valor: (i) => num(i.base), derecha: true },
    { titulo: "Cuota", valor: (i) => num(i.cuota), derecha: true },
    { titulo: "Total", valor: (i) => num(i.base + i.cuota), derecha: true },
  ];

  const SUB: Record<string, string> = {
    informes: `${disponibles} de ${totalInformes} informes disponibles`,
    resumen: `${etiquetaPeriodo} · ${d.tickets} tickets`,
    diario: `${etiquetaPeriodo} · ticket a ticket`,
    ventas: `${etiquetaPeriodo} · detalle por franja`,
    productos: `${etiquetaPeriodo} · ${d.top.length} artículos en ${porFamilia(d.top).length} familias`,
    camareros: `${etiquetaPeriodo} · rendimiento por operario`,
    caja: `${etiquetaPeriodo} · formas de pago y cierres Z`,
    impuestos: `${etiquetaPeriodo} · desglose IGIC (Canarias)`,
  };

  return (
    <ShellApartado app="Análisis" claveLateral="analisis" secciones={SECCIONES}
      seccion={seccion} onSeccion={setSeccion} onVolver={onVolver} subtitulo={SUB[seccion]}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          {/* Los atajos rellenan el rango; el rango es lo que manda. */}
          <Segmento valor={suelto ? ("" as Periodo) : periodo} opciones={PERIODOS} onCambio={elegirPeriodo} />
          <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="sr-only">Desde</span>
            <input type="date" value={rango.desde} max={rango.hasta} aria-label="Desde"
              onChange={(e) => cambiarFecha("desde", e.target.value)}
              className="h-8 rounded-md border border-line bg-paper/5 px-2 text-[12px] text-paper outline-none focus:border-brand" />
          </label>
          <span className="text-[11.5px] text-muted">–</span>
          <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="sr-only">Hasta</span>
            <input type="date" value={rango.hasta} min={rango.desde} max={hoyISO()} aria-label="Hasta"
              onChange={(e) => cambiarFecha("hasta", e.target.value)}
              className="h-8 rounded-md border border-line bg-paper/5 px-2 text-[12px] text-paper outline-none focus:border-brand" />
          </label>
        </div>
      }>

      {seccion === "informes" && <CatalogoInformes onAbrir={irA} />}

      {seccion === "resumen" && (
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Ventas" valor={eur(d.ventas)} delta={d.variacion} sub="Impuestos incluidos" />
            <Kpi label="Tickets" valor={String(d.tickets)} sub={`Medio ${eur(ticketMedio)}`} />
            <Kpi label="Propinas" valor={eur(d.propinas)} sub={`${((d.propinas / d.ventas) * 100).toFixed(1)} % sobre ventas`} />
            <Kpi label="Comensales" valor={String(d.comensales)} sub={`${(d.comensales / Math.max(d.tickets, 1)).toFixed(1)} por ticket`} />
          </div>

          <Tarjeta titulo={porDia ? "Ventas por periodo" : "Ventas por franja"}><Barras filas={d.franjas} /></Tarjeta>

          <div className="grid gap-3 xl:grid-cols-2">
            <Tarjeta titulo="Lo más vendido">
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Artículo</th><th className={`${TH} text-right`}>Uds</th><th className={`${TH} text-right`}>Importe</th></tr></thead>
                <tbody>
                  {d.top.slice(0, 6).map((t) => (
                    <tr key={t.nombre} className="border-b border-line">
                      <td className={TD}><b className="font-medium">{t.nombre}</b> <span className="text-muted">· {t.familia}</span></td>
                      <td className={`${TD} text-right tabular-nums`}>{t.uds}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>{eur(t.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>

            <Tarjeta titulo="Cómo se cobra">
              <ul className="space-y-3">
                {d.pagos.map((p) => {
                  const pct = (p.importe / totalPagos) * 100;
                  return (
                    <li key={p.nombre}>
                      <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
                        <b className="font-medium">{p.nombre}</b>
                        <span className="tabular-nums">{eur(p.importe)} <span className="text-muted">· {pct.toFixed(0)} %</span></span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper/10">
                        <span className="block h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          </div>
        </div>
      )}

      {seccion === "ventas" && (
        <div className="p-4">
          <Tarjeta titulo="Detalle por franja">
            <BarraInforme titulo={`Ventas por franja · ${etiquetaPeriodo}`} columnas={COL_FRANJAS}
              filas={franjas} busqueda={busq} onBusqueda={setBusq} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Ventas", valor: eur(franjas.reduce((a, f) => a + f.ventas, 0)) },
                        { etiqueta: "Tickets", valor: String(franjas.reduce((a, f) => a + f.tickets, 0)) }]} />
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Franja</th><th className={`${TH} text-right`}>Tickets</th><th className={`${TH} text-right`}>Ventas</th><th className={`${TH} text-right`}>Ticket medio</th><th className={`${TH} text-right`}>% del total</th></tr></thead>
              <tbody>
                {franjas.map((f) => (
                  <tr key={f.etiqueta} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{f.etiqueta}</td>
                    <td className={`${TD} text-right tabular-nums`}>{f.tickets}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{eur(f.ventas)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{eur(f.ventas / Math.max(f.tickets, 1))}</td>
                    <td className={`${TD} text-right tabular-nums text-muted`}>{((f.ventas / d.ventas) * 100).toFixed(1)} %</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${TD} font-semibold`}>Total</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{franjas.reduce((a, f) => a + f.tickets, 0)}</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{eur(franjas.reduce((a, f) => a + f.ventas, 0))}</td>
                  <td className={TD} /><td className={TD} />
                </tr>
              </tbody>
            </table>
          </Tarjeta>
        </div>
      )}

      {seccion === "diario" && (
        <div className="p-4">
          <Tarjeta titulo="Tickets del periodo">
            <BarraInforme titulo={`Diario de tickets · ${etiquetaPeriodo}`} columnas={COL_DIARIO}
              filas={diario} busqueda={busq} onBusqueda={setBusq} periodo={etiquetaPeriodo}
              totales={[
                { etiqueta: "Tickets", valor: String(diario.length) },
                { etiqueta: "Total", valor: eur(diario.reduce((a, t) => a + t.total, 0)) },
                { etiqueta: "Ticket medio", valor: eur(diario.reduce((a, t) => a + t.total, 0) / Math.max(diario.length, 1)) },
              ]} />
            {diario.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-muted">Ningún ticket cuadra con la búsqueda.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead><tr>
                  <th className={TH}>Ticket</th><th className={TH}>Hora</th><th className={TH}>Mesa</th>
                  <th className={TH}>Operario</th><th className={TH}>Pago</th>
                  <th className={`${TH} text-right`}>Pax</th><th className={`${TH} text-right`}>Total</th>
                </tr></thead>
                <tbody>
                  {diario.map((t) => (
                    <tr key={t.numero} className="border-b border-line">
                      <td className={`${TD} font-mono text-[11.5px] text-muted`}>{t.numero}</td>
                      <td className={`${TD} tabular-nums`}>{t.hora}</td>
                      <td className={`${TD} font-medium`}>{t.mesa}</td>
                      <td className={TD}>{t.operario}</td>
                      <td className={TD}><span className="rounded-[3px] bg-paper/8 px-1.5 py-0.5 text-[11.5px]">{t.pago}</span></td>
                      <td className={`${TD} text-right tabular-nums text-muted`}>{t.comensales}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>{eur(t.total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${TD} font-semibold`} colSpan={5}>Total · {diario.length} tickets</td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{diario.reduce((a, t) => a + t.comensales, 0)}</td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{eur(diario.reduce((a, t) => a + t.total, 0))}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Tarjeta>
        </div>
      )}

      {seccion === "productos" && (
        <div className="space-y-3 p-4">
          <Tarjeta titulo="Ranking de artículos"
            extra={<Segmento valor={ordenProd} onCambio={setOrdenProd}
              opciones={[{ id: "importe" as const, label: "Por importe" }, { id: "uds" as const, label: "Por unidades" }]} />}>
            <BarraInforme titulo={`Ranking de artículos · ${etiquetaPeriodo}`} columnas={COL_PRODUCTOS}
              filas={productos} busqueda={busq} onBusqueda={setBusq} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Importe", valor: eur(productos.reduce((a, t) => a + t.importe, 0)) },
                        { etiqueta: "Unidades", valor: String(productos.reduce((a, t) => a + t.uds, 0)) }]} />
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>#</th><th className={TH}>Artículo</th><th className={TH}>Familia</th><th className={`${TH} text-right`}>Uds</th><th className={`${TH} text-right`}>Importe</th><th className={`${TH} text-right`}>% del total</th></tr></thead>
              <tbody>
                {productos.map((t, i) => (
                  <tr key={t.nombre} className="border-b border-line">
                    <td className={`${TD} tabular-nums text-muted`}>{i + 1}</td>
                    <td className={`${TD} font-medium`}>{t.nombre}</td>
                    <td className={`${TD} text-muted`}>{t.familia}</td>
                    <td className={`${TD} text-right tabular-nums`}>{t.uds}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{eur(t.importe)}</td>
                    <td className={`${TD} text-right tabular-nums text-muted`}>{((t.importe / d.ventas) * 100).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>

          <Tarjeta titulo="Por familia">
            <BarraInforme titulo={`Familias y productos · ${etiquetaPeriodo}`} columnas={COL_FAMILIAS}
              filas={familias} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Importe", valor: eur(familias.reduce((a, f) => a + f.importe, 0)) },
                        { etiqueta: "Unidades", valor: String(familias.reduce((a, f) => a + f.uds, 0)) }]} />
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Familia</th><th className={`${TH} text-right`}>Artículos</th><th className={`${TH} text-right`}>Uds</th><th className={`${TH} text-right`}>Importe</th><th className={`${TH} text-right`}>% del ranking</th></tr></thead>
              <tbody>
                {familias.map((f) => (
                  <tr key={f.familia} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{f.familia}</td>
                    <td className={`${TD} text-right tabular-nums text-muted`}>{f.articulos}</td>
                    <td className={`${TD} text-right tabular-nums`}>{f.uds}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{eur(f.importe)}</td>
                    <td className={`${TD} text-right`}>
                      <span className="flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-paper/10">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${(f.importe / (ventaTop || 1)) * 100}%` }} />
                        </span>
                        <span className="w-11 tabular-nums text-muted">{((f.importe / (ventaTop || 1)) * 100).toFixed(1)} %</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </div>
      )}

      {seccion === "camareros" && (
        <div className="p-4">
          <Tarjeta titulo="Ventas por operario">
            <BarraInforme titulo={`Rendimiento por operario · ${etiquetaPeriodo}`} columnas={COL_CAMAREROS}
              filas={camareros} busqueda={busq} onBusqueda={setBusq} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Ventas", valor: eur(camareros.reduce((a, c) => a + c.ventas, 0)) },
                        { etiqueta: "Propinas", valor: eur(camareros.reduce((a, c) => a + c.propinas, 0)) }]} />
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Operario</th><th className={`${TH} text-right`}>Tickets</th><th className={`${TH} text-right`}>Ventas</th><th className={`${TH} text-right`}>Ticket medio</th><th className={`${TH} text-right`}>Propinas</th></tr></thead>
              <tbody>
                {camareros.map((c) => (
                  <tr key={c.nombre} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{c.nombre}</td>
                    <td className={`${TD} text-right tabular-nums`}>{c.tickets}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{eur(c.ventas)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{eur(c.ventas / Math.max(c.tickets, 1))}</td>
                    <td className={`${TD} text-right tabular-nums text-muted`}>{eur(c.propinas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </div>
      )}

      {seccion === "caja" && (
        <div className="space-y-3 p-4">
          <Tarjeta titulo="Formas de pago">
            {/* Lo primero que se cuadra al cerrar: cuánto entró por cada vía. */}
            <BarraInforme titulo={`Formas de pago · ${etiquetaPeriodo}`} columnas={COL_PAGOS}
              filas={pagos} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Cobrado", valor: eur(pagos.reduce((a, p) => a + p.importe, 0)) }]} />
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Forma de pago</th><th className={`${TH} text-right`}>Importe</th><th className={`${TH} text-right`}>% del total</th></tr></thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.nombre} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{p.nombre}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{eur(p.importe)}</td>
                    <td className={`${TD} text-right tabular-nums text-muted`}>{((p.importe / totalPagos) * 100).toFixed(1)} %</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${TD} font-semibold`}>Total cobrado</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{eur(pagos.reduce((a, p) => a + p.importe, 0))}</td>
                  <td className={TD} />
                </tr>
              </tbody>
            </table>
          </Tarjeta>

          <Tarjeta titulo="Últimos cierres (Z)">
            <BarraInforme titulo="Cierres de caja (Z)" columnas={COL_CIERRES}
              filas={cierres} busqueda={busq} onBusqueda={setBusq} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Ventas", valor: eur(cierres.reduce((a, c) => a + c.ventas, 0)) },
                        { etiqueta: "Descuadre", valor: eur(cierres.reduce((a, c) => a + c.descuadre, 0)) }]} />
            {cierres.length === 0 ? <p className="py-6 text-center text-[12.5px] text-muted">Aún no hay cierres en este periodo.</p> : (
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Cierre</th><th className={`${TH} text-right`}>Ventas</th><th className={`${TH} text-right`}>Efectivo</th><th className={`${TH} text-right`}>Tarjeta</th><th className={`${TH} text-right`}>Descuadre</th></tr></thead>
                <tbody>
                  {cierres.map((c) => {
                    const cuadra = Math.abs(c.descuadre) < 0.005;
                    return (
                      <tr key={c.cuando} className="border-b border-line">
                        <td className={`${TD} font-medium`}>{c.cuando}</td>
                        <td className={`${TD} text-right font-medium tabular-nums`}>{eur(c.ventas)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{eur(c.efectivo)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{eur(c.tarjeta)}</td>
                        <td className={`${TD} text-right`}>
                          <span className={`rounded-[3px] px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums ${cuadra ? "bg-mint/15" : "bg-amber/15"}`}>
                            {cuadra ? "Cuadra" : eur(c.descuadre)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </div>
      )}

      {seccion === "impuestos" && (
        <div className="p-4">
          <Tarjeta titulo="Desglose por tipo">
            {/* El informe que pide el gestor: base y cuota por tipo, con su periodo. */}
            <BarraInforme titulo={`Desglose de impuestos · ${etiquetaPeriodo}`} columnas={COL_IMPUESTOS}
              filas={impuestos} busqueda={busq} onBusqueda={setBusq} periodo={etiquetaPeriodo}
              totales={[{ etiqueta: "Base", valor: eur(baseTotal) }, { etiqueta: "Cuota", valor: eur(cuotaTotal) }]} />
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Tipo</th><th className={`${TH} text-right`}>Base imponible</th><th className={`${TH} text-right`}>Cuota</th><th className={`${TH} text-right`}>Total</th></tr></thead>
              <tbody>
                {impuestos.map((i) => (
                  <tr key={i.tipo} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{i.tipo}</td>
                    <td className={`${TD} text-right tabular-nums`}>{eur(i.base)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{eur(i.cuota)}</td>
                    <td className={`${TD} text-right font-medium tabular-nums`}>{eur(i.base + i.cuota)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${TD} font-semibold`}>Total</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{eur(baseTotal)}</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{eur(cuotaTotal)}</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{eur(baseTotal + cuotaTotal)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Los precios de carta llevan el impuesto incluido: la base se desglosa hacia
              atrás según la clase fiscal de cada artículo y el territorio del local.
            </p>
          </Tarjeta>
        </div>
      )}
    </ShellApartado>
  );
}
