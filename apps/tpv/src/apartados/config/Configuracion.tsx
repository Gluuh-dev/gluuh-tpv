import { useMemo, useState, type ReactNode } from "react";
import { useRuta, navegar } from "../../lib/rutas";
import { House, Search, Sun, Moon } from "lucide-react";
import { ShellApartado, Tarjeta, R, type GrupoShell } from "../../ui";
import { useTema } from "../../lib/tema";
import { GRUPOS, type Seccion } from "./secciones";
import { Productos } from "./mantenimiento/Productos";
import { Compras } from "./mantenimiento/Compras";
import { Impresoras } from "./mantenimiento/Impresoras";

// CONFIGURACIÓN del TPV. El mapa de secciones vive en `secciones.tsx` (inventario
// del panel Next); aquí se sirve con el shell de gestión, en modo TÁCTIL, porque
// desde el terminal se tiene que poder configurar el local entero.
//
// El lateral arranca PLEGADO a propósito: en un terminal de 15" un menú abierto
// se come un cuarto de la pantalla y las pantallas de mantenimiento (tablas
// anchas de precios) necesitan ese ancho. Se despliega tocando la marca y
// recuerda la preferencia. Ese fue el motivo del cajón anterior; con el lateral
// plegable se conserva el ancho Y queda la navegación siempre a la vista.

// Secciones con pantalla completa propia (mandan sobre la ficha de alcance).
const PANTALLAS: Record<string, (p: Readonly<{ onSalir: () => void }>) => ReactNode> = {
  productos: Productos,
  compras: Compras,
  impresoras: Impresoras,
};

const GENERAL = "__general__";

// «impresion» debe encontrar «Impresión»: fuera acentos y mayúsculas.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TODAS: Seccion[] = GRUPOS.flatMap((g) => g.secciones);

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

