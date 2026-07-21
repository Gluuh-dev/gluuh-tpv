import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard, Layers, Info, Camera,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Search, X, Copy, FileDown,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, claseEntrada,
} from "./Marco";
import { InterruptorSN } from "./ClasificacionUI";
import { AspectoClasificacion, PreviaClasificacion } from "./AspectoClasificacion";
import {
  cargarFamilias, guardarFamilia, borrarFamilia, cargarGruposMayores, cargarCategorias,
  subirFotoClasificacion, type Familia, type GrupoMayor, type Categoria,
} from "./clasificacion";
import { exportarTablaPdf, type ColumnaPdf } from "./exportar";
import { registrarEvento } from "../../../lib/trazabilidad";
import { CATEGORIAS_DEMO } from "../../tpv/datos";

// Las tres pestañas del patrón de Configuración; dentro de «Ficha», las subpestañas.
const SUBS = ["General", "Categorías"] as const;
type Sub = (typeof SUBS)[number];

// Columnas del PDF de exportación de familias.
const COLS_EXPORT: readonly ColumnaPdf[] = [
  { clave: "nombre", titulo: "Familia", ancho: 34 },
  { clave: "orden", titulo: "Orden venta", ancho: 12, alin: "der" },
  { clave: "ordenFactura", titulo: "Orden factura", ancho: 13, alin: "der" },
  { clave: "combinable", titulo: "Combinable", ancho: 12 },
  { clave: "venta", titulo: "En venta", ancho: 10 },
  { clave: "menus", titulo: "En menús", ancho: 10 },
];

// ────────────────────────────────────────────────────────────────────────────
// FAMILIAS — el primer nivel de la carta (Bebidas, Cocina, Postres).
//
// Mismo gesto que Artículos: consulta ⇄ Modificar. Contra el nodo si el terminal
// está emparejado; si no, la lista de ejemplo (las familias de la carta demo).
// ────────────────────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");

const DEMO: Familia[] = CATEGORIAS_DEMO.map((c, i) => ({
  id: c.id, nombre: c.nombre, color: c.color, orden: i + 1,
  combinable: false, mostrarVenta: true, mostrarMenus: true, textoBoton: "", ordenImpresion: i + 1,
  familiaPadreId: null, grupoMayorId: null, fotoUrl: "",
}));

