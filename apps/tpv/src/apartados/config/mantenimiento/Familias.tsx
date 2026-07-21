import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard, Layers, Info, Camera,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
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
import { CATEGORIAS_DEMO } from "../../tpv/datos";

// Las tres pestañas del patrón de Configuración; dentro de «Ficha», las subpestañas.
const SUBS = ["General", "Categorías"] as const;
type Sub = (typeof SUBS)[number];

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

  // Recorrer registros en el mismo orden que la Lista (Inicio/Anterior/Siguiente/Fin).
  const idxLista = fam ? lista.findIndex((f) => f.id === fam.id) : -1;
  const irA = (i: number) => { const f = lista[i]; if (f) abrir(f.id); };
  const primero = idxLista <= 0;
  const ultimo = idxLista < 0 || idxLista >= lista.length - 1;

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
        if (nuevo) abrir(listo.id);
        setBorrador(null); setNuevo(false);
        notificar(real ? "Familia guardada." : "Guardado solo en este terminal: sin emparejar, se pierde al recargar.");
      } catch (e: unknown) { notificar(`No se ha guardado: ${mensaje(e)}`); }
      finally { setOcupado(false); }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    if (!fam) return;
    const seguir = () => { setFamilias((fs) => fs.filter((f) => f.id !== fam.id)); abrir(); notificar("Familia eliminada."); };
    if (!real) { seguir(); return; }
    borrarFamilia(fam.id).then(seguir).catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
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
  } else {
    pie = (
      <>
        <BotonPie Icono={ChevronsLeft} onClick={() => irA(0)} disabled={primero}>Inicio</BotonPie>
        <BotonPie Icono={ChevronLeft} onClick={() => irA(idxLista - 1)} disabled={primero}>Anterior</BotonPie>
        <BotonPie Icono={ChevronRight} onClick={() => irA(idxLista + 1)} disabled={ultimo}>Siguiente</BotonPie>
        <BotonPie Icono={ChevronsRight} onClick={() => irA(lista.length - 1)} disabled={ultimo}>Fin</BotonPie>
        <SepPie />
        <BotonPie Icono={PlusCircle} tono="ok" onClick={crear}>Nueva</BotonPie>
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
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar familia…"
                className={claseEntrada(false, "w-full")} />
              {!real && (
                <span className="flex-none rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-[11.5px] font-bold text-amber">
                  Ejemplo
                </span>
              )}
            </div>
            <Desplazable>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70">
                    <th className="w-14 text-center!">Color</th><th>Nombre</th>
                    <th className="w-24 text-right!">Orden</th><th className="w-28 text-center!">Combinable</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id} onClick={() => abrir(f.id)}
                      className={`cursor-pointer border-b border-line text-[13.5px] ${f.id === fam?.id ? "bg-accent-soft" : ""}`}>
                      <td className="px-2.5 py-2"><span className="mx-auto block h-5 w-5 rounded-[4px]" style={{ background: f.color }} /></td>
                      <td className="px-2.5 py-2 font-semibold">{f.nombre}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-muted">{f.orden}</td>
                      <td className="px-2.5 py-2 text-center text-[12px] text-muted">{f.combinable ? "Sí" : "—"}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">Ninguna familia.</td></tr>
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

      {borrar && fam && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={Layers} titulo="Eliminar familia" subtitulo={fam.nombre} onCerrar={() => setBorrar(false)} />
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
