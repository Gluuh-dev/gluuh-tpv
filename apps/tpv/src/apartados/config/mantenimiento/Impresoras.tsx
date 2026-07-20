import { useEffect, useState } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard,
  Printer, Info, Wifi, Usb, Check, X,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { imprimirTicket } from "../../../lib/impresion";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, claseEntrada,
} from "./Marco";
import {
  cargarImpresion, guardarImpresora, borrarImpresora, fijarRuta, explicarRuta,
  ROLES, TRANSPORTES, TIPOS, ESTACIONES_RUTA,
  type DatosImpresion, type Impresora,
} from "./impresion";

// ────────────────────────────────────────────────────────────────────────────
// IMPRESORAS Y RUTAS.
//
// Lo que hace útil esta pantalla no es la lista de aparatos: es la tabla de
// abajo, que dice PARA CADA estación y sala por dónde va a salir el papel y POR
// QUÉ. Sin eso hay que hacer el razonamiento a mano (regla de sala → regla
// general → impresora del rol), y es justo donde uno se equivoca y luego pasa
// un servicio entero preguntándose por qué la cocina no imprime.
// ────────────────────────────────────────────────────────────────────────────

const TEXTO_ESTACION: Record<string, string> = {
  COCINA: "Cocina", BARRA: "Barra", CAMARERO: "Lo prepara el camarero",
};

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");
const CUALQUIERA = "__cualquiera__";

const nueva = (): Impresora => ({
  id: crypto.randomUUID(), nombre: "", rol: "TICKETS", transporte: "RED",
  destino: "", ancho: 48, tipo: "EPSON", activa: true,
});

