import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Search, Plus, X,
  Keyboard, Truck, PackageCheck, Info,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, claseEntrada, BuscadorRegistros,
} from "./Marco";
import {
  cargarCompras, guardarCompra, recibirCompra, borrarCompra, crearProveedor,
  totales, baseLinea,
  type Compras as DatosCompras, type DocumentoCompra, type LineaCompra, type Proveedor,
} from "./compra";

// ────────────────────────────────────────────────────────────────────────────
// COMPRAS — albaranes y facturas de proveedor, desde el TPV.
//
// Se maneja igual que Artículos (consulta / Modificar / Aceptar), porque quien
// lo usa es la misma persona y el gesto tiene que ser el mismo.
//
// La diferencia importante: un albarán RECIBIDO ya ha movido existencias, así
// que no se edita. Se corrige con otro documento, como en cualquier
// contabilidad — si se pudiera editar, cambiar una cantidad dejaría el stock
// descuadrado sin que nadie se enterara.
// ────────────────────────────────────────────────────────────────────────────

const IMPUESTOS_COMPRA = [0, 4, 7, 10, 21];
const hoy = () => new Date().toISOString().slice(0, 10);

const ESTADO: Record<DocumentoCompra["estado"], { texto: string; clase: string }> = {
  BORRADOR: { texto: "Borrador", clase: "border-line bg-panel-2 text-muted" },
  RECIBIDO: { texto: "Recibido", clase: "border-mint/40 bg-mint/10 text-mint" },
  ANULADO: { texto: "Anulado", clase: "border-danger/40 bg-danger/10 text-danger" },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");

export function Compras({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const ruta = useRuta();
  const [datos, setDatos] = useState<DatosCompras>({ documentos: [], proveedores: [] });
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<DocumentoCompra | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [q, setQ] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [buscaProv, setBuscaProv] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    void cargarCompras().then((c) => {
      if (!vivo || !c) return;
      setDatos(c);
      setReal(true);
    });
    return () => { vivo = false; };
  }, []);

  const notificar = (t: string) => {
    setAviso(t);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAviso(""), 2600);
  };

  const nombreProveedor = (id: string | null) =>
    datos.proveedores.find((p) => p.id === id)?.nombre ?? "Sin proveedor";

  const lista = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return datos.documentos;
    return datos.documentos.filter((d) =>
      norm(`${d.numero} ${nombreProveedor(d.supplierId)} ${d.fecha}`).includes(nq));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, q]);

  const enUrl = ruta.id ? datos.documentos.findIndex((d) => d.id === ruta.id) : -1;
  const doc = borrador ?? datos.documentos[Math.max(enUrl, 0)];
  const abrirDoc = (id?: string) =>
    navegar({ vista: "config", seccion: "compras", ...(id ? { id } : {}) }, !id);

  const editando = borrador !== null;
  const ro = !editando;
  const pestana = borrador || ruta.id ? "Documento" : "Lista";
  const recibido = doc?.estado === "RECIBIDO";
  const t = totales(doc?.lineas ?? []);

  const set = <K extends keyof DocumentoCompra>(campo: K, valor: DocumentoCompra[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const setLinea = (id: string, cambio: (l: LineaCompra) => LineaCompra) =>
    setBorrador((b) => (b ? { ...b, lineas: b.lineas.map((l) => (l.id === id ? cambio(l) : l)) } : b));

  const crear = () => {
    setNuevo(true);
    setBorrador({
      id: crypto.randomUUID(), supplierId: datos.proveedores[0]?.id ?? null,
      tipo: "ALBARAN", estado: "BORRADOR", numero: "", fecha: hoy(), notas: "",
      lineas: [],
    });
  };

  const anadirLinea = () =>
    setBorrador((b) => b ? {
      ...b,
      lineas: [...b.lineas, {
        id: crypto.randomUUID(), productId: null, ingredientId: null,
        descripcion: "", cantidad: 1, unidad: "ud",
        precioUnitario: 0, descuentoPct: 0, tipoImpositivo: 7,
      }],
    } : b);

  const modificar = () => {
    if (!doc) return;
    if (doc.estado !== "BORRADOR") { notificar("Un documento recibido no se edita: corrígelo con otro."); return; }
    setBorrador(structuredClone(doc));
  };

  const aplicar = async (d: DocumentoCompra, esNuevo: boolean) => {
    setOcupado(true);
    try {
      if (real) await guardarCompra(d);
      setDatos((s) => ({
        ...s,
        documentos: esNuevo ? [d, ...s.documentos] : s.documentos.map((x) => (x.id === d.id ? d : x)),
      }));
      setBorrador(null); setNuevo(false);
      if (esNuevo) abrirDoc(d.id);
      notificar(real
        ? (esNuevo ? "Documento creado." : "Cambios guardados.")
        : "Guardado solo en este terminal: sin emparejar, se pierde al recargar.");
    } catch (e: unknown) {
      notificar(`No se ha guardado: ${mensaje(e)}`);
    } finally {
      setOcupado(false);
    }
  };

  const guardar = () => {
    if (!borrador || ocupado) return;
    if (borrador.lineas.length === 0) { notificar("Un documento sin líneas no se guarda."); return; }
    void aplicar(borrador, nuevo);
  };

  /** Recibir mueve existencias: se pide confirmación porque es de ida. */
  const recibir = () => {
    if (!doc || ocupado || doc.estado !== "BORRADOR") return;
    setOcupado(true);
    void (async () => {
      try {
        if (real) await recibirCompra(doc);
        setDatos((s) => ({
          ...s,
          documentos: s.documentos.map((x) => (x.id === doc.id ? { ...x, estado: "RECIBIDO" as const } : x)),
        }));
        notificar("Mercancía recibida: el stock ya está actualizado.");
      } catch (e: unknown) {
        notificar(`No se ha podido recibir: ${mensaje(e)}`);
      } finally {
        setOcupado(false);
      }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    if (!doc) return;
    const seguir = () => {
      setDatos((s) => ({ ...s, documentos: s.documentos.filter((x) => x.id !== doc.id) }));
      abrirDoc();
      notificar("Documento eliminado.");
    };
    if (!real) { seguir(); return; }
    void borrarCompra(doc.id).then(seguir)
      .catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
  };

  const crearProv = (nombre: string) => {
    const id = crypto.randomUUID();
    setDatos((s) => ({ ...s, proveedores: [...s.proveedores, { id, nombre, nif: "" }] }));
    if (real) {
      void crearProveedor(id, nombre)
        .then(() => notificar(`Proveedor «${nombre}» creado.`))
        .catch((e: unknown) => notificar(`No se ha podido crear: ${mensaje(e)}`));
    }
    return id;
  };

  const pie = (
    <>
      <BotonPie Icono={PlusCircle} tono="ok" onClick={crear} disabled={editando}>Nuevo</BotonPie>
      <BotonPie Icono={Pencil} onClick={modificar} disabled={editando || !doc || recibido}>Modificar</BotonPie>
      <BotonPie Icono={PackageCheck} tono="ok" onClick={recibir}
        disabled={editando || ocupado || !doc || recibido}>
        Recibir
      </BotonPie>
      <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)}
        disabled={editando || !doc}>
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
        pestanas={["Lista", "Documento"]} pestana={pestana}
        onPestana={(p) => { if (!editando) abrirDoc(p === "Lista" ? undefined : doc?.id); }}
        pie={pie}
      >
        {pestana === "Lista" && (
          <Caja crecer>
            <div className="flex flex-none items-center gap-2 border-b border-line p-2.5">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por número, proveedor o fecha…"
                  className={claseEntrada(false, "w-full pl-9.5")} />
              </div>
            </div>
            <Desplazable eje="ambos">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70">
                    <th className="w-28">Fecha</th><th className="w-36">Número</th><th>Proveedor</th>
                    <th className="w-24 text-center!">Tipo</th><th className="w-28 text-center!">Estado</th>
                    <th className="w-20 text-right!">Líneas</th><th className="w-28 text-right!">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d) => {
                    const td = totales(d.lineas);
                    const sel = d.id === doc?.id;
                    return (
                      <tr key={d.id} onClick={() => abrirDoc(d.id)}
                        className={`cursor-pointer border-b border-line text-[13.5px] ${sel ? "bg-accent-soft" : ""}`}>
                        <td className="px-2.5 py-2 font-mono text-[13px] text-muted">{d.fecha}</td>
                        <td className="px-2.5 py-2 font-mono text-[13px]">{d.numero || "—"}</td>
                        <td className="px-2.5 py-2 font-semibold">{nombreProveedor(d.supplierId)}</td>
                        <td className="px-2.5 py-2 text-center text-[12px] text-muted">
                          {d.tipo === "FACTURA" ? "Factura" : "Albarán"}
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${ESTADO[d.estado].clase}`}>
                            {ESTADO[d.estado].texto}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono text-muted">{d.lineas.length}</td>
                        <td className="px-2.5 py-2 text-right font-mono font-bold">{eur(td.total)}</td>
                      </tr>
                    );
                  })}
                  {lista.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                      {datos.documentos.length === 0
                        ? "Todavía no hay compras. Pulsa «Nuevo» para meter un albarán."
                        : `Ninguna compra encaja con «${q.trim()}».`}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>
        )}

        {pestana === "Documento" && doc && (
          <>
            {recibido && (
              <p className="flex flex-none items-center gap-2.5 rounded-[6px] border border-mint/30 bg-mint/8 px-3.5 py-3 text-[13px] font-semibold leading-snug text-mint">
                <Info size={18} className="flex-none" />
                Este documento ya movió existencias, así que no se edita. Si hay un error,
                se corrige con otro documento — como en cualquier contabilidad.
              </p>
            )}

            <Caja titulo="Datos del documento">
              <div className="grid gap-3.5 p-3.5 lg:grid-cols-3">
                <div>
                  <Campo etiqueta="Proveedor" htmlFor="c-prov">
                    <div className="flex gap-1.5">
                      <input id="c-prov" readOnly value={nombreProveedor(doc.supplierId)}
                        className={claseEntrada(true, "min-w-0 flex-1")} />
                      <button type="button" disabled={ro} onClick={() => setBuscaProv(true)}
                        aria-label="Buscar proveedor"
                        className="grid h-11 w-11 flex-none place-items-center rounded-[5px] border border-line bg-panel text-paper/80 transition-transform active:scale-95 disabled:opacity-35">
                        <Search size={16} />
                      </button>
                    </div>
                  </Campo>
                  <Campo etiqueta="Número del proveedor" htmlFor="c-num">
                    <input id="c-num" value={doc.numero} readOnly={ro}
                      onChange={(e) => set("numero", e.target.value)}
                      placeholder="ALB-2026-0001"
                      className={claseEntrada(ro, "font-mono")} />
                  </Campo>
                </div>

                <div>
                  <Campo etiqueta="Tipo" htmlFor="c-tipo">
                    <Selector id="c-tipo" value={doc.tipo} disabled={ro}
                      onChange={(v) => set("tipo", v === "FACTURA" ? "FACTURA" : "ALBARAN")}>
                      <option value="ALBARAN">Albarán — entra mercancía</option>
                      <option value="FACTURA">Factura — documento que se paga</option>
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Fecha" htmlFor="c-fecha">
                    <input id="c-fecha" type="date" value={doc.fecha} readOnly={ro}
                      onChange={(e) => set("fecha", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                </div>

                <div className="flex flex-col justify-end gap-1.5 rounded-[6px] border border-line bg-panel-2 p-3">
                  <span className="flex justify-between text-[12.5px] text-muted">
                    Base <b className="font-mono text-paper">{eur(t.base)}</b>
                  </span>
                  <span className="flex justify-between text-[12.5px] text-muted">
                    Impuestos <b className="font-mono text-paper">{eur(t.impuestos)}</b>
                  </span>
                  <span className="flex justify-between border-t border-line pt-1.5 text-[14px] font-bold">
                    Total <b className="font-mono text-cobro">{eur(t.total)}</b>
                  </span>
                </div>
              </div>
            </Caja>

            <Caja crecer titulo="Líneas" contador={`${doc.lineas.length} líneas`}
              acciones={!ro && (
                <button type="button" onClick={anadirLinea}
                  className="flex min-h-8 items-center gap-1.5 rounded-[5px] bg-mint px-2.5 text-[12px] font-semibold text-white transition-transform active:scale-95">
                  <Plus size={14} strokeWidth={3} /> Añadir línea
                </button>
              )}>
              <Desplazable eje="ambos" className="border-t border-line">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:border-b [&>th]:border-line [&>th]:bg-panel [&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
                      <th>Descripción del albarán</th>
                      <th className="w-24 text-right!">Cantidad</th><th className="w-20">Unidad</th>
                      <th className="w-28 text-right!">Precio</th><th className="w-20 text-right!">Dto. %</th>
                      <th className="w-24 text-right!">Imp. %</th><th className="w-28 text-right!">Importe</th>
                      {!ro && <th className="w-12" aria-label="Quitar" />}
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lineas.map((l) => (
                      <tr key={l.id} className="border-b border-line">
                        <td className="px-1.5 py-1">
                          <input value={l.descripcion} readOnly={ro} placeholder="Lo que pone el albarán"
                            onChange={(e) => setLinea(l.id, (x) => ({ ...x, descripcion: e.target.value }))}
                            className={claseEntrada(ro, "", true)} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input type="number" step="0.001" min="0" value={l.cantidad} readOnly={ro}
                            onChange={(e) => setLinea(l.id, (x) => ({ ...x, cantidad: Number(e.target.value) }))}
                            className={claseEntrada(ro, "text-right font-mono", true)} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input value={l.unidad} readOnly={ro}
                            onChange={(e) => setLinea(l.id, (x) => ({ ...x, unidad: e.target.value }))}
                            className={claseEntrada(ro, "", true)} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input type="number" step="0.0001" min="0" value={l.precioUnitario} readOnly={ro}
                            onChange={(e) => setLinea(l.id, (x) => ({ ...x, precioUnitario: Number(e.target.value) }))}
                            className={claseEntrada(ro, "text-right font-mono", true)} />
                        </td>
                        <td className="px-1.5 py-1">
                          <input type="number" step="1" min="0" max="100" value={l.descuentoPct} readOnly={ro}
                            onChange={(e) => setLinea(l.id, (x) => ({ ...x, descuentoPct: Number(e.target.value) }))}
                            className={claseEntrada(ro, "text-right font-mono", true)} />
                        </td>
                        <td className="px-1.5 py-1">
                          <Selector id={`imp-${l.id}`} value={String(l.tipoImpositivo)} disabled={ro}
                            onChange={(v) => setLinea(l.id, (x) => ({ ...x, tipoImpositivo: Number(v) }))}>
                            {IMPUESTOS_COMPRA.map((i) => <option key={i} value={i}>{i} %</option>)}
                          </Selector>
                        </td>
                        <td className="px-2.5 py-1 text-right font-mono text-[13px] font-bold">
                          {eur(baseLinea(l))}
                        </td>
                        {!ro && (
                          <td className="px-1.5 py-1 text-center">
                            <button type="button" aria-label={`Quitar ${l.descripcion || "línea"}`}
                              onClick={() => setBorrador((b) => b ? { ...b, lineas: b.lineas.filter((x) => x.id !== l.id) } : b)}
                              className="grid h-8 w-8 place-items-center rounded-[5px] text-muted transition-transform active:scale-90 hover:text-danger">
                              <X size={16} strokeWidth={2.6} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {doc.lineas.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                        Sin líneas. {ro ? "Pulsa «Modificar» abajo." : "Pulsa «Añadir línea»."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </Desplazable>
              <p className="flex-none border-t border-line bg-panel-2 px-3.5 py-1.5 text-[12px] text-muted">
                Los precios de compra van <b>SIN impuesto</b>, como en el albarán del proveedor
                (al revés que la carta, donde el PVP lo lleva incluido).
              </p>
            </Caja>
          </>
        )}

        {pestana === "Documento" && !doc && (
          <Caja crecer>
            <p className="grid flex-1 place-items-center p-8 text-center text-sm text-muted">
              No hay ningún documento abierto.
            </p>
          </Caja>
        )}
      </MarcoMantenimiento>

      {buscaProv && (
        <BuscadorRegistros
          titulo="Proveedores"
          registros={datos.proveedores.map((p: Proveedor, i) => ({ id: p.id, nombre: p.nombre, codigo: String(i + 1) }))}
          seleccionado={doc?.supplierId ?? ""}
          etiquetaNuevo="Nuevo proveedor"
          onCrear={crearProv}
          onAceptar={(id) => set("supplierId", id)}
          onCerrar={() => setBuscaProv(false)}
        />
      )}

      {borrar && doc && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={Truck} titulo="Eliminar documento"
            subtitulo={`${doc.numero || "Sin número"} · ${nombreProveedor(doc.supplierId)}`}
            onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[13.5px] leading-relaxed text-paper/85">
              {doc.estado === "RECIBIDO"
                ? "Este documento ya movió existencias. Borrarlo NO devuelve el stock: quedará descuadrado hasta que lo corrijas a mano."
                : "Se borrará el documento y sus líneas. No ha movido existencias, así que no afecta al stock."}
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
