// Gráficas del Análisis, en SVG y CSS a pelo. Sin librería: son cuatro dibujos y
// cualquier paquete de charts mete cientos de kB en un TPV que arranca en un
// mini-PC. Todas aguantan datos vacíos y un máximo de 0 sin dividir por cero.
//
// Sin `hover:` (regla de la operativa): en una pantalla táctil no hay puntero, así
// que las cifras se ven SIEMPRE escritas, nunca en un tooltip que nadie va a abrir.

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Escalón «redondo» del eje (1, 2, 2,5, 5, 10 × potencia de 10). */
export function paso(max: number, divisiones = 4): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const bruto = max / divisiones;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  // Se redondea al escalón MÁS CERCANO, no al primero que quepa: con «el primero
  // que quepa», un máximo de 440 daba saltos de 200 y el eje llegaba a 600 — un
  // tercio del gráfico en blanco y las barras aplastadas.
  const n = bruto / mag;
  return (n < 1.5 ? 1 : n < 2.25 ? 2 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * mag;
}

/** Marcas del eje Y, de 0 al primer redondo por encima del máximo. */
export function ticks(max: number, divisiones = 4): number[] {
  const p = paso(max, divisiones);
  const n = Math.max(Math.ceil((Number.isFinite(max) && max > 0 ? max : 0) / p), 1);
  return Array.from({ length: n + 1 }, (_, i) => r2(i * p));
}

/** El primer y el último punto se anclan por su borde: centrados se salían de la tarjeta. */
const anclaje = (i: number, n: number) =>
  i === 0 ? "translate-x-0" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2";

const Vacio = ({ alto, texto }: Readonly<{ alto: number; texto: string }>) => (
  <div className="flex items-center justify-center text-[12px] text-muted" style={{ height: alto }}>{texto}</div>
);

