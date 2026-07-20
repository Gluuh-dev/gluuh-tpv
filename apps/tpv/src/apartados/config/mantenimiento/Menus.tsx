import { useEffect, useMemo, useState } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard,
  BookOpen, Info, TriangleAlert, ChevronUp, ChevronDown, X, Plus,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, claseEntrada,
} from "./Marco";
import {
  cargarMenus, guardarMenu, borrarMenu, opcionesDePaso, problemasDelMenu, PASES,
  type Menu, type PasoMenu,
} from "./menu";
import { cargarCatalogo } from "./catalogo";

// ────────────────────────────────────────────────────────────────────────────
// MENÚS — un menú NO es un artículo, y por eso tiene pantalla propia.
//
// Lo que de verdad decide si esta pantalla sirve: que un paso pueda apuntar a
// una CATEGORÍA. Cambiar el menú del día pasa a ser cambiar qué hay en
// «PRIMEROS MENU» —treinta segundos, y lo hace el encargado— en vez de entrar
// aquí a añadir y quitar platos uno a uno. La lista a mano se queda para el
// menú de Nochevieja, que sí se monta plato a plato.
// ────────────────────────────────────────────────────────────────────────────

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");
const A_MANO = "__a_mano__";

interface Categoria { id: string; nombre: string }

