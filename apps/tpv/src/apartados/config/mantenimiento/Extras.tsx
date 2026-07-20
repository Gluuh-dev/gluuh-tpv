import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard, ListPlus, Info, X, Plus, Check,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, claseEntrada,
} from "./Marco";
import {
  cargarModificadores, guardarGrupoBiblioteca, borrarGrupoBiblioteca, guardarAsignacionesDeGrupo,
  type GrupoModificador, type Asignacion, type TipoGrupo,
} from "./modificadores";
import { cargarFamilias, cargarCategorias, type Familia, type Categoria } from "./clasificacion";

// ────────────────────────────────────────────────────────────────────────────
// EXTRAS Y COMENTARIOS — la BIBLIOTECA de grupos compartidos.
//
// Aquí se crean los grupos que se dicen UNA vez y heredan muchos artículos:
// «punto de la carne» se asigna a la familia Hamburguesas y todas lo llevan. Los
// grupos propios de UN artículo se editan en su ficha, no aquí.
//
//  · COMENTARIO: opciones sin precio, van a cocina (sin cebolla, muy hecho).
//  · EXTRA: opciones que SUMAN al ticket (extra de queso, +1,50).
//  · min/max: cuántas se eligen. 0/1 opcional, 1/1 obligatoria una.
// ────────────────────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");

/** Grupo de biblioteca + a qué familias y categorías está asignado. */
interface GrupoBiblioteca extends GrupoModificador {
  familias: string[];
  categorias: string[];
}

const asignados = (grupoId: string, asigs: readonly Asignacion[], campo: "familyId" | "categoryId"): string[] =>
  asigs.filter((a) => a.grupoId === grupoId && a.modo === "INCLUIR" && a[campo] !== null).map((a) => a[campo]!);