// Ficha de alcance: qué se configurará en la sección (honesta con el estado).
function FichaAlcance({ s }: Readonly<{ s: Seccion }>) {
  return (
    <div className="max-w-3xl p-4">
      <Tarjeta titulo="Qué se configura aquí" extra={<BadgeEstado funcional={s.funcional} />}>
        <ul className="space-y-2">
          {s.alcance.map((a) => (
            <li key={a} className={`flex items-start gap-3 ${R} border border-line bg-paper/3 px-3.5 py-3 text-[13.5px] leading-snug`}>
              <span className="mt-1.75 h-1.5 w-1.5 flex-none rounded-full bg-brand-lit" />
              {a}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Esta sección se construye en el terminal por fases; mientras tanto, estos
          ajustes viven en el panel web (modo online).
        </p>
      </Tarjeta>
    </div>
  );
}

// «Preferencias» — la primera sección FUNCIONAL: tema de este terminal.
function Preferencias() {
  const { oscuro, fijar } = useTema();
  const opciones = [
    { clave: "light" as const, titulo: "Claro", desc: "Para barras con mucha luz.", Icono: Sun, activa: !oscuro },
    { clave: "dark" as const, titulo: "Oscuro", desc: "Para salas y turnos de noche.", Icono: Moon, activa: oscuro },
  ];
  return (
    <div className="max-w-3xl p-4">
      <Tarjeta titulo="Tema de este terminal">
        <div className="grid grid-cols-2 gap-3">
          {opciones.map((o) => (
            <button key={o.clave} type="button" onClick={() => fijar(o.clave)}
              className={`flex min-h-16 items-center gap-3.5 ${R} border p-4 text-left transition-transform active:scale-[.98] ${
                o.activa ? "border-brand-lit bg-accent-soft" : "border-line bg-paper/3"
              }`}>
              <span className={`grid h-10 w-10 flex-none place-items-center ${R} ${o.activa ? "bg-brand text-white" : "bg-paper/5 text-muted"}`}>
                <o.Icono size={18} />
              </span>
              <span>
                <b className="block text-[14px] font-semibold">{o.titulo}</b>
                <span className="text-[12px] text-muted">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted">Se guarda en este terminal; los demás no cambian.</p>
      </Tarjeta>
    </div>
  );
}

// Portada: los dominios de un vistazo, para entrar por donde toque.
function VistaGeneral({ onIr }: Readonly<{ onIr: (id: string) => void }>) {
  return (
    <div className="p-4">
      <p className="pb-3 text-[12.5px] text-muted">
        {TODAS.length} secciones agrupadas en {GRUPOS.length} dominios. Entra por un dominio
        o busca el ajuste por nombre.
      </p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {GRUPOS.map((g) => (
          <button key={g.titulo} type="button" onClick={() => onIr(g.secciones[0]!.id)}
            className={`flex flex-col gap-3 ${R} border border-line bg-panel p-4 text-left transition-transform active:scale-[.98]`}>
            <span className="flex items-center justify-between">
              <span className={`grid h-9 w-9 place-items-center ${R} bg-brand/10 text-brand-lit`}><g.Icono size={18} /></span>
              <span className="text-[11px] tabular-nums text-muted">{g.secciones.length}</span>
            </span>
            <span>
              <b className="block text-[14px] font-semibold">{g.titulo}</b>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                {g.secciones.map((s) => s.titulo).join(" · ")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Configuracion({ onVolver }: Readonly<{ onVolver: () => void }>) {
  // La sección VIVE EN LA URL: `/config/impresoras` se puede dictar por teléfono,
  // dejar como acceso directo en el terminal de cocina, y el botón Atrás hace lo
  // que todo el mundo espera. Una sección desconocida cae a la vista general.
  const ruta = useRuta();
  // La vista general es `/config` a secas: no tiene por qué asomar un
  // `__general__` en la barra de direcciones.
  const selId = ruta.seccion && TODAS.some((s) => s.id === ruta.seccion) ? ruta.seccion : GENERAL;
  // `reemplazar` al elegir sección: si cada clic del menú apilara historial,
  // salir de Configuración pediría catorce veces Atrás.
  const setSelId = (id: string) =>
    navegar(id === GENERAL ? { vista: "config" } : { vista: "config", seccion: id }, true);
  const [q, setQ] = useState("");

  // El buscador FILTRA el lateral (no abre un desplegable aparte): escribes
  // «impresora» y el menú se queda con lo que encaja.
  const grupos: GrupoShell[] = useMemo(() => {
    const nq = norm(q.trim());
    const base: GrupoShell[] = [
      { titulo: "Resumen", secciones: [{ id: GENERAL, label: "Vista general", Icono: House }] },
      ...GRUPOS.map((g) => ({
        titulo: g.titulo,
        secciones: g.secciones.map((s) => ({ id: s.id, label: s.titulo, Icono: s.Icono })),
      })),
    ];
    if (!nq) return base;
    return base
      .map((g) => ({
        ...g,
        secciones: g.secciones.filter((s) => {
          const sec = TODAS.find((x) => x.id === s.id);
          return norm(`${s.label} ${sec?.desc ?? ""} ${sec?.alcance.join(" ") ?? ""}`).includes(nq);
        }),
      }))
      .filter((g) => g.secciones.length > 0);
  }, [q]);

  const sel = TODAS.find((s) => s.id === selId) ?? null;
  const Pantalla = PANTALLAS[selId];

  let contenido: ReactNode;
  if (Pantalla) contenido = <Pantalla onSalir={() => setSelId(GENERAL)} />;
  else if (selId === "preferencias") contenido = <Preferencias />;
  else if (sel) contenido = <FichaAlcance s={sel} />;
  else contenido = <VistaGeneral onIr={setSelId} />;

  return (
    <ShellApartado
      app="Configuración" claveLateral="config" grupos={grupos}
      seccion={selId} onSeccion={setSelId} onVolver={onVolver}
      tactil plegadoPorDefecto contenidoPropio={!!Pantalla}
      subtitulo={sel?.desc ?? "Todo lo del local, en un sitio"}
      acciones={
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un ajuste…"
            className={`h-10 w-56 ${R} border border-line bg-background pl-8 pr-2.5 text-[13px] text-paper placeholder:text-muted focus:border-brand-lit focus:outline-none`} />
        </div>
      }
    >
      {contenido}
    </ShellApartado>
  );
}