// ── Barras verticales, con eje y rejilla ────────────────────────────────────
export function GraficaBarras({
  datos, alto = 170, fmt = (n: number) => String(Math.round(n)), vacio = "Sin datos en este periodo",
}: Readonly<{
  datos: readonly { etiqueta: string; valor: number }[];
  alto?: number; fmt?: (n: number) => string; vacio?: string;
}>) {
  if (datos.length === 0) return <Vacio alto={alto} texto={vacio} />;
  const max = Math.max(...datos.map((d) => d.valor), 0);
  const ejes = ticks(max);
  const tope = ejes.at(-1) || 1;

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative w-9 flex-none" style={{ height: alto }}>
          {ejes.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums text-muted"
              style={{ bottom: `${(t / tope) * 100}%` }}>{fmt(t)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: alto }}>
          {ejes.map((t) => (
            <span key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-line" : "border-line/60"}`}
              style={{ bottom: `${(t / tope) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-1.5">
            {datos.map((d) => {
              const pct = (d.valor / tope) * 100;
              const punta = d.valor === max && max > 0;
              return (
                <div key={d.etiqueta} className="relative h-full min-w-0 flex-1">
                  <div className={`absolute inset-x-0 bottom-0 rounded-t-[3px] ${punta ? "bg-brand" : "bg-brand/35"}`}
                    style={{ height: `${Math.max(pct, d.valor > 0 ? 1.5 : 0)}%` }} />
                  <span className={`absolute inset-x-0 text-center text-[10px] tabular-nums ${punta ? "font-semibold text-brand-lit" : "text-muted"}`}
                    style={{ bottom: `calc(${pct}% + 3px)` }}>{fmt(d.valor)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        <span className="w-9 flex-none" />
        <div className="flex min-w-0 flex-1 gap-1.5">
          {datos.map((d) => (
            <span key={d.etiqueta} className="min-w-0 flex-1 truncate text-center text-[10.5px] text-muted">{d.etiqueta}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Área + línea: la evolución ──────────────────────────────────────────────
// `preserveAspectRatio="none"` estira el trazo, así que el grosor se fija con
// `vector-effect` y NO se dibujan círculos (saldrían ovalados).
export function GraficaArea({
  datos, alto = 170, fmt = (n: number) => String(Math.round(n)), vacio = "Sin datos en este periodo",
}: Readonly<{
  datos: readonly { etiqueta: string; valor: number }[];
  alto?: number; fmt?: (n: number) => string; vacio?: string;
}>) {
  if (datos.length === 0) return <Vacio alto={alto} texto={vacio} />;
  if (datos.length === 1) return <GraficaBarras datos={datos} alto={alto} fmt={fmt} />;

  const max = Math.max(...datos.map((d) => d.valor), 0);
  const ejes = ticks(max);
  const tope = ejes.at(-1) || 1;
  const W = 1000, H = 300;
  const x = (i: number) => (i / (datos.length - 1)) * W;
  const y = (v: number) => H - (v / tope) * H;
  const linea = datos.map((d, i) => `${i === 0 ? "M" : "L"}${r2(x(i))},${r2(y(d.valor))}`).join(" ");

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative w-9 flex-none" style={{ height: alto }}>
          {ejes.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums text-muted"
              style={{ bottom: `${(t / tope) * 100}%` }}>{fmt(t)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height: alto }}>
          {ejes.map((t) => (
            <span key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-line" : "border-line/60"}`}
              style={{ bottom: `${(t / tope) * 100}%` }} />
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d={`${linea} L${W},${H} L0,${H} Z`} className="fill-brand/15" />
            <path d={linea} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round" className="stroke-brand" />
          </svg>
          {datos.map((d, i) => (
            <span key={d.etiqueta}
              className={`absolute text-[10px] tabular-nums text-muted ${anclaje(i, datos.length)}`}
              style={{ left: `${(i / (datos.length - 1)) * 100}%`, bottom: `calc(${(d.valor / tope) * 100}% + 4px)` }}>
              {fmt(d.valor)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        <span className="w-9 flex-none" />
        <div className="relative min-w-0 flex-1">
          {datos.map((d, i) => (
            <span key={d.etiqueta} className={`absolute whitespace-nowrap text-[10.5px] text-muted ${anclaje(i, datos.length)}`}
              style={{ left: `${(i / (datos.length - 1)) * 100}%` }}>{d.etiqueta}</span>
          ))}
          <span className="block h-4" />
        </div>
      </div>
    </div>
  );
}

// ── Donut: el reparto (formas de pago) ──────────────────────────────────────
// Los arcos son un `stroke-dasharray` sobre círculos: sin trigonometría y sin
// el bug clásico del arco de 360° que desaparece por el flag del path.
export function Donut({
  partes, tamano = 132, centro,
}: Readonly<{
  partes: readonly { nombre: string; valor: number; clase: string }[];
  tamano?: number; centro?: { arriba: string; abajo: string };
}>) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  const R = 42, C = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex-none" style={{ width: tamano, height: tamano }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth={14} className="stroke-line" />
          {total > 0 && partes.map((p) => {
            const largo = (p.valor / total) * C;
            const offset = -acumulado;
            acumulado += largo;
            return (
              <circle key={p.nombre} cx="50" cy="50" r={R} fill="none" strokeWidth={14}
                strokeDasharray={`${r2(largo)} ${r2(C - largo)}`} strokeDashoffset={r2(offset)}
                className={p.clase} />
            );
          })}
        </svg>
        {centro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-[15px] font-semibold leading-none tabular-nums">{centro.arriba}</b>
            <span className="mt-1 text-[10.5px] text-muted">{centro.abajo}</span>
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {partes.map((p) => (
          <li key={p.nombre} className="flex items-baseline gap-2 text-[12.5px]">
            <span className={`h-2.5 w-2.5 flex-none translate-y-0.5 rounded-xs ${p.clase.replace("stroke-", "bg-")}`} />
            <b className="mr-auto font-medium">{p.nombre}</b>
            <span className="tabular-nums">
              {p.valor.toFixed(2).replace(".", ",")} €
              <span className="ml-1 text-muted">· {total ? ((p.valor / total) * 100).toFixed(0) : 0} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Dispersión: menú engineering ────────────────────────────────────────────
// El dibujo de Ágora: unidades (lo que vende) contra % de margen (lo que deja),
// partido por las dos medias. Aquí sí hay escala uniforme, así que el texto no
// se deforma y se pueden poner los nombres.
export function Dispersion({
  puntos, alto = 300,
}: Readonly<{
  puntos: readonly { nombre: string; x: number; y: number; clase: string }[];
  alto?: number;
}>) {
  if (puntos.length === 0) return <Vacio alto={alto} texto="Sin artículos con escandallo" />;

  // El viewBox lleva el aspecto: `w-full` + alto automático hace que el dibujo
  // LLENE la tarjeta. Con alto fijo y `meet`, el SVG se dibujaba a su tamaño
  // natural centrado y dejaba media tarjeta en blanco a los lados.
  const W = 1000, H = 340;
  const M = { i: 46, d: 16, arr: 16, ab: 34 };          // sitio para los rótulos de los ejes

  // La escala se ajusta A LOS DATOS con un margen, no arranca en 0: los márgenes
  // de hostelería viven todos entre el 60 % y el 85 %, y forzar el 0 los apelotona
  // en una franja de dos píxeles donde no se distingue el bueno del malo.
  const holgura = (vs: number[]): [number, number] => {
    const min = Math.min(...vs), max = Math.max(...vs);
    const r = max - min || Math.abs(max) || 1;
    return [min - r * 0.18, max + r * 0.18];
  };
  const [x0, x1] = holgura(puntos.map((p) => p.x));
  const [y0, y1] = holgura(puntos.map((p) => p.y));
  const px = (x: number) => M.i + ((x - x0) / (x1 - x0)) * (W - M.i - M.d);
  const py = (y: number) => H - M.ab - ((y - y0) / (y1 - y0)) * (H - M.arr - M.ab);

  const media = (vs: number[]) => vs.reduce((a, v) => a + v, 0) / vs.length;
  const mx = px(media(puntos.map((p) => p.x)));
  const my = py(media(puntos.map((p) => p.y)));
  const izq = M.i, der = W - M.d, arr = M.arr, ab = H - M.ab;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="Unidades vendidas frente a porcentaje de margen, partido por las dos medias">
        {/* Los cuatro cuadrantes, del color de su etiqueta: el sitio en el que
            cae un punto ya dice de qué tipo es, sin ir a mirar la leyenda. */}
        <rect x={mx} y={arr} width={der - mx} height={my - arr} className="fill-mint/10" />
        <rect x={izq} y={arr} width={mx - izq} height={my - arr} className="fill-amber/10" />
        <rect x={mx} y={my} width={der - mx} height={ab - my} className="fill-brand/10" />
        <rect x={izq} y={my} width={mx - izq} height={ab - my} className="fill-danger/8" />

        <line x1={mx} y1={arr} x2={mx} y2={ab} strokeWidth={1} strokeDasharray="5 5" className="stroke-line" />
        <line x1={izq} y1={my} x2={der} y2={my} strokeWidth={1} strokeDasharray="5 5" className="stroke-line" />
        <line x1={izq} y1={arr} x2={izq} y2={ab} strokeWidth={1} className="stroke-line" />
        <line x1={izq} y1={ab} x2={der} y2={ab} strokeWidth={1} className="stroke-line" />

        <text x={izq} y={arr - 4} className="fill-muted" style={{ fontSize: 11 }}>% de margen</text>
        <text x={der} y={ab + 24} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>unidades vendidas →</text>
        <text x={izq - 8} y={py(y1) + 4} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>{Math.round(y1)} %</text>
        <text x={izq - 8} y={py(y0) + 4} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>{Math.round(y0)} %</text>

        {puntos.map((p, i) => {
          // El nombre va arriba o abajo según la posición en la lista: con todos
          // arriba, dos artículos parecidos se tapaban el uno al otro.
          const arriba = i % 2 === 0;
          return (
            <g key={p.nombre}>
              <circle cx={px(p.x)} cy={py(p.y)} r={6} className={p.clase} />
              <text x={px(p.x)} y={py(p.y) + (arriba ? -13 : 21)} textAnchor="middle"
                className="fill-paper" style={{ fontSize: 12 }}>{p.nombre}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
