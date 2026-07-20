import { useMemo, useState } from "react";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Package, Users, Banknote, Landmark, FileText, Receipt,
  Percent, AlertTriangle, Wheat,
} from "lucide-react";
import {
  alergenosDe, sinDeclarar, asistenciaDe, horasDe, ETIQUETA_NO_VENTA,
  type FilaAlergeno, type Fichaje, type NoVenta,
} from "./extras";
import { CatalogoInformes } from "./CatalogoInformes";
import { disponibles, totalInformes } from "./informes";
import {
  ShellApartado, Tarjeta, Segmento, Tabla, RC,
  GraficaBarras, GraficaArea, Donut, Dispersion,
  type SeccionShell, type ColumnaTabla,
} from "../../ui";
import { eur } from "../../lib/dinero";

/** Porcentaje con un decimal. Se guarda como NÚMERO para que ordene bien. */
const pct = (parte: number, total: number) => Math.round((parte / (total || 1)) * 1000) / 10;

/** Cifra corta para los ejes: «1,5 k» en vez de «1.486,30 €», que no cabe. */
export const corto = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",")} k` : String(Math.round(n));

const suma = <T,>(fs: readonly T[], de: (f: T) => number) => r2(fs.reduce((a, f) => a + de(f), 0));
const r2 = (n: number) => Math.round(n * 100) / 100;

const COLOR_CUADRANTE: Record<Cuadrante, string> = {
  Estrella: "bg-mint/15 text-mint", Caballo: "bg-brand/15 text-brand-lit",
  Puzle: "bg-amber/15 text-amber", Perro: "bg-danger/15 text-danger", "—": "bg-paper/8 text-muted",
};
const FILL_CUADRANTE: Record<Cuadrante, string> = {
  Estrella: "fill-mint", Caballo: "fill-brand", Puzle: "fill-amber", Perro: "fill-danger", "—": "fill-muted",
};

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
  { id: "margenes", label: "Márgenes", Icono: Percent },
  { id: "alergenos", label: "Alérgenos", Icono: Wheat },
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
// Ficha de cada artículo: coste unitario SIN impuesto (`product_format.coste`) y
// su tipo de IGIC (el que resuelve `resolver_iva` por clase fiscal × territorio).
// «Tarta de queso» va a propósito sin coste: es el caso normal en un bar recién
// dado de alta, y la pantalla tiene que saber decir «no lo sé».
const FICHA: Record<string, Ficha> = {
  "Menú del día": { coste: 4.15, iva: 7 },
  "Caña": { coste: 0.42, iva: 7 },
  "Croquetas caseras": { coste: 2.3, iva: 7 },
  "Café solo": { coste: 0.26, iva: 7 },
  "Tortilla": { coste: 1.55, iva: 7 },
  "Vino de la casa": { coste: 1.1, iva: 7 },
  "Tarta de queso": { iva: 3 },
};

// Alérgenos de cada plato (`product.alergenos[]`). Los que no salen aquí están
// SIN DECLARAR, que es el caso real de un bar recién dado de alta y lo que el
// informe tiene que cantar.
const ALERGENOS: Record<string, string[]> = {
  "Menú del día": ["Gluten", "Lácteos", "Huevos"],
  "Croquetas caseras": ["Gluten", "Lácteos", "Huevos"],
  "Caña": ["Gluten"],
  "Tortilla": ["Huevos"],
  "Tarta de queso": ["Gluten", "Lácteos", "Huevos"],
  "Vino de la casa": ["Sulfitos"],
};

// Fichajes (`shift`). El de Berto sigue abierto: está trabajando ahora mismo.
const FICHAJES: Fichaje[] = [
  { operario: "María Ruiz", entrada: "2026-07-20T08:02", salida: "2026-07-20T16:10" },
  { operario: "María Ruiz", entrada: "2026-07-19T08:00", salida: "2026-07-19T15:45" },
  { operario: "Lucía Gil", entrada: "2026-07-20T12:00", salida: "2026-07-20T17:30" },
  { operario: "Lucía Gil", entrada: "2026-07-19T20:00", salida: "2026-07-19T02:15" },   // turno de noche
  { operario: "Berto Sanz", entrada: "2026-07-20T19:55", salida: null },
];

// Operaciones que NO son venta (`tipo_operacion` + `motivo_no_venta`).
const NO_VENTAS: NoVenta[] = [
  { tipo: "INVITACION", concepto: "Menú del día", operario: "María Ruiz", motivo: "Cliente habitual", importe: 13 },
  { tipo: "INVITACION", concepto: "2 cafés", operario: "Berto Sanz", motivo: "Queja por espera", importe: 2.6 },
  { tipo: "MERMA", concepto: "Croquetas caseras", operario: "Lucía Gil", motivo: "Se cayó la bandeja", importe: 8.4 },
  { tipo: "AUTOCONSUMO", concepto: "Comida de personal", operario: "María Ruiz", motivo: "Turno partido", importe: 26 },
  { tipo: "FORMACION", concepto: "Caña", operario: "Berto Sanz", motivo: "Prueba de tirador", importe: 2.5 },
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

// ── Márgenes y menú engineering ─────────────────────────────────────────────
// El coste sale de `product_format.coste` (migración 0128), que ya existe y ya lo
// lee el catálogo; aquí solo se cruza con lo vendido.
//
// DOS TRAMPAS, y las dos cambian decisiones de precio:
//
// 1. El margen va sobre la BASE, no sobre el PVP. Los precios de carta llevan el
//    impuesto incluido: contar el IGIC como ingreso propio infla el margen y
//    lleva a bajar precios que no dan lo que parecía.
// 2. Un artículo SIN coste no tiene margen cero ni margen del 100 %: no se sabe.
//    Sale como «sin escandallo» y queda FUERA de los totales. Rellenar el hueco
//    con un cero es lo que convierte un informe en una mentira con formato.
export interface Ficha { coste?: number; iva: number }
export interface FilaMargen {
  nombre: string; familia: string; uds: number;
  importe: number; base: number;
  coste: number | null; margen: number | null; pct: number | null;
}

export function margenDe(
  top: readonly { nombre: string; familia: string; uds: number; importe: number }[],
  ficha: Readonly<Record<string, Ficha>>,
): FilaMargen[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return top.map((t) => {
    const f = ficha[t.nombre];
    const base = r2(t.importe / (1 + (f?.iva ?? 0) / 100));
    if (!f || f.coste === undefined) {
      return { ...t, base, coste: null, margen: null, pct: null };
    }
    const coste = r2(f.coste * t.uds);
    const margen = r2(base - coste);
    return { ...t, base, coste, margen, pct: base ? (margen / base) * 100 : null };
  });
}

/** Totales del periodo. Los artículos sin escandallo se cuentan aparte, no se suman. */
export function resumenMargen(filas: readonly FilaMargen[]) {
  const con = filas.filter((f) => f.margen !== null);
  const base = con.reduce((a, f) => a + f.base, 0);
  const coste = con.reduce((a, f) => a + (f.coste ?? 0), 0);
  const margen = base - coste;
  return {
    base, coste, margen,
    pct: base ? (margen / base) * 100 : null,
    sinCoste: filas.length - con.length,
  };
}

/** Los cuatro cuadrantes de Ágora: se cruza cuánto se vende con cuánto deja. */
export type Cuadrante = "Estrella" | "Caballo" | "Puzle" | "Perro" | "—";

export function cuadrantes(filas: readonly FilaMargen[]): Map<string, Cuadrante> {
  const con = filas.filter((f) => f.pct !== null);
  const m = new Map<string, Cuadrante>(filas.map((f) => [f.nombre, "—" as Cuadrante]));
  if (con.length < 2) return m;                       // con un artículo no hay «alto» ni «bajo»
  const medio = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
  const mUds = medio(con.map((f) => f.uds));
  const mPct = medio(con.map((f) => f.pct!));
  for (const f of con) {
    const vende = f.uds >= mUds, deja = f.pct! >= mPct;
    m.set(f.nombre, vende && deja ? "Estrella" : vende ? "Caballo" : deja ? "Puzle" : "Perro");
  }
  return m;
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

/** Colores fijos por forma de pago: el efectivo es siempre el mismo verde. */
const CLASE_PAGO: Record<string, string> = {
  Tarjeta: "stroke-brand", Efectivo: "stroke-mint", Bizum: "stroke-amber",
};

export function Analisis({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [seccion, setSeccion] = useState("resumen");
  const [ordenProd, setOrdenProd] = useState<"importe" | "uds">("importe");
  // Un buscador por sección: lo que se escribe filtra la tabla Y lo que se exporta.
  // Cada tabla lleva su propio buscador dentro (componente Tabla), así que aquí
  // ya no hace falta estado de búsqueda: solo saltar a la sección del informe.
  const irA = (s: string) => setSeccion(s);
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
  const porDia = periodo === "semana" || periodo === "mes";

  // El % de una familia se mide sobre el ranking, no sobre las ventas del día:
  // el top es una parte de la venta, y dividir por el total daría porcentajes
  // que no suman 100 y parecen un error de cuentas.
  const familias = useMemo(() => porFamilia(top), [top]);
  const ventaTop = suma(top, (t) => t.importe);
  const grafico = useMemo(() => d.franjas.map((f) => ({ etiqueta: f.etiqueta, valor: f.ventas })), [d.franjas]);
  const margenes = useMemo(() => margenDe(top, FICHA), [top]);
  const resMargen = resumenMargen(margenes);
  const cuad = useMemo(() => cuadrantes(margenes), [margenes]);
  // El diario se deriva del periodo (mismo nº de tickets y mismo total que los KPI).
  const diario = useMemo(() => diarioDe(d.tickets, d.ventas, 1000), [d.tickets, d.ventas]);
  const alergenos = useMemo(() => alergenosDe(d.top, ALERGENOS), [d.top]);
  const faltanAlergenos = sinDeclarar(alergenos);
  const asistencia = useMemo(() => asistenciaDe(FICHAJES), []);
  const noVentaTotal = suma(NO_VENTAS, (n) => n.importe);

  // ── Columnas. Se declaran UNA vez: de aquí salen la celda, el orden, la
  // búsqueda, el total y lo que se descarga. `valor` devuelve el dato CRUDO
  // (número pelado); del € y de los miles se encarga la tabla al pintar.
  const COL_FRANJAS: ColumnaTabla<Fila>[] = [
    { titulo: "Franja", valor: (f) => f.etiqueta, total: () => "Total" },
    { titulo: "Tickets", valor: (f) => f.tickets, tipo: "numero", total: (fs) => suma(fs, (f) => f.tickets) },
    { titulo: "Ventas", valor: (f) => f.ventas, tipo: "euro", total: (fs) => suma(fs, (f) => f.ventas) },
    { titulo: "Ticket medio", valor: (f) => r2(f.ventas / Math.max(f.tickets, 1)), tipo: "euro" },
    { titulo: "% del total", valor: (f) => pct(f.ventas, d.ventas), tipo: "numero", celda: (f) => `${pct(f.ventas, d.ventas)} %` },
  ];
  const COL_PRODUCTOS: ColumnaTabla<typeof top[number]>[] = [
    { titulo: "Artículo", valor: (t) => t.nombre, total: () => "Total" },
    { titulo: "Familia", valor: (t) => t.familia },
    { titulo: "Uds", valor: (t) => t.uds, tipo: "numero", total: (fs) => suma(fs, (t) => t.uds) },
    { titulo: "Importe", valor: (t) => t.importe, tipo: "euro", total: (fs) => suma(fs, (t) => t.importe) },
    { titulo: "% del total", valor: (t) => pct(t.importe, d.ventas), tipo: "numero", celda: (t) => `${pct(t.importe, d.ventas)} %` },
  ];
  const COL_FAMILIAS: ColumnaTabla<FilaFamilia>[] = [
    { titulo: "Familia", valor: (f) => f.familia, total: () => "Total" },
    { titulo: "Artículos", valor: (f) => f.articulos, tipo: "numero", total: (fs) => suma(fs, (f) => f.articulos) },
    { titulo: "Uds", valor: (f) => f.uds, tipo: "numero", total: (fs) => suma(fs, (f) => f.uds) },
    { titulo: "Importe", valor: (f) => f.importe, tipo: "euro", total: (fs) => suma(fs, (f) => f.importe) },
    {
      titulo: "% del ranking", valor: (f) => pct(f.importe, ventaTop), tipo: "numero",
      celda: (f) => (
        <span className="flex items-center justify-end gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-paper/10">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${pct(f.importe, ventaTop)}%` }} />
          </span>
          <span className="w-11 tabular-nums text-muted">{pct(f.importe, ventaTop)} %</span>
        </span>
      ),
    },
  ];
  const COL_CAMAREROS: ColumnaTabla<typeof d.camareros[number]>[] = [
    { titulo: "Operario", valor: (c) => c.nombre, total: () => "Total" },
    { titulo: "Tickets", valor: (c) => c.tickets, tipo: "numero", total: (fs) => suma(fs, (c) => c.tickets) },
    { titulo: "Ventas", valor: (c) => c.ventas, tipo: "euro", total: (fs) => suma(fs, (c) => c.ventas) },
    { titulo: "Ticket medio", valor: (c) => r2(c.ventas / Math.max(c.tickets, 1)), tipo: "euro" },
    { titulo: "Propinas", valor: (c) => c.propinas, tipo: "euro", total: (fs) => suma(fs, (c) => c.propinas) },
  ];
  const COL_CIERRES: ColumnaTabla<typeof d.cierres[number]>[] = [
    { titulo: "Cierre", valor: (c) => c.cuando, total: () => "Total" },
    { titulo: "Ventas", valor: (c) => c.ventas, tipo: "euro", total: (fs) => suma(fs, (c) => c.ventas) },
    { titulo: "Efectivo", valor: (c) => c.efectivo, tipo: "euro", total: (fs) => suma(fs, (c) => c.efectivo) },
    { titulo: "Tarjeta", valor: (c) => c.tarjeta, tipo: "euro", total: (fs) => suma(fs, (c) => c.tarjeta) },
    {
      titulo: "Descuadre", valor: (c) => c.descuadre, tipo: "euro",
      total: (fs) => suma(fs, (c) => c.descuadre),
      celda: (c) => {
        const cuadra = Math.abs(c.descuadre) < 0.005;
        return (
          <span className={`rounded-[3px] px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums ${cuadra ? "bg-mint/15" : "bg-amber/15"}`}>
            {cuadra ? "Cuadra" : eur(c.descuadre)}
          </span>
        );
      },
    },
  ];
  const COL_DIARIO: ColumnaTabla<Ticket>[] = [
    { titulo: "Ticket", valor: (t) => t.numero, celda: (t) => <span className="font-mono text-[11.5px] text-muted">{t.numero}</span> },
    { titulo: "Hora", valor: (t) => t.hora, derecha: true },
    { titulo: "Mesa", valor: (t) => t.mesa },
    { titulo: "Operario", valor: (t) => t.operario },
    { titulo: "Pago", valor: (t) => t.pago, celda: (t) => <span className="rounded-[3px] bg-paper/8 px-1.5 py-0.5 text-[11.5px]">{t.pago}</span> },
    { titulo: "Pax", valor: (t) => t.comensales, tipo: "numero", total: (fs) => suma(fs, (t) => t.comensales) },
    { titulo: "Total", valor: (t) => t.total, tipo: "euro", total: (fs) => suma(fs, (t) => t.total) },
  ];
  const COL_MARGENES: ColumnaTabla<FilaMargen>[] = [
    { titulo: "Artículo", valor: (m) => m.nombre, total: () => "Con escandallo" },
    { titulo: "Familia", valor: (m) => m.familia },
    { titulo: "Uds", valor: (m) => m.uds, tipo: "numero" },
    { titulo: "Base", valor: (m) => m.base, tipo: "euro", total: () => r2(resMargen.base) },
    {
      titulo: "Coste", valor: (m) => m.coste, tipo: "euro", total: () => r2(resMargen.coste),
      celda: (m) => (m.coste === null
        ? <span className="text-amber">Sin escandallo</span>
        : <span className="text-muted">{eur(m.coste)}</span>),
    },
    { titulo: "Margen", valor: (m) => m.margen, tipo: "euro", total: () => r2(resMargen.margen) },
    {
      titulo: "% margen", valor: (m) => (m.pct === null ? null : Math.round(m.pct * 10) / 10), tipo: "numero",
      total: () => (resMargen.pct === null ? null : `${resMargen.pct.toFixed(1)} %`),
      celda: (m) => (m.pct === null
        ? <span className="text-muted">—</span>
        : <span className={m.pct < 60 ? "text-amber" : ""}>{m.pct.toFixed(1)} %</span>),
    },
    {
      titulo: "Clasificación", valor: (m) => cuad.get(m.nombre) ?? "—",
      celda: (m) => {
        const c = cuad.get(m.nombre) ?? "—";
        return (
          <span className={`rounded-[3px] px-1.5 py-0.5 text-[11.5px] font-medium ${COLOR_CUADRANTE[c]}`}>{c}</span>
        );
      },
    },
  ];
  const COL_PAGOS: ColumnaTabla<typeof d.pagos[number]>[] = [
    { titulo: "Forma de pago", valor: (p) => p.nombre, total: () => "Total cobrado" },
    { titulo: "Importe", valor: (p) => p.importe, tipo: "euro", total: (fs) => suma(fs, (p) => p.importe) },
    { titulo: "% del total", valor: (p) => pct(p.importe, totalPagos), tipo: "numero", celda: (p) => `${pct(p.importe, totalPagos)} %` },
  ];
  const COL_ALERGENOS: ColumnaTabla<FilaAlergeno>[] = [
    { titulo: "Artículo", valor: (a) => a.nombre },
    { titulo: "Familia", valor: (a) => a.familia },
    {
      titulo: "Alérgenos declarados",
      // Se exporta la lista en texto: el PDF de alérgenos se cuelga en la pared
      // y tiene que poder leerse sin la aplicación delante.
      valor: (a) => (a.declarado ? a.alergenos.join(", ") : "SIN DECLARAR"),
      celda: (a) => (a.declarado ? (
        <span className="flex flex-wrap gap-1">
          {a.alergenos.map((x) => (
            <span key={x} className="rounded-[3px] bg-brand/12 px-1.5 py-0.5 text-[11.5px] text-brand-lit">{x}</span>
          ))}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-amber">
          <AlertTriangle size={13} /> Sin declarar
        </span>
      )),
    },
    { titulo: "Nº", valor: (a) => (a.declarado ? a.alergenos.length : null), tipo: "numero" },
  ];
  const COL_ASISTENCIA: ColumnaTabla<typeof asistencia[number]>[] = [
    { titulo: "Operario", valor: (a) => a.operario, total: () => "Total" },
    { titulo: "Turnos", valor: (a) => a.turnos, tipo: "numero", total: (fs) => suma(fs, (a) => a.turnos) },
    { titulo: "Horas", valor: (a) => a.horas, tipo: "numero", total: (fs) => suma(fs, (a) => a.horas) },
    {
      titulo: "Media por turno", tipo: "numero",
      valor: (a) => (a.turnos - a.abiertos > 0 ? r2(a.horas / (a.turnos - a.abiertos)) : null),
    },
    {
      titulo: "Sin cerrar", valor: (a) => a.abiertos, tipo: "numero",
      celda: (a) => (a.abiertos === 0 ? <span className="text-muted">—</span> : (
        <span className="rounded-[3px] bg-amber/15 px-1.5 py-0.5 text-[11.5px] font-medium text-amber">
          {a.abiertos} en curso
        </span>
      )),
    },
  ];
  const COL_FICHAJES: ColumnaTabla<Fichaje>[] = [
    { titulo: "Operario", valor: (f) => f.operario },
    { titulo: "Entrada", valor: (f) => f.entrada.replace("T", " ") },
    { titulo: "Salida", valor: (f) => f.salida?.replace("T", " ") ?? null, celda: (f) => (f.salida ? f.salida.replace("T", " ") : <span className="text-amber">En curso</span>) },
    { titulo: "Horas", valor: (f) => horasDe(f), tipo: "numero" },
  ];
  const COL_NOVENTA: ColumnaTabla<NoVenta>[] = [
    { titulo: "Tipo", valor: (n) => ETIQUETA_NO_VENTA[n.tipo] },
    { titulo: "Concepto", valor: (n) => n.concepto },
    { titulo: "Motivo", valor: (n) => n.motivo },
    { titulo: "Operario", valor: (n) => n.operario },
    { titulo: "Importe (PVP)", valor: (n) => n.importe, tipo: "euro", total: (fs) => suma(fs, (n) => n.importe) },
  ];
  const COL_IMPUESTOS: ColumnaTabla<typeof d.impuestos[number]>[] = [
    { titulo: "Tipo", valor: (i) => i.tipo, total: () => "Total" },
    { titulo: "Base imponible", valor: (i) => r2(i.base), tipo: "euro", total: (fs) => suma(fs, (i) => i.base) },
    { titulo: "Cuota", valor: (i) => r2(i.cuota), tipo: "euro", total: (fs) => suma(fs, (i) => i.cuota) },
    { titulo: "Total", valor: (i) => r2(i.base + i.cuota), tipo: "euro", total: (fs) => suma(fs, (i) => i.base + i.cuota) },
  ];

  const SUB: Record<string, string> = {
    informes: `${disponibles} de ${totalInformes} informes disponibles`,
    resumen: `${etiquetaPeriodo} · ${d.tickets} tickets`,
    diario: `${etiquetaPeriodo} · ticket a ticket`,
    productos: `${etiquetaPeriodo} · ${d.top.length} artículos en ${porFamilia(d.top).length} familias`,
    margenes: `${etiquetaPeriodo} · margen sobre base y menú engineering`,
    alergenos: `${d.top.length - faltanAlergenos} de ${d.top.length} artículos con alérgenos declarados`,
    camareros: `${etiquetaPeriodo} · rendimiento, asistencia y fichajes`,
    ventas: `${etiquetaPeriodo} · franjas y ${eur(noVentaTotal)} sin cobrar`,
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

          {/* Un periodo largo es una EVOLUCIÓN (línea); un día son bloques
              independientes (barras). Poner línea entre franjas del mismo día
              sugiere una tendencia donde solo hay horas de comida y de cena. */}
          <Tarjeta titulo={porDia ? "Evolución de ventas" : "Ventas por franja horaria"}>
            {porDia
              ? <GraficaArea datos={grafico} fmt={corto} />
              : <GraficaBarras datos={grafico} fmt={corto} />}
          </Tarjeta>

          <div className="grid gap-3 xl:grid-cols-2">
            <Tabla titulo="Lo más vendido" columnas={COL_PRODUCTOS.slice(0, 4)} filas={d.top.slice(0, 6)}
              clave={(t) => t.nombre} periodo={etiquetaPeriodo} porPagina={0} sinBuscador />
            <Tarjeta titulo="Cómo se cobra">
              <Donut
                partes={d.pagos.map((p) => ({ nombre: p.nombre, valor: p.importe, clase: CLASE_PAGO[p.nombre] ?? "stroke-brand-lit" }))}
                centro={{ arriba: corto(totalPagos), abajo: "cobrado" }} />
            </Tarjeta>
          </div>
        </div>
      )}

      {seccion === "ventas" && (
        <div className="space-y-3 p-4">
          <Tarjeta titulo={porDia ? "Evolución de ventas" : "Ventas por franja horaria"}>
            {porDia
              ? <GraficaArea datos={grafico} fmt={corto} alto={200} />
              : <GraficaBarras datos={grafico} fmt={corto} alto={200} />}
          </Tarjeta>

          <Tabla titulo="Detalle por franja" columnas={COL_FRANJAS} filas={d.franjas}
            clave={(f) => f.etiqueta} ordenPor="Ventas" periodo={etiquetaPeriodo} porPagina={12} />

          {/* Lo que salió sin cobrar. Va en su PROPIA tabla y con su propio total
              a propósito: no es venta y no puede sumar a la caja. */}
          <Tabla titulo="Invitaciones y otras no-ventas" columnas={COL_NOVENTA} filas={NO_VENTAS}
            clave={(n) => `${n.tipo}-${n.concepto}-${n.operario}`} ordenPor="Importe (PVP)"
            periodo={etiquetaPeriodo} porPagina={0}
            vacio="No ha salido nada sin cobrar en este periodo."
            nota={<>Estas operaciones <b className="font-medium text-paper">no suman a las ventas</b> ni al arqueo:
              se miden aparte porque son el agujero que conviene vigilar, no ingresos.</>} />
        </div>
      )}

      {seccion === "diario" && (
        <div className="p-4">
          <Tabla titulo="Tickets del periodo" columnas={COL_DIARIO} filas={diario}
            clave={(t) => t.numero} ordenPor="Hora" periodo={etiquetaPeriodo}
            vacio="Todavía no se ha cobrado ningún ticket en este periodo." />
        </div>
      )}

      {seccion === "productos" && (
        <div className="space-y-3 p-4">
          <Tabla titulo="Ranking de artículos" columnas={COL_PRODUCTOS} filas={top}
            clave={(t) => t.nombre} ordenPor={ordenProd === "importe" ? "Importe" : "Uds"}
            periodo={etiquetaPeriodo} porPagina={15}
            acciones={<Segmento valor={ordenProd} onCambio={setOrdenProd}
              opciones={[{ id: "importe" as const, label: "Por importe" }, { id: "uds" as const, label: "Por unidades" }]} />} />

          <Tabla titulo="Por familia" columnas={COL_FAMILIAS} filas={familias}
            clave={(f) => f.familia} ordenPor="Importe" periodo={etiquetaPeriodo} porPagina={0}
            nota="El porcentaje se mide sobre el ranking, no sobre la venta del día." />
        </div>
      )}

      {seccion === "margenes" && (
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Base (sin impuesto)" valor={eur(resMargen.base)} sub="Lo que entra de verdad" />
            <Kpi label="Coste de producto" valor={eur(resMargen.coste)} sub="Escandallo × unidades" />
            <Kpi label="Margen bruto" valor={eur(resMargen.margen)}
              sub={resMargen.pct === null ? "Sin datos" : `${resMargen.pct.toFixed(1)} % sobre la base`} />
            <Kpi label="Sin escandallo" valor={String(resMargen.sinCoste)}
              sub={resMargen.sinCoste ? "Fuera de los totales" : "Todo con coste"} />
          </div>

          {resMargen.sinCoste > 0 && (
            <p className={`${RC} flex items-start gap-2 border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-[12px] leading-relaxed`}>
              <AlertTriangle size={14} className="mt-0.5 flex-none text-amber" />
              <span>
                {resMargen.sinCoste === 1 ? "Hay 1 artículo" : `Hay ${resMargen.sinCoste} artículos`} sin coste en su
                ficha. {resMargen.sinCoste === 1 ? "Queda" : "Quedan"} fuera de los totales:
                dar por hecho un coste de cero diría que {resMargen.sinCoste === 1 ? "deja" : "dejan"} el 100 % de margen,
                que es justo lo contrario de la verdad.
              </span>
            </p>
          )}

          <Tarjeta titulo="Menú engineering">
            {/* El dibujo con el que se decide qué queda en la carta. */}
            <Dispersion puntos={margenes.filter((m) => m.pct !== null).map((m) => ({
              nombre: m.nombre, x: m.uds, y: m.pct!, clase: FILL_CUADRANTE[cuad.get(m.nombre) ?? "—"],
            }))} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-mint" /> Estrella · vende y deja</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-brand" /> Caballo · vende, deja poco</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber" /> Puzle · deja, vende poco</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-danger" /> Perro · ni una cosa ni otra</span>
            </div>
          </Tarjeta>

          <Tabla titulo="Margen por artículo" columnas={COL_MARGENES} filas={margenes}
            clave={(m) => m.nombre} ordenPor="Margen" periodo={etiquetaPeriodo} porPagina={15}
            nota={<>El margen se calcula sobre la <b className="font-medium text-paper">base</b>, no sobre el PVP: el impuesto no es ingreso del local.</>} />
        </div>
      )}

      {seccion === "alergenos" && (
        <div className="space-y-3 p-4">
          {faltanAlergenos > 0 && (
            <p className={`${RC} flex items-start gap-2 border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-[12px] leading-relaxed`}>
              <AlertTriangle size={14} className="mt-0.5 flex-none text-amber" />
              <span>
                {faltanAlergenos === 1 ? "Hay 1 artículo" : `Hay ${faltanAlergenos} artículos`} sin alérgenos
                declarados. La ficha vacía <b className="font-medium text-paper">no significa que no lleven ninguno</b>:
                significa que nadie lo ha rellenado, y no hay forma de distinguirlo. Informar de los 14 alérgenos
                del reglamento UE 1169/2011 es obligatorio y la inspección lo pide.
              </span>
            </p>
          )}
          <Tabla titulo="Alérgenos por artículo" columnas={COL_ALERGENOS} filas={alergenos}
            clave={(a) => a.nombre} ordenPor="Artículo" descPorDefecto={false}
            periodo={etiquetaPeriodo} porPagina={20}
            nota="Descárgalo en PDF para tenerlo a la vista en la barra y en la carta." />
        </div>
      )}

      {seccion === "camareros" && (
        <div className="space-y-3 p-4">
          <Tabla titulo="Ventas por operario" columnas={COL_CAMAREROS} filas={d.camareros}
            clave={(c) => c.nombre} ordenPor="Ventas" periodo={etiquetaPeriodo} porPagina={0} />

          <Tabla titulo="Asistencia" columnas={COL_ASISTENCIA} filas={asistencia}
            clave={(a) => a.operario} ordenPor="Horas" periodo={etiquetaPeriodo} porPagina={0}
            vacio="Todavía no hay fichajes."
            nota="Un turno sin cerrar no cuenta cero horas: se marca aparte para no hundir la media de quien está trabajando ahora." />

          <Tabla titulo="Fichajes" columnas={COL_FICHAJES} filas={FICHAJES}
            clave={(f) => `${f.operario}-${f.entrada}`} ordenPor="Entrada"
            periodo={etiquetaPeriodo} porPagina={20} vacio="Todavía no hay fichajes." />
        </div>
      )}

      {seccion === "caja" && (
        <div className="space-y-3 p-4">
          {/* Lo primero que se cuadra al cerrar: cuánto entró por cada vía. */}
          <Tabla titulo="Formas de pago" columnas={COL_PAGOS} filas={d.pagos}
            clave={(p) => p.nombre} ordenPor="Importe" periodo={etiquetaPeriodo} porPagina={0} sinBuscador />

          <Tabla titulo="Últimos cierres (Z)" columnas={COL_CIERRES} filas={d.cierres}
            clave={(c) => c.cuando} ordenPor="Cierre" periodo={etiquetaPeriodo} porPagina={0}
            vacio="Aún no hay cierres en este periodo." />
        </div>
      )}

      {seccion === "impuestos" && (
        <div className="p-4">
          {/* El informe que pide el gestor: base y cuota por tipo, con su periodo. */}
          <Tabla titulo="Desglose por tipo" columnas={COL_IMPUESTOS} filas={d.impuestos}
            clave={(i) => i.tipo} ordenPor="Base imponible" periodo={etiquetaPeriodo} porPagina={0} sinBuscador
            nota="Los precios de carta llevan el impuesto incluido: la base se desglosa hacia atrás según la clase fiscal de cada artículo y el territorio del local." />
        </div>
      )}
    </ShellApartado>
  );
}