export function Impresoras({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const [datos, setDatos] = useState<DatosImpresion>({ impresoras: [], rutas: [], salas: [] });
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<Impresora | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void cargarImpresion().then((d) => {
      if (!vivo || !d) return;
      setDatos(d);
      setReal(true);
    });
    return () => { vivo = false; };
  }, []);

  const notificar = (t: string) => {
    setAviso(t);
    window.setTimeout(() => setAviso(""), 2600);
  };

  const editando = borrador !== null;
  const ro = !editando;
  const actual = borrador ?? datos.impresoras.find((p) => p.id === sel) ?? null;

  const set = <K extends keyof Impresora>(campo: K, valor: Impresora[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const crear = () => { setNuevo(true); setBorrador(nueva()); };
  const modificar = () => { if (actual) setBorrador(structuredClone(actual)); };

  const guardar = () => {
    if (!borrador || ocupado) return;
    if (!borrador.nombre.trim()) { notificar("La impresora necesita un nombre."); return; }
    if (borrador.transporte === "RED" && !borrador.destino.trim()) {
      notificar("Una impresora de red sin IP no imprime nada. Pon su dirección.");
      return;
    }
    setOcupado(true);
    void (async () => {
      try {
        if (real) await guardarImpresora(borrador);
        setDatos((d) => ({
          ...d,
          impresoras: nuevo
            ? [...d.impresoras, borrador]
            : d.impresoras.map((p) => (p.id === borrador.id ? borrador : p)),
        }));
        setSel(borrador.id);
        setBorrador(null); setNuevo(false);
        notificar(nuevo ? "Impresora dada de alta." : "Cambios guardados.");
      } catch (e: unknown) {
        notificar(`No se ha guardado: ${mensaje(e)}`);
      } finally { setOcupado(false); }
    })();
  };

  const eliminar = () => {
    setBorrar(false);
    if (!actual) return;
    const seguir = () => {
      setDatos((d) => ({
        ...d,
        impresoras: d.impresoras.filter((p) => p.id !== actual.id),
        rutas: d.rutas.filter((r) => r.printerId !== actual.id),
      }));
      setSel(null);
      notificar("Impresora eliminada.");
    };
    if (!real) { seguir(); return; }
    void borrarImpresora(actual.id).then(seguir)
      .catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
  };

  /** Prueba de verdad: si sale el papel, está bien configurada. */
  const probar = () => {
    if (!actual) return;
    void imprimirTicket({
      local: { nombre: "PRUEBA DE IMPRESIÓN" },
      contexto: `${actual.nombre} · ${ROLES.find((r) => r.valor === actual.rol)?.texto ?? actual.rol}`,
      lineas: [
        { cantidad: 1, nombre: "Si lees esto, está bien configurada", importe: 0 },
        { cantidad: 1, nombre: actual.destino || "sin destino", importe: 0 },
      ],
      desglose: [],
      total: 0,
      leyenda: "Prueba: no es un documento fiscal.",
    // El ancho en mm sale del ancho en caracteres: 48 → 80 mm, 32 → 58 mm.
    }, { anchoMm: actual.ancho >= 42 ? 80 : 58 })
      .then(() => notificar("Enviado. Si no sale papel, revisa la IP y que esté encendida."))
      .catch((e: unknown) => notificar(`No se ha podido imprimir: ${mensaje(e)}`));
  };

  const cambiarRuta = (estacion: string, roomId: string | null, printerId: string | null) => {
    setDatos((d) => ({
      ...d,
      rutas: [
        ...d.rutas.filter((r) => !(r.estacion === estacion && r.roomId === roomId)),
        ...(printerId ? [{ id: crypto.randomUUID(), estacion, roomId, printerId }] : []),
      ],
    }));
    if (!real) return;
    void fijarRuta(estacion, roomId, printerId)
      .catch((e: unknown) => notificar(`No se ha podido guardar la ruta: ${mensaje(e)}`));
  };

  const pie = (
    <>
      <BotonPie Icono={PlusCircle} tono="ok" onClick={crear} disabled={editando}>Nueva</BotonPie>
      <BotonPie Icono={Pencil} onClick={modificar} disabled={editando || !actual}>Modificar</BotonPie>
      <BotonPie Icono={Printer} onClick={probar} disabled={editando || !actual}>Probar</BotonPie>
      <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={editando || !actual}>
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

  // Salas + la fila «cualquier sala», que es la regla general.
  const filasSala = [{ id: CUALQUIERA, nombre: "Cualquier sala" }, ...datos.salas];

  return (
    <>
      <MarcoMantenimiento pestanas={["Impresoras"]} pestana="Impresoras" onPestana={() => {}} pie={pie}>
        {datos.impresoras.length === 0 && !editando && (
          <p className="flex flex-none items-center gap-2.5 rounded-[6px] border border-amber/30 bg-amber/8 px-3.5 py-3 text-[13px] font-semibold leading-snug text-amber">
            <Info size={18} className="flex-none" />
            No hay ninguna impresora dada de alta, así que <b>ninguna comanda sale por red</b>:
            todo cae al camino local del terminal. Pulsa «Nueva» para configurar la primera.
          </p>
        )}

        <Caja titulo="Impresoras del local" contador={`${datos.impresoras.length}`}>
          <Desplazable eje="ambos" fuera="max-h-64" className="border-t border-line">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:border-b [&>th]:border-line [&>th]:bg-panel [&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
                  <th>Nombre</th><th className="w-40">Papel de</th><th className="w-28">Conexión</th>
                  <th className="w-52">Destino</th><th className="w-24 text-center!">Ancho</th>
                  <th className="w-24 text-center!">Activa</th>
                </tr>
              </thead>
              <tbody>
                {datos.impresoras.map((p) => (
                  <tr key={p.id} onClick={() => setSel(p.id)}
                    className={`cursor-pointer border-b border-line text-[13.5px] ${p.id === actual?.id ? "bg-accent-soft" : ""}`}>
                    <td className="px-2.5 py-2 font-semibold">{p.nombre}</td>
                    <td className="px-2.5 py-2">{ROLES.find((r) => r.valor === p.rol)?.texto ?? p.rol}</td>
                    <td className="px-2.5 py-2">
                      <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                        {p.transporte === "RED" ? <Wifi size={14} /> : <Usb size={14} />}
                        {p.transporte === "RED" ? "Red" : "USB"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-[12.5px] text-muted">{p.destino || "— sin fijar —"}</td>
                    <td className="px-2.5 py-2 text-center font-mono text-[12.5px]">{p.ancho}</td>
                    <td className="px-2.5 py-2 text-center">
                      {p.activa
                        ? <Check size={15} className="mx-auto text-mint" strokeWidth={3} />
                        : <X size={15} className="mx-auto text-danger" strokeWidth={3} />}
                    </td>
                  </tr>
                ))}
                {datos.impresoras.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">Ninguna todavía.</td></tr>
                )}
              </tbody>
            </table>
          </Desplazable>
        </Caja>

        {actual && (
          <Caja titulo={editando ? (nuevo ? "Nueva impresora" : "Editando impresora") : "Datos de la impresora"}>
            <div className="grid gap-3.5 p-3.5 lg:grid-cols-3">
              <div>
                <Campo etiqueta="Nombre" htmlFor="i-nom">
                  <input id="i-nom" value={actual.nombre} readOnly={ro} placeholder="Cocina, Barra terraza…"
                    onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro)} />
                </Campo>
                <Campo etiqueta="Papel de" htmlFor="i-rol">
                  <Selector id="i-rol" value={actual.rol} disabled={ro} onChange={(v) => set("rol", v)}>
                    {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
                  </Selector>
                </Campo>
              </div>
              <div>
                <Campo etiqueta="Conexión" htmlFor="i-tra">
                  <Selector id="i-tra" value={actual.transporte} disabled={ro} onChange={(v) => set("transporte", v)}>
                    {TRANSPORTES.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
                  </Selector>
                </Campo>
                <Campo etiqueta={actual.transporte === "RED" ? "IP y puerto" : "Nombre o ruta USB"} htmlFor="i-dst">
                  <input id="i-dst" value={actual.destino} readOnly={ro}
                    placeholder={actual.transporte === "RED" ? "192.168.1.201:9100" : "USB001"}
                    onChange={(e) => set("destino", e.target.value)} className={claseEntrada(ro, "font-mono")} />
                </Campo>
              </div>
              <div>
                <Campo etiqueta="Ancho del papel" htmlFor="i-anc">
                  <Selector id="i-anc" value={String(actual.ancho)} disabled={ro}
                    onChange={(v) => set("ancho", Number(v))}>
                    <option value="48">80 mm — 48 caracteres</option>
                    <option value="32">58 mm — 32 caracteres</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Marca" htmlFor="i-tip">
                  <Selector id="i-tip" value={actual.tipo} disabled={ro} onChange={(v) => set("tipo", v)}>
                    {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
                  </Selector>
                </Campo>
                <Campo etiqueta="En servicio">
                  <button type="button" disabled={ro} aria-pressed={actual.activa}
                    onClick={() => set("activa", !actual.activa)}
                    className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-[5px] border border-line bg-panel-2 px-3 text-[12.5px] font-bold text-paper/80 transition-transform active:scale-[.98] disabled:opacity-60">
                    {actual.activa ? "Sí, imprime" : "No, está fuera de servicio"}
                    <span className={`relative h-5.5 w-9.5 flex-none rounded-full transition-colors ${actual.activa ? "bg-mint" : "bg-paper/20"}`}>
                      <i className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left] ${actual.activa ? "left-[19px]" : "left-[3px]"}`} />
                    </span>
                  </button>
                </Campo>
              </div>
            </div>
          </Caja>
        )}

        <Caja crecer titulo="Por dónde sale cada comanda"
          contador={`${datos.rutas.length} reglas`}>
          <p className="flex-none border-b border-line bg-panel-2 px-3.5 py-2 text-[12px] leading-snug text-muted">
            El artículo dice su <b>estación</b>; aquí se traduce a impresora. Lo concreto gana:
            una regla para una sala manda sobre la general. Sin regla, cae en la impresora de
            ese papel.
          </p>
          <Desplazable eje="ambos" className="border-t border-line">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:border-b [&>th]:border-line [&>th]:bg-panel [&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
                  <th className="w-52">Sala</th>
                  {ESTACIONES_RUTA.map((e) => <th key={e}>{TEXTO_ESTACION[e] ?? e}</th>)}
                </tr>
              </thead>
              <tbody>
                {filasSala.map((s) => {
                  const roomId = s.id === CUALQUIERA ? null : s.id;
                  return (
                    <tr key={s.id} className="border-b border-line align-top">
                      <td className="px-2.5 py-2 text-[13.5px] font-semibold">
                        {s.nombre}
                        {roomId === null && (
                          <span className="block text-[11.5px] font-normal text-muted">
                            La regla general del local
                          </span>
                        )}
                      </td>
                      {ESTACIONES_RUTA.map((est) => {
                        const propia = datos.rutas.find((r) => r.estacion === est && r.roomId === roomId);
                        const { impresora, motivo } = explicarRuta(est, roomId, datos.rutas, datos.impresoras);
                        return (
                          <td key={est} className="px-2.5 py-2">
                            <Selector id={`ruta-${s.id}-${est}`} value={propia?.printerId ?? ""}
                              disabled={editando}
                              onChange={(v) => cambiarRuta(est, roomId, v || null)}>
                              <option value="">— sin regla —</option>
                              {datos.impresoras.map((p) => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </Selector>
                            {/* La explicación es el motivo de que esta tabla exista. */}
                            <span className={`mt-1 block text-[11px] leading-snug ${impresora ? "text-muted" : "text-danger"}`}>
                              {impresora ? `→ ${impresora.nombre}. ${motivo}` : motivo}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Desplazable>
        </Caja>
      </MarcoMantenimiento>

      {borrar && actual && (
        <Modal onCerrar={() => setBorrar(false)} ancho="md">
          <CabeceraModal Icono={Printer} titulo="Eliminar impresora" subtitulo={actual.nombre}
            onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[13.5px] leading-relaxed text-paper/85">
              Se borrará la impresora <b>y las reglas que la usaban</b>. Las estaciones que
              salían por aquí pasarán a la impresora de su papel, o dejarán de imprimir si no
              hay ninguna.
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
