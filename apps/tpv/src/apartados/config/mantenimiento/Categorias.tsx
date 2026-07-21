import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard, LayoutGrid, Info, Camera,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, claseEntrada,
} from "./Marco";
import { InterruptorSN } from "./ClasificacionUI";
import { AspectoClasificacion, PreviaClasificacion } from "./AspectoClasificacion";
import {
  cargarCategorias, cargarFamilias, guardarCategoria, borrarCategoria, subirFotoClasificacion,
  type Categoria, type Familia,
} from "./clasificacion";
import { CATEGORIAS_DEMO } from "../../tpv/datos";

// ────────────────────────────────────────────────────────────────────────────
// CATEGORÍAS — la botonera del TPV. Cuelgan de una familia, tienen color e icono
// y fijan la ESTACIÓN por defecto de sus productos (dónde se prepara).
// ────────────────────────────────────────────────────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");
const ESTACIONES = [
  { valor: "COCINA", texto: "Cocina" }, { valor: "BARRA", texto: "Barra" },
  { valor: "CAMARERO", texto: "Lo prepara el camarero" }, { valor: "NINGUNA", texto: "No se prepara" },
];

const DEMO: Categoria[] = CATEGORIAS_DEMO.map((c, i) => ({
  id: c.id, nombre: c.nombre, color: c.color, orden: i + 1,
  familyId: null, estacion: "COCINA", icono: "", mostrarVenta: true, mostrarMenus: true,
  textoBoton: "", cartaNombre: "", cartaDescripcion: "", categoriaPadreId: null, fotoUrl: "",
}));