export function Menus({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const ruta = useRuta();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productosPorCategoria, setPPC] = useState<Record<string, string[]>>({});
  const [nombreProducto, setNombreProducto] = useState<Record<string, string>>({});
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<Menu | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void cargarMenus().then((m) => { if (vivo && m) { setMenus(m); setReal(true); } });
    // Las categorías y qué productos tiene cada una salen del catálogo, que ya
    // sabe leerlo: aquí solo se le da la vuelta al índice.
    void cargarCatalogo().then((c) => {
      if (!vivo || !c) return;
      const porCat: Record<string, string[]> = {};
      const nombres: Record<string, string> = {};
      for (const a of c.articulos) {
        nombres[a.id] = a.nombre;
        for (const cat of a.categorias) (porCat[cat] ??= []).push(a.id);
      }
      setPPC(porCat);
      setNombreProducto(nombres);
    });
    void import("../../../lib/nodo").then(({ leer }) =>
      leer<Categoria>("category?select=id,nombre&order=nombre").then((cs) => {
        if (vivo && cs) setCategorias(cs);
      }));
    return () => { vivo = false; };
  }, []);

  const notificar = (t: string) => { setAviso(t); window.setTimeout(() => setAviso(""), 3200); };

  const enUrl = ruta.id ? menus.findIndex((m) => m.id === ruta.id) : -1;
  const menu = borrador ?? menus[Math.max(enUrl, 0)];
  const abrirMenu = (id?: string) =>
    navegar({ vista: "config", seccion: "menus", ...(id ? { id } : {}) }, !id);

  const editando = borrador !== null;
  const ro = !editando;
  const pestana = borrador || ruta.id ? "Menú" : "Lista";
  const pegas = useMemo(
    () => (menu ? problemasDelMenu(menu, productosPorCategoria) : []),
    [menu, productosPorCategoria],
  );

  const set = <K extends keyof Menu>(campo: K, valor: Menu[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const setPaso = (id: string, cambio: (p: PasoMenu) => PasoMenu) =>
    setBorrador((b) => (b ? { ...b, pasos: b.pasos.map((p) => (p.id === id ? cambio(p) : p)) } : b));

  const moverPaso = (id: string, dir: -1 | 1) =>
    setBorrador((b) => {
      if (!b) return b;
      const i = b.pasos.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= b.pasos.length) return b;
      const pasos = [...b.pasos];
      [pasos[i], pasos[j]] = [pasos[j]!, pasos[i]!];
      return { ...b, pasos: pasos.map((p, k) => ({ ...p, orden: k + 1 })) };
    });

  const anadirPaso = () =>
    setBorrador((b) => b ? {
      ...b,
      pasos: [...b.pasos, {
        id: crypto.randomUUID(), nombre: "Nuevo paso", orden: b.pasos.length + 1,
        categoryId: null, numPlatos: 1, ordenPrep: null, opciones: [],
      }],
    } : b);

  const crear = () => {
    setNuevo(true);
    setBorrador({
      id: crypto.randomUUID(), nombre: "", precio: 0, claseFiscal: "REDUCIDO",
      activo: true, pasos: [],
    });
  };

  const guardar = () => {
    if (!borrador || ocupado) return;
    const fallos = problemasDelMenu(borrador, productosPorCategoria);
    // Se comprueba ANTES de guardar: un menú con un paso vacío deja al camarero
    // delante del cliente sin poder elegir nada, y eso no se arregla en barra.
    if (fallos.length > 0) { notificar(fallos[0]!); return; }
    setOcupado(true);
    void (async () => {
      try {
        if (real) await guardarMenu(borrador);
        setMenus((ms) => nuevo ? [...ms, borrador] : ms.map((m) => (m.id === borrador.id ? borrador : m)));
        if (nuevo) abrirMenu(borrador.id);
        setBorrador(null); setNuevo(false);
        notificar(real ? "Menú guardado." : "Guardado solo en este terminal: sin emparejar, se pierde al recargar.");
      } catch (e: unknown) {
        notificar(`No se ha guardado: ${mensaje(e)}`);
      } finally { setOcupado(false); }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    if (!menu) return;
    const seguir = () => {
      setMenus((ms) => ms.filter((m) => m.id !== menu.id));
      abrirMenu();
      notificar("Menú eliminado.");
    };
    if (!real) { seguir(); return; }
    void borrarMenu(menu.id).then(seguir)
      .catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
  };

  const pie = (
    <>
      <BotonPie Icono={PlusCircle} tono="ok" onClick={crear} disabled={editando}>Nuevo</BotonPie>
      <BotonPie Icono={Pencil} onClick={() => menu && setBorrador(structuredClone(menu))} disabled={editando || !menu}>
        Modificar
      </BotonPie>
      <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={editando || !menu}>
        Eliminar
      </BotonPie>
      <SepPie />
      <BotonPie Icono={CheckCircle2} tono="ok" onClick={guardar} disabled={!editando || ocupado}>Aceptar</BotonPie>
      <BotonPie Icono={XCircle} tono="no" onClick={() => { setBorrador(null); setNuevo(false); }} disabled={!editando}>
        Cancelar
      </BotonPie>
      <span className="flex-1" />
      {aviso && <span className="rounded-full bg-paper px-4 py-2 text-[12.5px] font-bold text-ink">{aviso}</span>}
      <BotonPie Icono={Keyboard} onClick={abrirTeclado}>Teclado</BotonPie>
      <SepPie />
      <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir} disabled={editando}>Salir</BotonPie>
    </>
  );

  return (
    <>
      <MarcoMantenimiento
        pestanas={["Lista", "Menú"]} pestana={pestana}
        onPestana={(p) => { if (!editando) abrirMenu(p === "Lista" ? undefined : menu?.id); }}
        pie={pie}
      >
        {pestana === "Lista" && (
          <Caja crecer titulo="Menús del local" contador={`${menus.length}`}>
            <Desplazable eje="ambos" className="border-t border-line">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70">
                    <th>Nombre</th><th className="w-28 text-right!">Precio</th>
                    <th className="w-24 text-right!">Pasos</th><th className="w-28 text-center!">Se vende</th>
                  </tr>
                </thead>
                <tbody>
                  {menus.map((m) => (
                    <tr key={m.id} onClick={() => abrirMenu(m.id)}
                      className={`cursor-pointer border-b border-line text-[13.5px] ${m.id === menu?.id ? "bg-accent-soft" : ""}`}>
                      <td className="px-2.5 py-2 font-semibold">{m.nombre}</td>
                      <td className="px-2.5 py-2 text-right font-mono font-bold">{eur(m.precio)}</td>
                      <td className="px-2.5 py-2 text-right font-mono text-muted">{m.pasos.length}</td>
                      <td className="px-2.5 py-2 text-center text-[12px]">
                        {m.activo
                          ? <span className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 font-bold text-mint">Sí</span>
                          : <span className="rounded-full border border-line px-2.5 py-1 font-bold text-muted">No</span>}
                      </td>
                    </tr>
                  ))}
                  {menus.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                      Todavía no hay menús. Pulsa «Nuevo».
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>
        )}

        {pestana === "Menú" && menu && (
          <>
            {pegas.length > 0 && (
              <div className="flex flex-none flex-col gap-1 rounded-[6px] border border-amber/30 bg-amber/8 px-3.5 py-3 text-[13px] font-semibold leading-snug text-amber">
                {pegas.map((p) => (
                  <span key={p} className="flex items-center gap-2.5">
                    <TriangleAlert size={16} className="flex-none" /> {p}
                  </span>
                ))}
              </div>
            )}

            <Caja titulo="El menú">
              <div className="grid gap-3.5 p-3.5 lg:grid-cols-3">
                <Campo etiqueta="Nombre" htmlFor="m-nom">
                  <input id="m-nom" value={menu.nombre} readOnly={ro} placeholder="Menú del día"
                    onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro)} />
                </Campo>
                <Campo etiqueta="Precio cerrado (impuesto incluido)" htmlFor="m-pre">
                  <input id="m-pre" type="number" step="0.05" min="0" value={menu.precio} readOnly={ro}
                    onChange={(e) => set("precio", Number(e.target.value))}
                    className={claseEntrada(ro, "text-right font-mono")} />
                </Campo>
                <Campo etiqueta="Impuesto" htmlFor="m-imp">
                  <Selector id="m-imp" value={menu.claseFiscal} disabled={ro}
                    onChange={(v) => set("claseFiscal", v)}>
                    <option value="REDUCIDO">Reducido — hostelería</option>
                    <option value="GENERAL">General</option>
                    <option value="SUPERREDUCIDO">Superreducido</option>
                  </Selector>
                </Campo>
              </div>
              <p className="flex items-center gap-2.5 border-t border-line bg-panel-2 px-3.5 py-2 text-[12px] text-muted">
                <Info size={15} className="flex-none" />
                El precio del menú es <b>cerrado</b>: no sale de sumar los platos. Lo que sí
                puede sumar es el <b>suplemento</b> de un plato concreto (en su ficha).
              </p>
            </Caja>

            <Caja crecer titulo="Pasos del menú" contador={`${menu.pasos.length} pasos`}
              acciones={!ro && (
                <button type="button" onClick={anadirPaso}
                  className="flex min-h-8 items-center gap-1.5 rounded-[5px] bg-mint px-2.5 text-[12px] font-semibold text-white transition-transform active:scale-95">
                  <Plus size={14} strokeWidth={3} /> Añadir paso
                </button>
              )}>
              <Desplazable className="flex flex-col gap-2 p-2.5">
                {menu.pasos.map((p, i) => {
                  const cuantas = opcionesDePaso(p, productosPorCategoria).length;
                  return (
                    <section key={p.id} className="rounded-[6px] border border-line bg-panel-2">
                      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand text-[12px] font-extrabold text-white">
                          {i + 1}
                        </span>
                        {ro ? <b className="text-[13.5px]">{p.nombre}</b> : (
                          <input value={p.nombre} aria-label="Nombre del paso"
                            onChange={(e) => setPaso(p.id, (x) => ({ ...x, nombre: e.target.value }))}
                            className={claseEntrada(false, "w-44", true)} />
                        )}
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                          cuantas === 0 ? "border-danger/40 bg-danger/10 text-danger" : "border-line text-muted"
                        }`}>
                          {cuantas === 0 ? "sin platos" : `${cuantas} platos`}
                        </span>
                        {!ro && (
                          <span className="ml-auto flex items-center gap-1">
                            <button type="button" onClick={() => moverPaso(p.id, -1)} disabled={i === 0}
                              aria-label="Subir el paso"
                              className="grid h-8 w-8 place-items-center rounded-[5px] border border-line text-muted transition-transform active:scale-90 disabled:opacity-25">
                              <ChevronUp size={15} />
                            </button>
                            <button type="button" onClick={() => moverPaso(p.id, 1)} disabled={i === menu.pasos.length - 1}
                              aria-label="Bajar el paso"
                              className="grid h-8 w-8 place-items-center rounded-[5px] border border-line text-muted transition-transform active:scale-90 disabled:opacity-25">
                              <ChevronDown size={15} />
                            </button>
                            <button type="button" aria-label={`Quitar el paso ${p.nombre}`}
                              onClick={() => setBorrador((b) => b ? { ...b, pasos: b.pasos.filter((x) => x.id !== p.id) } : b)}
                              className="grid h-8 w-8 place-items-center rounded-[5px] border border-line text-muted transition-transform active:scale-90 hover:text-danger">
                              <X size={15} strokeWidth={2.6} />
                            </button>
                          </span>
                        )}
                      </header>

                      <div className="grid gap-3 p-3 lg:grid-cols-3">
                        <Campo etiqueta="De dónde salen los platos" htmlFor={`cat-${p.id}`}>
                          <Selector id={`cat-${p.id}`} disabled={ro}
                            value={p.categoryId ?? A_MANO}
                            onChange={(v) => setPaso(p.id, (x) => ({ ...x, categoryId: v === A_MANO ? null : v }))}>
                            <option value={A_MANO}>Lista a mano (los de abajo)</option>
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>Categoría · {c.nombre}</option>
                            ))}
                          </Selector>
                        </Campo>
                        <Campo etiqueta="Cuántos se eligen" htmlFor={`np-${p.id}`}>
                          <input id={`np-${p.id}`} type="number" min="1" step="1" value={p.numPlatos} readOnly={ro}
                            onChange={(e) => setPaso(p.id, (x) => ({ ...x, numPlatos: Math.max(1, Number(e.target.value)) }))}
                            className={claseEntrada(ro, "text-right font-mono")} />
                        </Campo>
                        <Campo etiqueta="Pase de cocina" htmlFor={`pa-${p.id}`}>
                          <Selector id={`pa-${p.id}`} disabled={ro}
                            value={p.ordenPrep === null ? "" : String(p.ordenPrep)}
                            onChange={(v) => setPaso(p.id, (x) => ({ ...x, ordenPrep: v === "" ? null : Number(v) }))}>
                            <option value="">Deducir del nombre (como antes)</option>
                            {PASES.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
                          </Selector>
                        </Campo>
                      </div>

                      {p.categoryId ? (
                        <p className="border-t border-line px-3 py-2 text-[12px] leading-snug text-muted">
                          Los platos son los de esa categoría. Para cambiar el menú del día,
                          cambia qué hay en ella: no hace falta volver aquí.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 border-t border-line p-2.5">
                          {p.opciones.map((pid) => (
                            <span key={pid} className="flex items-center gap-2 rounded-[5px] border border-line bg-panel px-2.5 py-1.5 text-[12.5px]">
                              {nombreProducto[pid] ?? pid}
                              {!ro && (
                                <button type="button" aria-label={`Quitar ${nombreProducto[pid] ?? pid}`}
                                  onClick={() => setPaso(p.id, (x) => ({ ...x, opciones: x.opciones.filter((o) => o !== pid) }))}
                                  className="grid h-5 w-5 place-items-center rounded text-muted transition-transform active:scale-90 hover:text-danger">
                                  <X size={12} strokeWidth={2.6} />
                                </button>
                              )}
                            </span>
                          ))}
                          {p.opciones.length === 0 && (
                            <span className="px-1 py-1 text-[12.5px] text-muted">
                              Sin platos. Elige una categoría arriba — es lo más cómodo.
                            </span>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}

                {menu.pasos.length === 0 && (
                  <p className="px-1 py-8 text-center text-[13px] text-muted">
                    Este menú no tiene pasos. {ro ? "Pulsa «Modificar»." : "Pulsa «Añadir paso»."}
                  </p>
                )}
              </Desplazable>
            </Caja>
          </>
        )}

        {pestana === "Menú" && !menu && (
          <Caja crecer>
            <p className="grid flex-1 place-items-center p-8 text-center text-sm text-muted">
              No hay ningún menú abierto.
            </p>
          </Caja>
        )}
      </MarcoMantenimiento>

      {borrar && menu && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={BookOpen} titulo="Eliminar menú" subtitulo={menu.nombre}
            onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[13.5px] leading-relaxed text-paper/85">
              Se borrará el menú y sus pasos. Los <b>artículos no se tocan</b>: siguen en la
              carta. Las ventas ya hechas tampoco cambian.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-line bg-panel-2 px-4 py-3">
            <button type="button" onClick={() => setBorrar(false)}
              className="min-h-11 rounded-[5px] border border-line px-4 text-[13px] font-medium text-muted transition-transform active:scale-95">
              Cancelar
            </button>
            <button type="button" onClick={eliminar}
              className="min-h-11 rounded-[5px] bg-danger px-5 text-[13px] font-semibold text-white transition-transform active:scale-95">
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
