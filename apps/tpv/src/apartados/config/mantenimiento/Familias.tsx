import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut, Keyboard, Layers, Info,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado, Desplazable } from "../../../ui";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  MarcoMantenimiento, Caja, Campo, BotonPie, SepPie, claseEntrada,
} from "./Marco";
import { PaletaColor, InterruptorSN } from "./ClasificacionUI";
import { cargarFamilias, guardarFamilia, borrarFamilia, type Familia } from "./clasificacion";
import { CATEGORIAS_DEMO } from "../../tpv/datos";

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
  combinable: false, mostrarVenta: true, mostrarMenus: true,
}));

export function Familias({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const ruta = useRuta();
  const [familias, setFamilias] = useState<Familia[]>(DEMO);
  const [real, setReal] = useState(false);
  const [borrador, setBorrador] = useState<Familia | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [q, setQ] = useState("");
  const [borrar, setBorrar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarFamilias().then((f) => { if (vivo && f) { setFamilias(f); setReal(true); } });
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

  const editando = borrador !== null;
  const ro = !editando;
  const pestana = borrador || ruta.id ? "Ficha" : "Lista";

  const set = <K extends keyof Familia>(campo: K, valor: Familia[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  const crear = () => {
    setNuevo(true);
    setBorrador({
      id: crypto.randomUUID(), nombre: "", color: "#2f7fd0",
      orden: familias.length + 1, combinable: false, mostrarVenta: true, mostrarMenus: true,
    });
  };

  const guardar = () => {
    if (!borrador || ocupado) return;
    if (!borrador.nombre.trim()) { notificar("La familia necesita un nombre."); return; }
    setOcupado(true);
    (async () => {
      try {
        if (real) await guardarFamilia(borrador);
        setFamilias((fs) => nuevo ? [...fs, borrador] : fs.map((f) => (f.id === borrador.id ? borrador : f)));
        if (nuevo) abrir(borrador.id);
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
  } else {
    pie = (
      <>
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
        pestanas={["Lista", "Ficha"]} pestana={pestana}
        onPestana={(p) => { if (!editando) abrir(p === "Lista" ? undefined : fam?.id); }}
        pie={pie} pegado={pestana === "Lista"}
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

        {pestana === "Ficha" && fam && (
          <Caja crecer>
            <Desplazable className="p-3.5">
              <div className="grid max-w-3xl gap-3.5">
                <Campo etiqueta="Nombre" htmlFor="f-nom">
                  <input id="f-nom" value={fam.nombre} readOnly={ro} placeholder="Bebidas, Cocina, Postres…"
                    onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro)} />
                </Campo>
                <Campo etiqueta="Orden en la carta" htmlFor="f-ord">
                  <input id="f-ord" type="number" min="0" step="1" value={fam.orden} readOnly={ro}
                    onChange={(e) => set("orden", Number(e.target.value))} className={claseEntrada(ro, "w-28 text-right font-mono")} />
                </Campo>
                <Campo etiqueta="Color">
                  <PaletaColor valor={fam.color} soloLectura={ro} onCambio={(c) => set("color", c)} />
                </Campo>
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
      </MarcoMantenimiento>

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