export function Categorias({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const ruta = useRuta();
  const [categorias, setCategorias] = useState<Categoria[]>(DEMO);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<Categoria | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [q, setQ] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [aspecto, setAspecto] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarCategorias().then((c) => { if (vivo && c) { setCategorias(c); setReal(true); } });
    cargarFamilias().then((f) => { if (vivo && f) setFamilias(f); });
    return () => { vivo = false; };
  }, []);

  const notificar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 2600); };
  const nombreFamilia = (id: string | null) => familias.find((f) => f.id === id)?.nombre ?? "—";

  const lista = useMemo(() => {
    const nq = norm(q.trim());
    return nq ? categorias.filter((c) => norm(`${c.nombre} ${nombreFamilia(c.familyId)}`).includes(nq)) : categorias;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, q, familias]);

  const enUrl = ruta.id ? categorias.findIndex((c) => c.id === ruta.id) : -1;
  const cat = borrador ?? categorias[Math.max(enUrl, 0)];
  const abrir = (id?: string) => navegar({ vista: "config", seccion: "categorias", ...(id ? { id } : {}) }, !id);

  const editando = borrador !== null;
  const ro = !editando;
  const pestana = borrador || ruta.id ? "Ficha" : "Lista";

  const set = <K extends keyof Categoria>(campo: K, valor: Categoria[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const crear = () => {
    setNuevo(true);
    setBorrador({
      id: crypto.randomUUID(), nombre: "", color: "#2f7fd0", orden: categorias.length + 1,
      familyId: familias[0]?.id ?? null, estacion: "COCINA", icono: "",
      mostrarVenta: true, mostrarMenus: true,
      textoBoton: "", cartaNombre: "", cartaDescripcion: "", categoriaPadreId: null, fotoUrl: "",
    });
  };

  const guardar = () => {
    if (!borrador || ocupado) return;
    if (!borrador.nombre.trim()) { notificar("La categoría necesita un nombre."); return; }
    setOcupado(true);
    (async () => {
      try {
        let listo = borrador;
        if (real) {
          if (listo.fotoUrl.startsWith("data:")) {
            const blob = await (await fetch(listo.fotoUrl)).blob();
            listo = { ...listo, fotoUrl: await subirFotoClasificacion("categorias", listo.id, blob) };
          }
          await guardarCategoria(listo);
        }
        setCategorias((cs) => nuevo ? [...cs, listo] : cs.map((c) => (c.id === listo.id ? listo : c)));
        if (nuevo) abrir(listo.id);
        setBorrador(null); setNuevo(false);
        notificar(real ? "Categoría guardada." : "Guardado solo en este terminal: sin emparejar, se pierde al recargar.");
      } catch (e: unknown) { notificar(`No se ha guardado: ${mensaje(e)}`); }
      finally { setOcupado(false); }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    if (!cat) return;
    const seguir = () => { setCategorias((cs) => cs.filter((c) => c.id !== cat.id)); abrir(); notificar("Categoría eliminada."); };
    if (!real) { seguir(); return; }
    borrarCategoria(cat.id).then(seguir).catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
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
          {nuevo ? "Nueva categoría" : `Editando · ${cat?.nombre ?? ""}`}
        </span>
      </>
    );
  } else {
    pie = (
      <>
        <BotonPie Icono={PlusCircle} tono="ok" onClick={crear}>Nueva</BotonPie>
        <BotonPie Icono={Pencil} onClick={() => cat && setBorrador(structuredClone(cat))} disabled={!cat}>Modificar</BotonPie>
        <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={!cat}>Eliminar</BotonPie>
        {finComun}
        <SepPie />
        <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir}>Salir</BotonPie>
      </>
    );
  }

  return (
    <>
      <MarcoMantenimiento
        pestanas={["Lista", "Ficha"]} pestana={pestana}
        onPestana={(p) => { if (!editando) abrir(p === "Lista" ? undefined : cat?.id); }}
        pie={pie} pegado={pestana === "Lista"}
      >
        {pestana === "Lista" && (
          <Caja crecer>
            <div className="flex flex-none items-center gap-2 border-b border-line p-2.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar categoría o familia…"
                className={claseEntrada(false, "w-full")} />
              {!real && (
                <span className="flex-none rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-[11.5px] font-bold text-amber">Ejemplo</span>
              )}
            </div>
            <Desplazable eje="ambos">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70">
                    <th className="w-14 text-center!">Color</th><th>Nombre</th><th>Familia</th>
                    <th className="w-28">Estación</th><th className="w-20 text-right!">Orden</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id} onClick={() => abrir(c.id)}
                      className={`cursor-pointer border-b border-line text-[13.5px] ${c.id === cat?.id ? "bg-accent-soft" : ""}`}>
                      <td className="px-2.5 py-2"><span className="mx-auto block h-5 w-5 rounded-[4px]" style={{ background: c.color }} /></td>
                      <td className="px-2.5 py-2 font-semibold">{c.nombre}</td>
                      <td className="px-2.5 py-2 text-muted">{nombreFamilia(c.familyId)}</td>
                      <td className="px-2.5 py-2 text-[12px] text-muted">{ESTACIONES.find((e) => e.valor === c.estacion)?.texto ?? c.estacion}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-muted">{c.orden}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">Ninguna categoría.</td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>
        )}

        {pestana === "Ficha" && cat && (
          <Caja crecer>
            <Desplazable className="p-3.5">
              <div className="grid max-w-3xl gap-3.5">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Campo etiqueta="Nombre" htmlFor="c-nom">
                    <input id="c-nom" value={cat.nombre} readOnly={ro} placeholder="Cervezas, Vinos…"
                      onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                  <Campo etiqueta="Familia" htmlFor="c-fam">
                    <Selector id="c-fam" value={cat.familyId ?? ""} disabled={ro}
                      onChange={(v) => set("familyId", v || null)}>
                      <option value="">Sin familia</option>
                      {familias.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Estación de preparación" htmlFor="c-est">
                    <Selector id="c-est" value={cat.estacion} disabled={ro} onChange={(v) => set("estacion", v)}>
                      {ESTACIONES.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Orden en la carta" htmlFor="c-ord">
                    <input id="c-ord" type="number" min="0" step="1" value={cat.orden} readOnly={ro}
                      onChange={(e) => set("orden", Number(e.target.value))} className={claseEntrada(ro, "w-28 text-right font-mono")} />
                  </Campo>
                </div>

                <Campo etiqueta="Categoría padre (subcategoría de)" htmlFor="c-padre">
                  <Selector id="c-padre" value={cat.categoriaPadreId ?? ""} disabled={ro}
                    onChange={(v) => set("categoriaPadreId", v || null)}>
                    <option value="">Ninguna (de primer nivel)</option>
                    {categorias.filter((o) => o.id !== cat.id).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </Selector>
                </Campo>

                <Campo etiqueta="Aspecto en el TPV">
                  <div className="flex items-center gap-3">
                    <div className="w-32 flex-none">
                      <PreviaClasificacion nombre={cat.nombre} color={cat.color}
                        foto={cat.fotoUrl || undefined} icono={cat.icono || undefined} />
                    </div>
                    <button type="button" disabled={ro} onClick={() => setAspecto(true)}
                      className="flex min-h-11 items-center gap-2 rounded-[5px] border border-mint/40 bg-mint/10 px-3 text-[12.5px] font-semibold text-mint transition-transform active:scale-95 disabled:opacity-35">
                      <Camera size={15} /> Foto, color e icono
                    </button>
                  </div>
                </Campo>

                <Campo etiqueta="Texto del botón" htmlFor="c-tb">
                  <input id="c-tb" value={cat.textoBoton} readOnly={ro} placeholder={cat.nombre || "Igual que el nombre"}
                    onChange={(e) => set("textoBoton", e.target.value)} className={claseEntrada(ro)} />
                </Campo>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Campo etiqueta="Nombre en la carta QR" htmlFor="c-cn">
                    <input id="c-cn" value={cat.cartaNombre} readOnly={ro} placeholder={cat.nombre || "El nombre normal"}
                      onChange={(e) => set("cartaNombre", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                  <Campo etiqueta="Descripción en la carta QR" htmlFor="c-cd">
                    <input id="c-cd" value={cat.cartaDescripcion} readOnly={ro}
                      onChange={(e) => set("cartaDescripcion", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InterruptorSN etiqueta="Sale en la venta" activo={cat.mostrarVenta} soloLectura={ro}
                    onToggle={() => set("mostrarVenta", !cat.mostrarVenta)} />
                  <InterruptorSN etiqueta="Sale en los menús" activo={cat.mostrarMenus} soloLectura={ro}
                    onToggle={() => set("mostrarMenus", !cat.mostrarMenus)} />
                </div>
                <p className="flex items-center gap-2 text-[12px] text-muted">
                  <Info size={14} className="flex-none" />
                  La estación decide por dónde sale la comanda de los productos de esta categoría, salvo que el producto diga otra cosa.
                </p>
              </div>
            </Desplazable>
          </Caja>
        )}
      </MarcoMantenimiento>

      {aspecto && editando && cat && (
        <AspectoClasificacion titulo="Aspecto de la categoría" nombre={cat.nombre} color={cat.color}
          foto={cat.fotoUrl} icono={cat.icono} conIcono
          onCambiar={(campo, val) => { if (campo === "color") set("color", val); else if (campo === "foto") set("fotoUrl", val); else set("icono", val); }}
          onCerrar={() => setAspecto(false)} />
      )}

      {borrar && cat && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={LayoutGrid} titulo="Eliminar categoría" subtitulo={cat.nombre} onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[13.5px] leading-relaxed text-paper/85">
              Se borrará la categoría. Los productos que estaban en ella <b>no se borran</b>: dejan de aparecer en esta categoría.
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