export function Extras({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const ruta = useRuta();
  const [grupos, setGrupos] = useState<GrupoBiblioteca[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<GrupoBiblioteca | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [q, setQ] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarModificadores().then((m) => {
      if (!vivo || !m) return;
      setGrupos(m.biblioteca.map((g) => ({
        ...g,
        familias: asignados(g.id, m.asignaciones, "familyId"),
        categorias: asignados(g.id, m.asignaciones, "categoryId"),
      })));
      setReal(true);
    });
    cargarFamilias().then((f) => { if (vivo && f) setFamilias(f); });
    cargarCategorias().then((c) => { if (vivo && c) setCategorias(c); });
    return () => { vivo = false; };
  }, []);

  const notificar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 2600); };

  const lista = useMemo(() => {
    const nq = norm(q.trim());
    return nq ? grupos.filter((g) => norm(g.nombre).includes(nq)) : grupos;
  }, [grupos, q]);

  const enUrl = ruta.id ? grupos.findIndex((g) => g.id === ruta.id) : -1;
  const grupo = borrador ?? grupos[Math.max(enUrl, 0)];
  const abrir = (id?: string) => navegar({ vista: "config", seccion: "modificadores", ...(id ? { id } : {}) }, !id);

  const editando = borrador !== null;
  const ro = !editando;
  const pestana = borrador || ruta.id ? "Ficha" : "Lista";

  const set = <K extends keyof GrupoBiblioteca>(campo: K, valor: GrupoBiblioteca[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const alternarAsig = (campo: "familias" | "categorias", id: string) =>
    setBorrador((b) => b ? {
      ...b, [campo]: b[campo].includes(id) ? b[campo].filter((x) => x !== id) : [...b[campo], id],
    } : b);

  const crear = () => {
    setNuevo(true);
    setBorrador({
      id: crypto.randomUUID(), nombre: "", tipo: "COMENTARIO", min: 0, max: 1,
      opciones: [], productId: null, familias: [], categorias: [],
    });
  };

  const guardar = () => {
    if (!borrador || ocupado) return;
    if (!borrador.nombre.trim()) { notificar("El grupo necesita un nombre."); return; }
    setOcupado(true);
    (async () => {
      try {
        if (real) {
          await guardarGrupoBiblioteca(borrador);
          await guardarAsignacionesDeGrupo(borrador.id, borrador.familias, borrador.categorias);
        }
        setGrupos((gs) => nuevo ? [...gs, borrador] : gs.map((g) => (g.id === borrador.id ? borrador : g)));
        if (nuevo) abrir(borrador.id);
        setBorrador(null); setNuevo(false);
        notificar(real ? "Grupo guardado." : "Guardado solo en este terminal: sin emparejar, se pierde al recargar.");
      } catch (e: unknown) { notificar(`No se ha guardado: ${mensaje(e)}`); }
      finally { setOcupado(false); }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    if (!grupo) return;
    const seguir = () => { setGrupos((gs) => gs.filter((g) => g.id !== grupo.id)); abrir(); notificar("Grupo eliminado."); };
    if (!real) { seguir(); return; }
    borrarGrupoBiblioteca(grupo.id).then(seguir).catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
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
          {nuevo ? "Nuevo grupo" : `Editando · ${grupo?.nombre ?? ""}`}
        </span>
      </>
    );
  } else {
    pie = (
      <>
        <BotonPie Icono={PlusCircle} tono="ok" onClick={crear}>Nuevo</BotonPie>
        <BotonPie Icono={Pencil} onClick={() => grupo && setBorrador(structuredClone(grupo))} disabled={!grupo}>Modificar</BotonPie>
        <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={!grupo}>Eliminar</BotonPie>
        {finComun}
        <SepPie />
        <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir}>Salir</BotonPie>
      </>
    );
  }

  const esExtra = grupo?.tipo === "EXTRA";

  return (
    <>
      <MarcoMantenimiento
        pestanas={["Lista", "Ficha"]} pestana={pestana}
        onPestana={(p) => { if (!editando) abrir(p === "Lista" ? undefined : grupo?.id); }}
        pie={pie} pegado={pestana === "Lista"}
      >
        {pestana === "Lista" && (
          <Caja crecer>
            <div className="flex flex-none items-center gap-2 border-b border-line p-2.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo…"
                className={claseEntrada(false, "w-full")} />
              {!real && (
                <span className="flex-none rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-[11.5px] font-bold text-amber">Ejemplo</span>
              )}
            </div>
            <Desplazable eje="ambos">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70">
                    <th>Nombre</th><th className="w-32">Tipo</th><th className="w-24 text-right!">Opciones</th>
                    <th className="w-28 text-center!">Elegir</th><th className="w-28 text-right!">Asignado a</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((g) => (
                    <tr key={g.id} onClick={() => abrir(g.id)}
                      className={`cursor-pointer border-b border-line text-[13.5px] ${g.id === grupo?.id ? "bg-accent-soft" : ""}`}>
                      <td className="px-2.5 py-2 font-semibold">{g.nombre}</td>
                      <td className="px-2.5 py-2 text-[12px]">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${g.tipo === "EXTRA" ? "bg-cobro/15 text-cobro" : "bg-paper/8 text-muted"}`}>
                          {g.tipo === "EXTRA" ? "Extra" : "Comentario"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-muted">{g.opciones.length}</td>
                      <td className="px-2.5 py-2 text-center text-[12px] text-muted">{g.min}–{g.max}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-muted">{g.familias.length + g.categorias.length}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">Ningún grupo. Pulsa «Nuevo».</td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>
        )}

        {pestana === "Ficha" && grupo && (
          <Desplazable className="flex flex-col gap-2.5">
            <Caja titulo="El grupo">
              <div className="grid gap-3.5 p-3.5 lg:grid-cols-2">
                <Campo etiqueta="Nombre" htmlFor="g-nom">
                  <input id="g-nom" value={grupo.nombre} readOnly={ro} placeholder="Punto de la carne, Extras…"
                    onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro)} />
                </Campo>
                <Campo etiqueta="Tipo" htmlFor="g-tipo">
                  <Selector id="g-tipo" value={grupo.tipo} disabled={ro} onChange={(v) => set("tipo", v as TipoGrupo)}>
                    <option value="COMENTARIO">Comentario — va a cocina, sin precio</option>
                    <option value="EXTRA">Extra — suma al ticket</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Mínimo a elegir" htmlFor="g-min">
                  <Selector id="g-min" value={String(grupo.min)} disabled={ro} onChange={(v) => set("min", Number(v))}>
                    <option value="0">0 — opcional</option><option value="1">1 — obligatorio</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Máximo a elegir" htmlFor="g-max">
                  <Selector id="g-max" value={String(grupo.max)} disabled={ro} onChange={(v) => set("max", Number(v))}>
                    {[1, 2, 3, 4, 5, 99].map((n) => <option key={n} value={n}>{n === 99 ? "Sin límite" : n}</option>)}
                  </Selector>
                </Campo>
              </div>
            </Caja>

            <Caja titulo="Opciones" contador={`${grupo.opciones.length}`}
              acciones={!ro && (
                <button type="button"
                  onClick={() => set("opciones", [...grupo.opciones, { id: crypto.randomUUID(), nombre: "Nueva opción", precioExtra: 0 }])}
                  className="flex min-h-8 items-center gap-1.5 rounded-[5px] bg-mint px-2.5 text-[12px] font-semibold text-white transition-transform active:scale-95">
                  <Plus size={14} strokeWidth={3} /> Añadir
                </button>
              )}>
              <div className="flex flex-col gap-1.5 p-2.5">
                {grupo.opciones.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-[6px] border border-line bg-panel-2 p-2">
                    <input value={o.nombre} readOnly={ro} aria-label="Nombre de la opción"
                      onChange={(e) => set("opciones", grupo.opciones.map((x) => (x.id === o.id ? { ...x, nombre: e.target.value } : x)))}
                      className={claseEntrada(ro, "min-w-0 flex-1", true)} />
                    {esExtra && (
                      <input type="number" step="0.05" min="0" value={o.precioExtra} readOnly={ro} aria-label="Precio del extra"
                        onChange={(e) => set("opciones", grupo.opciones.map((x) => (x.id === o.id ? { ...x, precioExtra: Number(e.target.value) } : x)))}
                        className={claseEntrada(ro, "w-24 text-right font-mono", true)} />
                    )}
                    {!ro && (
                      <button type="button" aria-label={`Quitar ${o.nombre}`}
                        onClick={() => set("opciones", grupo.opciones.filter((x) => x.id !== o.id))}
                        className="grid h-8 w-8 flex-none place-items-center rounded-[5px] text-muted transition-transform active:scale-90 hover:text-danger">
                        <X size={15} strokeWidth={2.6} />
                      </button>
                    )}
                  </div>
                ))}
                {grupo.opciones.length === 0 && (
                  <p className="px-1 py-3 text-[13px] text-muted">Sin opciones. {ro ? "" : "Pulsa «Añadir»."}</p>
                )}
                {esExtra && <p className="px-1 pt-1 text-[11.5px] text-muted">Un extra a 0,00 € no cobra: solo sale en la comanda.</p>}
              </div>
            </Caja>

            <Caja crecer titulo="Se aplica a" contador={`${grupo.familias.length + grupo.categorias.length}`}>
              <p className="flex-none border-b border-line bg-panel-2 px-3.5 py-2 text-[12px] leading-snug text-muted">
                <Info size={13} className="mr-1.5 inline flex-none" />
                Los artículos de estas familias y categorías heredan el grupo. Uno concreto puede quitárselo desde su ficha.
              </p>
              <div className="p-3.5">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Familias</p>
                <div className="flex flex-wrap gap-2">
                  {familias.map((f) => {
                    const on = grupo.familias.includes(f.id);
                    return (
                      <button key={f.id} type="button" disabled={ro} onClick={() => alternarAsig("familias", f.id)}
                        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
                          on ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-line bg-panel-2 text-paper/70"
                        }`}>
                        {on && <Check size={14} strokeWidth={3} />}{f.nombre}
                      </button>
                    );
                  })}
                  {familias.length === 0 && <span className="text-[12.5px] text-muted">No hay familias.</span>}
                </div>
                <p className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted">Categorías</p>
                <div className="flex flex-wrap gap-2">
                  {categorias.map((c) => {
                    const on = grupo.categorias.includes(c.id);
                    return (
                      <button key={c.id} type="button" disabled={ro} onClick={() => alternarAsig("categorias", c.id)}
                        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
                          on ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-line bg-panel-2 text-paper/70"
                        }`}>
                        {on && <Check size={14} strokeWidth={3} />}{c.nombre}
                      </button>
                    );
                  })}
                  {categorias.length === 0 && <span className="text-[12.5px] text-muted">No hay categorías.</span>}
                </div>
              </div>
            </Caja>
          </Desplazable>
        )}
      </MarcoMantenimiento>

      {borrar && grupo && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={ListPlus} titulo="Eliminar grupo" subtitulo={grupo.nombre} onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[13.5px] leading-relaxed text-paper/85">
              Se borrará el grupo y se quitará de <b>todas</b> las familias y categorías donde estaba.
              Los artículos dejan de heredarlo.
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