export function Familias({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const ruta = useRuta();
  const [familias, setFamilias] = useState<Familia[]>(DEMO);
  const [gruposMayores, setGruposMayores] = useState<GrupoMayor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<Familia | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [q, setQ] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [aspecto, setAspecto] = useState(false);
  const [informe, setInforme] = useState(false);
  const [sub, setSub] = useState<Sub>("General");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Selección en la LISTA (marcar sin abrir), orden por columna y marcados (para
  // duplicar/exportar) — mismo patrón que Productos.
  const [filaSel, setFilaSel] = useState<string | null>(null);
  const [orden, setOrden] = useState<{ col: string; asc: boolean } | null>(null);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const filaRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    let vivo = true;
    cargarFamilias().then((f) => { if (vivo && f) { setFamilias(f); setReal(true); } });
    cargarGruposMayores().then((g) => { if (vivo) setGruposMayores(g); });
    cargarCategorias().then((c) => { if (vivo && c) setCategorias(c); });
    return () => { vivo = false; };
  }, []);

  const notificar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 2600); };

  const lista = useMemo(() => {
    const nq = norm(q.trim());
    return nq ? familias.filter((f) => norm(f.nombre).includes(nq)) : familias;
  }, [familias, q]);

  const enUrl = ruta.id ? familias.findIndex((f) => f.id === ruta.id) : -1;
  const fam = borrador ?? familias[Math.max(enUrl, 0)];
  const abrir = (id?: string) => navegar({ vista: "config", seccion: "familias", ...(id ? { id } : {}) }, !id);

  // Orden por la columna que se pulse (asc/desc), sobre la lista ya filtrada.
  const listaOrd = useMemo(() => {
    if (!orden) return lista;
    const val = (f: Familia): string | number => {
      switch (orden.col) {
        case "nombre": return norm(f.nombre);
        case "orden": return f.orden;
        case "ordenFactura": return f.ordenImpresion;
        case "combinable": return f.combinable ? 1 : 0;
        case "venta": return f.mostrarVenta ? 1 : 0;
        case "menus": return f.mostrarMenus ? 1 : 0;
        default: return 0;
      }
    };
    return [...lista].sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return orden.asc ? c : -c;
    });
  }, [lista, orden]);

  const ordenar = (col: string) => setOrden((o) => (o?.col === col ? { col, asc: !o.asc } : { col, asc: true }));

  // La familia sobre la que actúan las acciones de la Lista: la fila marcada (o,
  // en la ficha, la de la URL). Cae a la primera visible.
  const famAccion = (filaSel && familias.find((f) => f.id === filaSel)) || fam;
  const idxEnLista = famAccion ? listaOrd.findIndex((f) => f.id === famAccion.id) : -1;
  const seleccionar = (i: number) => { const f = listaOrd[Math.max(0, Math.min(listaOrd.length - 1, i))]; if (f) setFilaSel(f.id); };
  // Recorrer registros abiertos en la ficha (Inicio/Anterior/Siguiente/Fin).
  const idxLista = fam ? listaOrd.findIndex((f) => f.id === fam.id) : -1;
  const irA = (i: number) => { const f = listaOrd[i]; if (f) abrir(f.id); };

  const marcar = (id: string) => setMarcados((m) => { const s = new Set(m); if (!s.delete(id)) { s.add(id); } return s; });

  // Al mover la selección con las flechas, traer la fila a la vista (no hay barra).
  useEffect(() => { filaRef.current?.scrollIntoView({ block: "nearest" }); }, [filaSel]);

  /** Cabecera de columna ORDENABLE. */
  const Enc = (col: string, label: string, cls = "") => {
    const on = orden?.col === col;
    const just = cls.includes("right") ? "justify-end" : cls.includes("center") ? "justify-center" : "";
    return (
      <th className={cls}>
        <button type="button" onClick={() => ordenar(col)} className={`inline-flex w-full items-center gap-1 ${just}`}>
          <span>{label}</span>
          <span className={`text-[8px] leading-none ${on ? "text-brand-lit" : "text-transparent"}`}>{on && orden.asc ? "▲" : "▼"}</span>
        </button>
      </th>
    );
  };

  const editando = borrador !== null;
  const ro = !editando;
  // «Informe» es un eje aparte (booleano), no derivado de la selección: así no
  // se pisa con el ruta→Ficha y no hay bucle de efectos.
  const pestanaBase = borrador || ruta.id ? "Ficha" : "Lista";
  const pestana = informe ? "Informes" : pestanaBase;

  const irPestana = (p: string) => {
    if (editando) return;                       // no se salta de pestaña a medio editar
    if (p === "Informes") { setInforme(true); return; }
    setInforme(false);
    abrir(p === "Lista" ? undefined : fam?.id);
  };

  const set = <K extends keyof Familia>(campo: K, valor: Familia[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const crear = () => {
    setNuevo(true);
    setBorrador({
      id: crypto.randomUUID(), nombre: "", color: "#2f7fd0",
      orden: familias.length + 1, combinable: false, mostrarVenta: true, mostrarMenus: true,
      textoBoton: "", ordenImpresion: familias.length + 1,
      familiaPadreId: null, grupoMayorId: null, fotoUrl: "",
    });
  };

  /** Modificar desde la Lista: abre la ficha de la fila marcada y entra a editar. */
  const abrirYModificar = () => {
    if (!famAccion) return;
    abrir(famAccion.id);
    setBorrador(structuredClone(famAccion));
  };

  /** Duplica la fila marcada y abre la copia directamente en edición. */
  const duplicar = () => {
    if (!famAccion || ocupado) return;
    const copia: Familia = {
      ...structuredClone(famAccion), id: crypto.randomUUID(),
      nombre: `${famAccion.nombre} (copia)`, orden: familias.length + 1,
    };
    setOcupado(true);
    (async () => {
      try {
        if (real) await guardarFamilia(copia);
        setFamilias((fs) => [...fs, copia]);
        void registrarEvento({ entidad: "family", accion: "duplicar", entidadId: copia.id, resumen: copia.nombre, datos: copia });
        abrir(copia.id); setBorrador(structuredClone(copia)); setNuevo(false);
        notificar(real ? "Familia duplicada." : "Duplicada solo en este terminal.");
      } catch (e: unknown) { notificar(`No se ha podido duplicar: ${mensaje(e)}`); }
      finally { setOcupado(false); }
    })();
  };

  /** Exporta a PDF las familias marcadas (o, si no hay marcadas, las que se ven). */
  const exportar = () => {
    const src = marcados.size > 0 ? familias.filter((f) => marcados.has(f.id)) : listaOrd;
    if (src.length === 0) return;
    const filas = src.map((f) => ({
      nombre: f.nombre,
      orden: String(f.orden),
      ordenFactura: String(f.ordenImpresion),
      combinable: f.combinable ? "Sí" : "—",
      venta: f.mostrarVenta ? "Sí" : "—",
      menus: f.mostrarMenus ? "Sí" : "—",
    }));
    void exportarTablaPdf("Familias", COLS_EXPORT, filas, `familias-${new Date().toISOString().slice(0, 10)}`);
  };

  const guardar = () => {
    if (!borrador || ocupado) return;
    if (!borrador.nombre.trim()) { notificar("La familia necesita un nombre."); return; }
    setOcupado(true);
    (async () => {
      try {
        let listo = borrador;
        if (real) {
          if (listo.fotoUrl.startsWith("data:")) {
            const blob = await (await fetch(listo.fotoUrl)).blob();
            listo = { ...listo, fotoUrl: await subirFotoClasificacion("familias", listo.id, blob) };
          }
          await guardarFamilia(listo);
        }
        setFamilias((fs) => nuevo ? [...fs, listo] : fs.map((f) => (f.id === listo.id ? listo : f)));
        void registrarEvento({ entidad: "family", accion: nuevo ? "crear" : "modificar", entidadId: listo.id, resumen: listo.nombre, datos: listo });
        if (nuevo) abrir(listo.id);
        setBorrador(null); setNuevo(false);
        notificar(real ? "Familia guardada." : "Guardado solo en este terminal: sin emparejar, se pierde al recargar.");
      } catch (e: unknown) { notificar(`No se ha guardado: ${mensaje(e)}`); }
      finally { setOcupado(false); }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    const victima = famAccion;
    if (!victima) return;
    const seguir = () => {
      const i = listaOrd.findIndex((f) => f.id === victima.id);
      setFamilias((fs) => fs.filter((f) => f.id !== victima.id));
      setMarcados((m) => { const s = new Set(m); s.delete(victima.id); return s; });
      void registrarEvento({ entidad: "family", accion: "eliminar", entidadId: victima.id, resumen: victima.nombre, datos: victima });
      // Borrar desde la LISTA me deja EN la lista: la fila desaparece y marco la vecina.
      if (pestana === "Lista") {
        const vecina = listaOrd[i + 1] ?? listaOrd[i - 1];
        setFilaSel(vecina ? vecina.id : null);
      } else {
        abrir();
      }
      notificar("Familia eliminada.");
    };
    if (!real) { seguir(); return; }
    borrarFamilia(victima.id).then(seguir).catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
  };

  const finComun = (
    <>
      <span className="flex-1" />
      {aviso && <span className="rounded-full bg-paper px-4 py-2 text-[12.5px] font-bold text-ink">{aviso}</span>}
      <BotonPie Icono={Keyboard} onClick={abrirTeclado}>Teclado</BotonPie>
    </>
  );

  let pie: ReactNode;
  if (editando) {
    pie = (
      <>
        <BotonPie Icono={CheckCircle2} tono="ok" onClick={guardar}>Aceptar</BotonPie>
        <BotonPie Icono={XCircle} tono="no" onClick={() => { setBorrador(null); setNuevo(false); }}>Cancelar</BotonPie>
        {finComun}
        <span className="rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-[12px] font-bold text-amber">
          {nuevo ? "Nueva familia" : `Editando · ${fam?.nombre ?? ""}`}
        </span>
      </>
    );
  } else if (pestana === "Informes") {
    pie = (
      <>
        {finComun}
        <SepPie />
        <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir}>Salir</BotonPie>
      </>
    );
  } else if (pestana === "Lista") {
    // En la Lista, las flechas mueven la FILA marcada (no navegan a la ficha).
    const primero = idxEnLista <= 0;
    const ultimo = idxEnLista < 0 || idxEnLista >= listaOrd.length - 1;
    pie = (
      <>
        <BotonPie Icono={ChevronsLeft} onClick={() => seleccionar(0)} disabled={primero}>Inicio</BotonPie>
        <BotonPie Icono={ChevronLeft} onClick={() => seleccionar(idxEnLista - 1)} disabled={primero}>Anterior</BotonPie>
        <BotonPie Icono={ChevronRight} onClick={() => seleccionar(idxEnLista + 1)} disabled={ultimo}>Siguiente</BotonPie>
        <BotonPie Icono={ChevronsRight} onClick={() => seleccionar(listaOrd.length - 1)} disabled={ultimo}>Fin</BotonPie>
        <SepPie />
        <BotonPie Icono={PlusCircle} tono="ok" onClick={crear}>Nueva</BotonPie>
        <BotonPie Icono={Copy} onClick={duplicar} disabled={ocupado || !famAccion}>Duplicar</BotonPie>
        <BotonPie Icono={Pencil} onClick={abrirYModificar} disabled={!famAccion}>Modificar</BotonPie>
        <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={!famAccion}>Eliminar</BotonPie>
        {finComun}
        <SepPie />
        <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir}>Salir</BotonPie>
      </>
    );
  } else {
    // En la ficha, las flechas RECORREN registros (Inicio/Anterior/Siguiente/Fin).
    const primero = idxLista <= 0;
    const ultimo = idxLista < 0 || idxLista >= listaOrd.length - 1;
    pie = (
      <>
        <BotonPie Icono={ChevronsLeft} onClick={() => irA(0)} disabled={primero}>Inicio</BotonPie>
        <BotonPie Icono={ChevronLeft} onClick={() => irA(idxLista - 1)} disabled={primero}>Anterior</BotonPie>
        <BotonPie Icono={ChevronRight} onClick={() => irA(idxLista + 1)} disabled={ultimo}>Siguiente</BotonPie>
        <BotonPie Icono={ChevronsRight} onClick={() => irA(listaOrd.length - 1)} disabled={ultimo}>Fin</BotonPie>
        <SepPie />
        <BotonPie Icono={PlusCircle} tono="ok" onClick={crear}>Nueva</BotonPie>
        <BotonPie Icono={Copy} onClick={duplicar} disabled={ocupado || !fam}>Duplicar</BotonPie>
        <BotonPie Icono={Pencil} onClick={() => fam && setBorrador(structuredClone(fam))} disabled={!fam}>Modificar</BotonPie>
        <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={!fam}>Eliminar</BotonPie>
        {finComun}
        <SepPie />
        <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir}>Salir</BotonPie>
      </>
    );
  }

  return (
    <>
      <MarcoMantenimiento
        pestanas={["Lista", "Ficha", "Informes"]} pestana={pestana}
        onPestana={irPestana}
        subpestanas={pestana === "Ficha" ? SUBS : undefined}
        subpestana={sub} onSubpestana={(s) => setSub(s as Sub)}
        pie={pie} pegado
      >
        {pestana === "Lista" && (
          <Caja crecer>
            <div className="flex flex-none items-center gap-2 border-b border-line p-2.5">
              <div className="relative w-full max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar familia…"
                  className="h-8 w-full rounded-[5px] border border-line bg-background pl-8 pr-8 text-[12.5px] font-medium text-paper outline-none transition-colors placeholder:text-muted focus:border-brand-lit" />
                {q && (
                  <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda"
                    className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted transition-transform active:scale-90">
                    <X size={13} />
                  </button>
                )}
              </div>
              {!real && (
                <span className="flex-none rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-[11.5px] font-bold text-amber">Ejemplo</span>
              )}
              <span className="flex-1" />
              <button type="button" onClick={exportar} disabled={familias.length === 0}
                className="flex h-8 flex-none items-center gap-1.5 rounded-[5px] border border-line bg-panel px-3 text-[12.5px] font-semibold text-paper transition-transform active:scale-95 disabled:opacity-40">
                <FileDown size={14} /> Exportar{marcados.size > 0 ? ` (${marcados.size})` : ""}
              </button>
            </div>
            <Desplazable eje="ambos" pie={
              <span className="text-[11.5px] font-medium text-muted">
                {listaOrd.length} {listaOrd.length === 1 ? "familia" : "familias"}{q && ` · de ${familias.length}`}
              </span>
            }>
              <table className="w-full min-w-140 border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:border-b [&>th]:border-r [&>th]:border-line [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70 [&>th:last-child]:border-r-0">
                    <th className="w-11 text-center!">
                      <input type="checkbox" aria-label="Marcar todo lo que se ve"
                        checked={listaOrd.length > 0 && listaOrd.every((f) => marcados.has(f.id))}
                        onChange={(e) => setMarcados(e.target.checked ? new Set(listaOrd.map((f) => f.id)) : new Set())}
                        className="h-4.5 w-4.5 accent-(--brand)" />
                    </th>
                    <th className="w-14 text-center!">Color</th>
                    {Enc("nombre", "Nombre")}
                    {Enc("orden", "Orden", "text-right!")}
                    {Enc("ordenFactura", "O. factura", "text-right!")}
                    {Enc("combinable", "Combinable", "text-center!")}
                    {Enc("venta", "Venta", "text-center!")}
                    {Enc("menus", "Menús", "text-center!")}
                  </tr>
                </thead>
                <tbody className="[&>tr>td]:border-r [&>tr>td]:border-line [&>tr>td:last-child]:border-r-0">
                  {listaOrd.map((f) => {
                    const sel = f.id === famAccion?.id;
                    return (
                      // Clic = marcar (no abre); doble clic abre la ficha.
                      <tr key={f.id} ref={sel ? filaRef : undefined} aria-selected={sel}
                        onClick={() => setFilaSel(f.id)} onDoubleClick={() => abrir(f.id)}
                        className={`cursor-pointer border-b border-line text-[13.5px] ${sel ? "bg-accent-soft" : "even:bg-paper/4"}`}>
                        <td className="px-2.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={marcados.has(f.id)} onChange={() => marcar(f.id)}
                            aria-label={`Marcar ${f.nombre}`} className="h-4.5 w-4.5 accent-(--brand)" />
                        </td>
                        <td className="px-2.5 py-2"><span className="mx-auto block h-5 w-5 rounded-[4px]" style={{ background: f.color }} /></td>
                        <td className="px-2.5 py-2 font-semibold">{f.nombre}</td>
                        <td className="px-2.5 py-2 text-right font-mono text-muted">{f.orden}</td>
                        <td className="px-2.5 py-2 text-right font-mono text-muted">{f.ordenImpresion}</td>
                        <td className="px-2.5 py-2 text-center text-[12px] text-muted">{f.combinable ? "Sí" : "—"}</td>
                        <td className="px-2.5 py-2 text-center text-[12px] text-muted">{f.mostrarVenta ? "Sí" : "—"}</td>
                        <td className="px-2.5 py-2 text-center text-[12px] text-muted">{f.mostrarMenus ? "Sí" : "—"}</td>
                      </tr>
                    );
                  })}
                  {listaOrd.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">Ninguna familia.</td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>
        )}

        {pestana === "Ficha" && sub === "General" && fam && (
          <Caja crecer>
            <Desplazable className="p-3.5">
              <div className="grid max-w-3xl gap-3.5">
                {/* Datos a la izquierda, Aspecto arriba a la derecha (disposición Ágora). */}
                <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_12rem]">
                  <div className="grid content-start gap-3.5">
                    <Campo etiqueta="Nombre" htmlFor="f-nom">
                      <input id="f-nom" value={fam.nombre} readOnly={ro} placeholder="Bebidas, Cocina, Postres…"
                        onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro)} />
                    </Campo>
                    <div className="grid gap-3.5 sm:grid-cols-3">
                      <Campo etiqueta="Orden en la venta" htmlFor="f-ord">
                        <input id="f-ord" type="number" min="0" step="1" value={fam.orden} readOnly={ro}
                          onChange={(e) => set("orden", Number(e.target.value))} className={claseEntrada(ro, "text-right font-mono")} />
                      </Campo>
                      <Campo etiqueta="Orden en la factura" htmlFor="f-oi">
                        <input id="f-oi" type="number" min="0" step="1" value={fam.ordenImpresion} readOnly={ro}
                          onChange={(e) => set("ordenImpresion", Number(e.target.value))} className={claseEntrada(ro, "text-right font-mono")} />
                      </Campo>
                      <Campo etiqueta="Texto del botón" htmlFor="f-tb">
                        <input id="f-tb" value={fam.textoBoton} readOnly={ro} placeholder={fam.nombre || "Igual que el nombre"}
                          onChange={(e) => set("textoBoton", e.target.value)} className={claseEntrada(ro)} />
                      </Campo>
                    </div>
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <Campo etiqueta="Familia padre (agrupa bajo un botón)" htmlFor="f-padre">
                        <Selector id="f-padre" value={fam.familiaPadreId ?? ""} disabled={ro}
                          onChange={(v) => set("familiaPadreId", v || null)}>
                          <option value="">Ninguna (de primer nivel)</option>
                          {familias.filter((o) => o.id !== fam.id).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                        </Selector>
                      </Campo>
                      <Campo etiqueta="Grupo mayor (desglose del ticket)" htmlFor="f-gm">
                        <Selector id="f-gm" value={fam.grupoMayorId ?? ""} disabled={ro}
                          onChange={(v) => set("grupoMayorId", v || null)}>
                          <option value="">Ninguno</option>
                          {gruposMayores.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                        </Selector>
                      </Campo>
                    </div>
                  </div>

                  {/* Aspecto en el TPV — arriba a la derecha. */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11.5px] font-medium text-muted">Aspecto en el TPV</span>
                    <PreviaClasificacion nombre={fam.nombre} color={fam.color} foto={fam.fotoUrl || undefined} />
                    <button type="button" disabled={ro} onClick={() => setAspecto(true)}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-mint/40 bg-mint/10 px-3 text-[12.5px] font-semibold text-mint transition-transform active:scale-95 disabled:opacity-35">
                      <Camera size={15} /> Foto y color
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <InterruptorSN etiqueta="Se puede combinar (copas)" activo={fam.combinable} soloLectura={ro}
                    onToggle={() => set("combinable", !fam.combinable)} />
                  <InterruptorSN etiqueta="Sale en la venta" activo={fam.mostrarVenta} soloLectura={ro}
                    onToggle={() => set("mostrarVenta", !fam.mostrarVenta)} />
                  <InterruptorSN etiqueta="Sale en los menús" activo={fam.mostrarMenus} soloLectura={ro}
                    onToggle={() => set("mostrarMenus", !fam.mostrarMenus)} />
                </div>
                <p className="flex items-center gap-2 text-[12px] text-muted">
                  <Info size={14} className="flex-none" />
                  Al borrar una familia, sus categorías y productos NO se borran: se quedan sin familia.
                </p>
              </div>
            </Desplazable>
          </Caja>
        )}

        {pestana === "Ficha" && sub === "Categorías" && fam && (
          <Caja crecer>
            <Desplazable className="p-3.5">
              <FamiliaCategorias familia={fam} categorias={categorias} onAbrir={(id) =>
                navegar({ vista: "config", seccion: "categorias", id })} />
            </Desplazable>
          </Caja>
        )}

        {pestana === "Informes" && (
          <Caja crecer>
            <Desplazable className="p-3.5">
              <FamiliaInforme familia={fam} categorias={categorias} />
            </Desplazable>
          </Caja>
        )}
      </MarcoMantenimiento>

      {aspecto && editando && fam && (
        <AspectoClasificacion titulo="Aspecto de la familia" nombre={fam.nombre} color={fam.color}
          foto={fam.fotoUrl} icono="" conIcono={false}
          onCambiar={(campo, val) => { if (campo === "color") set("color", val); else if (campo === "foto") set("fotoUrl", val); }}
          onCerrar={() => setAspecto(false)} />
      )}

      {borrar && famAccion && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={Layers} titulo="Eliminar familia" subtitulo={famAccion.nombre} onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[13.5px] leading-relaxed text-paper/85">
              Se borrará la familia. Sus categorías y productos <b>se quedan sin familia</b>, no se pierden.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-panel-2 px-4 py-3">
            <button type="button" onClick={() => setBorrar(false)}
              className="min-h-11 rounded-[5px] border border-line px-4 text-[13px] font-medium text-muted transition-transform active:scale-95">Cancelar</button>
            <button type="button" onClick={eliminar}
              className="min-h-11 rounded-[5px] bg-danger px-5 text-[13px] font-semibold text-white transition-transform active:scale-95">Eliminar</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Subpestaña «Categorías»: lo que cuelga de esta familia (solo lectura) ──────
function FamiliaCategorias({ familia, categorias, onAbrir }: Readonly<{
  familia: Familia; categorias: Categoria[]; onAbrir: (id: string) => void;
}>) {
  const suyas = categorias.filter((c) => c.familyId === familia.id);
  if (suyas.length === 0) {
    return (
      <p className="max-w-2xl text-[13px] leading-relaxed text-muted">
        Esta familia todavía no tiene categorías. Se asignan desde cada categoría, en su campo «Familia».
      </p>
    );
  }
  return (
    <div className="grid max-w-2xl gap-2">
      <p className="text-[12px] text-muted">
        {suyas.length} categoría{suyas.length === 1 ? "" : "s"} cuelgan de «{familia.nombre}». Toca una para abrirla.
      </p>
      <div className="grid gap-1.5">
        {suyas.map((c) => (
          <button key={c.id} type="button" onClick={() => onAbrir(c.id)}
            className="flex min-h-11 items-center gap-2.5 rounded-[6px] border border-line bg-panel-2 px-3 text-left transition-transform active:scale-[.99]">
            <span className="h-5 w-5 flex-none rounded-[4px]" style={{ background: c.color }} />
            <span className="text-[13.5px] font-semibold text-paper">{c.nombre}</span>
            <span className="ml-auto text-[11.5px] text-muted">{c.mostrarVenta ? "en venta" : "oculta"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Pestaña «Informe»: resumen honesto de la carta (el detalle vive en Análisis) ─
function FamiliaInforme({ familia, categorias }: Readonly<{
  familia?: Familia; categorias: Categoria[];
}>) {
  if (!familia) return <p className="text-[13px] text-muted">Elige una familia en la Lista para ver su informe.</p>;
  const suyas = categorias.filter((c) => c.familyId === familia.id);
  const enVenta = suyas.filter((c) => c.mostrarVenta).length;
  return (
    <div className="grid max-w-2xl gap-3.5">
      <h3 className="text-[14px] font-semibold text-paper">{familia.nombre}</h3>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Metrica etiqueta="Categorías" valor={suyas.length} />
        <Metrica etiqueta="En venta" valor={enVenta} />
        <Metrica etiqueta="Orden en factura" valor={familia.ordenImpresion} />
      </div>
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
        <Info size={14} className="mt-0.5 flex-none" />
        Los informes de ventas por familia (importe, unidades, márgenes) viven en Análisis. Aquí solo el resumen de la carta.
      </p>
    </div>
  );
}

function Metrica({ etiqueta, valor }: Readonly<{ etiqueta: string; valor: number }>) {
  return (
    <div className="rounded-[7px] border border-line bg-panel-2 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className="mt-1 text-[22px] font-bold tabular-nums text-paper">{valor}</p>
    </div>
  );
}
