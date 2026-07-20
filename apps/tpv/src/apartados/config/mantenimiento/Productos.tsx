import { useEffect, useMemo, useRef, useState } from "react";
import { useRuta, navegar } from "../../../lib/rutas";
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  PlusCircle, Pencil, MinusCircle, CheckCircle2, XCircle, LogOut,
  Search, Camera, Plus, X, Check, Info, SlidersHorizontal, Keyboard, Copy,
} from "lucide-react";
import { Modal, CabeceraModal, abrirTeclado } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { BotonProducto } from "../../tpv/venta/BotonProducto";
import { AspectoArticulo } from "./AspectoArticulo";
import {
  cargarCatalogo, guardarArticulo, borrarArticulo, crearFamiliaEnNodo, subirFotoArticulo,
} from "./catalogo";
import { duplicarArticulo } from "./duplicar";
import {
  MarcoMantenimiento, Caja, Campo, Selector, BotonPie, SepPie, EstadoPie, claseEntrada,
  BuscadorRegistros,
} from "./Marco";
import {
  ARTICULOS_DEMO, FAMILIAS, IMPUESTOS, ESTACIONES, ALERGENOS, PARAMETROS_POR_DEFECTO,
  margen, siguienteNumero,
  type Articulo, type FormatoVenta, type Estacion, type ParametrosArticulo,
} from "./datos-articulos";

// ────────────────────────────────────────────────────────────────────────────
// MANTENIMIENTO DE ARTÍCULOS — la primera sección de Configuración con pantalla
// real (del mockup docs/diseño/configuracion-faltante/gluuh-mantenimiento-articulos).
//
// Se navega como un TPV de verdad, no como una web: la ficha se CONSULTA en solo
// lectura y hay que pulsar «Modificar» para tocar nada; entonces la navegación de
// registros se bloquea y solo quedan Aceptar y Cancelar. Es lo que espera quien
// viene de Ágora o Glop, y evita el clásico "he cambiado el precio sin querer".
//
// DATOS: si el terminal está emparejado, la carta sale del nodo (`catalogo.ts`)
// y se guarda allí. Si no, se enseña la de ejemplo con su aviso — un catálogo de
// mentira sin avisar acabaría con alguien dando de alta 40 artículos que se
// pierden al recargar.
// ────────────────────────────────────────────────────────────────────────────

const SUBS = ["Datos generales", "Comentarios y extras", "Categorías", "Cocina y ticket"] as const;
type Sub = (typeof SUBS)[number];

// «cafe» debe encontrar «Café»: fuera acentos y mayúsculas (igual que en Configuracion).
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Interruptor táctil (mismo gesto en toda la configuración). */
function Interruptor({ activo, etiqueta, onToggle, disabled }: Readonly<{
  activo: boolean; etiqueta: string; onToggle: () => void; disabled?: boolean;
}>) {
  return (
    <button type="button" aria-pressed={activo} disabled={disabled} onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-[5px] border border-line bg-panel-2 px-3 text-[12.5px] font-bold text-paper/80 transition-transform active:scale-[.98] disabled:opacity-60">
      {etiqueta}
      <span className={`relative h-5.5 w-9.5 flex-none rounded-full transition-colors ${activo ? "bg-mint" : "bg-paper/20"}`}>
        <i className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-[left] ${activo ? "left-[19px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}

/** Chip de selección múltiple (categorías, alérgenos). */
function ChipSel({ texto, activo, onToggle, disabled }: Readonly<{
  texto: string; activo: boolean; onToggle: () => void; disabled?: boolean;
}>) {
  return (
    <button type="button" aria-pressed={activo} disabled={disabled} onClick={onToggle}
      className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-50 ${
        activo ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-line bg-panel-2 text-paper/70"
      }`}>
      {activo && <Check size={14} strokeWidth={3} />}
      {texto}
    </button>
  );
}

// Los parámetros, agrupados por lo que decide cada uno. El texto de ayuda dice
// QUÉ PASA en el bar si lo marcas — no repite el nombre del campo.
const GRUPOS_PARAMETROS: { titulo: string; campos: { clave: keyof ParametrosArticulo; texto: string; ayuda: string }[] }[] = [
  {
    titulo: "Venta",
    campos: [
      { clave: "vendible", texto: "Vendible", ayuda: "Si se apaga, deja de salir en el TPV sin borrarlo ni perder su histórico." },
      { clave: "agotado", texto: "Agotado hoy", ayuda: "El «86» de barra: sale en gris y no se puede pedir hasta que vuelva." },
      { clave: "alPeso", texto: "Venta por peso", ayuda: "Al venderlo pide los kilos y calcula el importe." },
      { clave: "preguntarPrecio", texto: "Preguntar precio", ayuda: "Sin precio fijo: lo teclea el camarero al añadirlo." },
      { clave: "descripcionLibre", texto: "Descripción libre", ayuda: "Pide un texto al vender (para «otros» o platos fuera de carta)." },
    ],
  },
  {
    titulo: "Qué es este artículo",
    campos: [
      { clave: "esPrincipal", texto: "Plato principal", ayuda: "Cuenta como plato en el reparto de la comanda." },
      { clave: "esAnadido", texto: "Es un añadido", ayuda: "Va pegado a otro artículo (extras, guarniciones)." },
      { clave: "esMenuDelDia", texto: "Menú del día", ayuda: "Se compone por pases y lleva precio cerrado." },
      { clave: "combinable", texto: "Se puede combinar", ayuda: "Copas: al añadirlo pregunta con qué refresco va." },
      { clave: "esAlcohol", texto: "Contiene alcohol", ayuda: "Lo necesita el desglose fiscal y el tipo de impuesto." },
    ],
  },
  {
    titulo: "Cocina, stock y ticket",
    campos: [
      { clave: "controlaStock", texto: "Controla stock", ayuda: "Descuenta existencias al venderlo y avisa al quedarse corto." },
      { clave: "noImprimirSiCero", texto: "No imprimir si vale 0", ayuda: "Las invitaciones no ensucian la comanda de cocina." },
      { clave: "eCommerce", texto: "Se pide por internet", ayuda: "Sale en la tienda: el cliente lo pide desde casa." },
      { clave: "cartaDigital", texto: "Sale en la carta QR", ayuda: "El cliente lo ve al escanear el código en la mesa." },
    ],
  },
];

/**
 * Casilla de sí/no de la lista. Un ✓ verde y un — apagado, no dos iconos que
 * griten igual: en una tabla de 1.200 filas lo que hace falta es distinguir de
 * un vistazo lo que ESTÁ puesto, no leer cruz por cruz.
 */
function Casilla({ si }: Readonly<{ si: boolean }>) {
  return (
    <td className="px-2.5 py-2 text-center">
      {si
        ? <Check size={15} className="mx-auto text-mint" strokeWidth={3} />
        : <span className="text-muted/50">—</span>}
    </td>
  );
}

/** El texto de un fallo, venga como venga (el nodo lanza Error; la red, cualquier cosa). */
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");

function Aviso({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="flex flex-none items-center gap-2.5 rounded-[6px] border border-brand-lit/25 bg-accent-soft px-3.5 py-3 text-[13px] font-semibold leading-snug text-brand-lit">
      <Info size={18} className="flex-none" />
      {children}
    </p>
  );
}

export function Productos({ onSalir }: Readonly<{ onSalir: () => void }>) {
  const [articulos, setArticulos] = useState<Articulo[]>(ARTICULOS_DEMO);
  // El artículo abierto VIVE EN LA URL: `/config/productos/<id>`. Así se manda
  // por chat «mira este», el Atrás del navegador recorre lo que has mirado, y
  // recargar te deja donde estabas en vez de en el primero de la lista.
  const ruta = useRuta();
  const [borrador, setBorrador] = useState<Articulo | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [pestana, setPestana] = useState("Ficha");
  const [sub, setSub] = useState<Sub>("Datos generales");
  const [q, setQ] = useState("");
  const [fmtSel, setFmtSel] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const [params, setParams] = useState(false);   // ventana «Parámetros del artículo»
  const [aspecto, setAspecto] = useState(false); // ventana «Aspecto en el TPV»
  const [buscaFam, setBuscaFam] = useState(false);
  // `real` = los datos salen del nodo. Si no, la pantalla enseña el catálogo de
  // ejemplo y LO DICE: datos fingidos vendidos como reales es peor que nada.
  const [real, setReal] = useState(false);
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  // Las familias son ESTADO, no constante: desde el buscador se pueden crear sin
  // abandonar el artículo que estás dando de alta.
  const [familias, setFamilias] = useState(FAMILIAS.map((f, i) => ({ ...f, codigo: String(i + 1) })));

  // El catálogo del bar, si este terminal está emparejado. `null` (sin nodo, sin
  // sesión o red caída) deja la demo puesta, que es más útil que una tabla vacía.
  useEffect(() => {
    let vivo = true;
    void cargarCatalogo().then((c) => {
      if (!vivo || !c) return;
      setArticulos(c.articulos);
      setFamilias(c.familias);
      setReal(true);
    });
    return () => { vivo = false; };
  }, []);

  // Un id que ya no existe (artículo borrado, enlace viejo, o la demo cambiada
  // por la carta real) no deja la pantalla en blanco: cae al primero.
  const enUrl = ruta.id ? articulos.findIndex((a) => a.id === ruta.id) : -1;
  const idx = Math.max(enUrl, 0);
  const abrirArticulo = (id?: string) =>
    navegar({ vista: "config", seccion: "productos", ...(id ? { id } : {}) }, true);

  const nombreDeFamilia = (id: string) => familias.find((f) => f.id === id)?.nombre ?? id;
  const codigoDeFamilia = (id: string) => familias.find((f) => f.id === id)?.codigo ?? "";
  const colorDeFamilia = (id: string) => familias.find((f) => f.id === id)?.color ?? "#64748b";

  const crearFamilia = (nombre: string) => {
    const id = crypto.randomUUID();
    const codigo = String(familias.length + 1);
    setFamilias((fs) => [...fs, { id, nombre, codigo, color: "#64748b" }]);
    if (real) {
      void crearFamiliaEnNodo(id, nombre, familias.length + 1)
        .then(() => notificar(`Familia «${nombre}» creada.`))
        .catch((e: unknown) => notificar(`No se ha podido crear la familia: ${mensaje(e)}`));
    } else {
      notificar(`Familia «${nombre}» creada.`);
    }
    return id;
  };
  const [aviso, setAviso] = useState("");
  const temporizador = useRef<number | undefined>(undefined);

  const editando = borrador !== null;
  const art = borrador ?? articulos[idx];

  const lista = useMemo(() => {
    const nq = norm(q.trim());
    if (!nq) return articulos;
    return articulos.filter((a) =>
      norm(`${a.codigo} ${a.nombre} ${nombreDeFamilia(a.familia)} ${a.barras}`).includes(nq));
    // `familias` entra porque el nombre de la familia se busca también.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articulos, q, familias]);

  // Un solo temporizador vivo: si no, el de un aviso anterior borraba el nuevo
  // antes de tiempo (guardar dos veces seguidas y el segundo "OK" no se leía).
  const notificar = (t: string) => {
    setAviso(t);
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAviso(""), 2400);
  };

  // Toda edición pasa por aquí: el borrador es la única copia mutable.
  const set = <K extends keyof Articulo>(campo: K, valor: Articulo[K]) =>
    setBorrador((b) => (b ? { ...b, [campo]: valor } : b));

  // Los parámetros son sí/no. `vendible` y `alPeso` se reflejan además en los
  // atajos de la ficha (la lista y los interruptores de Datos generales), para
  // que no haya dos verdades sobre lo mismo.
  const setParam = (campo: keyof ParametrosArticulo, valor: boolean) =>
    setBorrador((b) => {
      if (!b) return b;
      const parametros = { ...b.parametros, [campo]: valor };
      return {
        ...b,
        parametros,
        visible: campo === "vendible" ? valor : b.visible,
        alPeso: campo === "alPeso" ? valor : b.alPeso,
      };
    });

  const setFormato = (id: string, campo: keyof FormatoVenta, valor: FormatoVenta[keyof FormatoVenta]) =>
    setBorrador((b) => b ? { ...b, formatos: b.formatos.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) } : b);

  const alternar = (campo: "categorias" | "alergenos", v: string) =>
    setBorrador((b) => b ? {
      ...b,
      [campo]: b[campo].includes(v) ? b[campo].filter((x) => x !== v) : [...b[campo], v],
    } : b);

  const irA = (i: number) => {
    abrirArticulo(articulos[Math.max(0, Math.min(articulos.length - 1, i))]?.id);
    setFmtSel(null);
  };

  const modificar = () => { if (art) setBorrador(structuredClone(art)); };

  const crear = () => {
    const codigo = String(siguienteNumero(articulos.map((a) => Number(a.codigo) || 0))).padStart(4, "0");
    setNuevo(true);
    setBorrador({
      // UUID: `product.id` lo es en la BD, y un `art-0007` reventaría el alta.
      id: crypto.randomUUID(), codigo, nombre: "", nombreComanda: "", nombreTicket: "",
      familia: FAMILIAS[0]?.id ?? "", impuesto: 10, barras: "", visible: true, alPeso: false,
      parametros: { ...PARAMETROS_POR_DEFECTO },
      estacion: "BARRA", tiempoPrep: 1, alergenos: [], categorias: [],
      formatos: [{
        id: crypto.randomUUID(), codigo: `${codigo}.1`, nombre: "Unidad",
        barra: 0, salon: 0, terraza: 0, barras: "", combinado: false,
        modificable: false, raciones: 1, coste: 0,
      }],
      comentarios: [], extras: [],
    });
    setPestana("Ficha");
    setSub("Datos generales");
  };

  const guardar = () => {
    if (!borrador || guardando) return;
    if (!borrador.nombre.trim()) { notificar("El artículo necesita una descripción."); return; }
    void aplicar(borrador, nuevo);
  };

  /**
   * La ficha ENTERA en un paso: primero la foto (si es nueva), después la fila.
   *
   * La foto se sube AQUÍ y no al elegirla: si se subiera al elegirla, cancelar
   * la ficha dejaría la imagen tirada en el disco del nodo para siempre.
   */
  const aplicar = async (ficha: Articulo, esNuevo: boolean) => {
    setGuardando(true);
    try {
      let listo = ficha;
      if (real && ficha.foto?.startsWith("data:")) {
        listo = { ...ficha, foto: await subirFotoArticulo(ficha.id, await (await fetch(ficha.foto)).blob()) };
      }
      if (real) await guardarArticulo(listo);

      setArticulos((as) => (esNuevo ? [...as, listo] : as.map((a) => (a.id === listo.id ? listo : a))));
      if (esNuevo) abrirArticulo(listo.id);
      setBorrador(null); setNuevo(false);
      notificar(esNuevo ? "Artículo creado." : "Cambios guardados.");
    } catch (e: unknown) {
      // El borrador se QUEDA: si el nodo falla, lo último que quiere el dueño es
      // volver a teclear la ficha entera.
      notificar(`No se ha guardado: ${mensaje(e)}`);
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = () => { setBorrador(null); setNuevo(false); notificar("Cambios descartados."); };

  const eliminar = () => {
    const victima = articulos[idx];
    setBorrar(false);
    if (!victima) return;
    const seguir = () => {
      setArticulos((as) => as.filter((a) => a.id !== victima.id));
      irA(idx > 0 ? idx - 1 : 0);
      setMarcados((m) => { const s = new Set(m); s.delete(victima.id); return s; });
      notificar("Artículo eliminado.");
    };
    if (!real) { seguir(); return; }
    void borrarArticulo(victima.id).then(seguir)
      .catch((e: unknown) => notificar(`No se ha podido eliminar: ${mensaje(e)}`));
  };

  /**
   * Duplica lo marcado en la Lista y, si no hay nada marcado, el artículo que
   * tienes delante — que es como funciona en Glop y evita el botón muerto de
   * "duplicar" mientras miras una ficha.
   */
  const duplicarMarcados = () => {
    const marcadosAhora = articulos.filter((a) => marcados.has(a.id));
    const origen = marcadosAhora.length > 0 ? marcadosAhora : (art ? [art] : []);
    if (origen.length === 0 || guardando) return;
    setGuardando(true);
    void (async () => {
      try {
        const copias: Articulo[] = [];
        // La serie avanza DENTRO del bucle: con el mismo `siguienteNumero` para
        // todas, duplicar tres artículos daba tres veces el mismo código.
        let enUso = articulos.map((a) => Number(a.codigo) || 0);
        for (const a of origen) {
          const n = siguienteNumero(enUso);
          enUso = [...enUso, n];
          const copia = duplicarArticulo(a, String(n).padStart(4, "0"));
          if (real) await guardarArticulo(copia);
          copias.push(copia);
        }
        setArticulos((as) => [...as, ...copias]);
        setMarcados(new Set());
        notificar(copias.length === 1 ? "Artículo duplicado." : `${copias.length} artículos duplicados.`);
      } catch (e: unknown) {
        notificar(`No se ha podido duplicar: ${mensaje(e)}`);
      } finally {
        setGuardando(false);
      }
    })();
  };

  const marcar = (id: string) =>
    setMarcados((m) => {
      const s = new Set(m);
      // `delete` devuelve false si no estaba: entonces es que toca marcarlo.
      if (!s.delete(id)) s.add(id);
      return s;
    });

  // Sin artículos no hay ficha que enseñar. Estado vacío CON salida: borrar el
  // último dejaba la pantalla en blanco y sin botón para volver.
  if (!art) {
    return (
      <MarcoMantenimiento
        pestanas={["Lista", "Ficha"]} pestana="Lista" onPestana={() => {}}
        pie={
          <>
            <BotonPie Icono={PlusCircle} tono="ok" onClick={crear}>Nuevo</BotonPie>
            <span className="flex-1" />
            <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir}>Salir</BotonPie>
          </>
        }
      >
        <Caja crecer>
          <p className="grid flex-1 place-items-center p-8 text-center text-sm text-muted">
            No queda ningún artículo. Pulsa «Nuevo» para crear el primero.
          </p>
        </Caja>
      </MarcoMantenimiento>
    );
  }

  const ro = !editando; // solo lectura mientras no se pulse «Modificar»

  // ── Barra inferior: el corazón del patrón (consulta ⇄ edición) ──
  const pie = (
    <>
      <BotonPie Icono={ChevronsLeft} onClick={() => irA(0)} disabled={editando || idx === 0}>Inicio</BotonPie>
      <BotonPie Icono={ChevronLeft} onClick={() => irA(idx - 1)} disabled={editando || idx === 0}>Anterior</BotonPie>
      <BotonPie Icono={ChevronRight} onClick={() => irA(idx + 1)} disabled={editando || idx >= articulos.length - 1}>Siguiente</BotonPie>
      <BotonPie Icono={ChevronsRight} onClick={() => irA(articulos.length - 1)} disabled={editando || idx >= articulos.length - 1}>Fin</BotonPie>
      <SepPie />
      <BotonPie Icono={PlusCircle} tono="ok" onClick={crear} disabled={editando}>Nuevo</BotonPie>
      {/* Duplicar va junto a Nuevo porque ES un alta: la de quien da de alta
          ocho vinos que solo cambian en el nombre y el precio. */}
      <BotonPie Icono={Copy} onClick={duplicarMarcados} disabled={editando || guardando}>
        {marcados.size > 1 ? `Duplicar (${marcados.size})` : "Duplicar"}
      </BotonPie>
      <BotonPie Icono={Pencil} onClick={modificar} disabled={editando}>Modificar</BotonPie>
      <BotonPie Icono={MinusCircle} tono="no" onClick={() => setBorrar(true)} disabled={editando || articulos.length === 0}>Eliminar</BotonPie>
      <SepPie />
      <BotonPie Icono={CheckCircle2} tono="ok" onClick={guardar} disabled={!editando}>Aceptar</BotonPie>
      <BotonPie Icono={XCircle} tono="no" onClick={cancelar} disabled={!editando}>Cancelar</BotonPie>
      <span className="flex-1" />
      {aviso && <span className="rounded-full bg-paper px-4 py-2 text-[12.5px] font-bold text-ink">{aviso}</span>}
      <BotonPie Icono={Keyboard} onClick={abrirTeclado}>Teclado</BotonPie>
      <EstadoPie editando={editando}>
        {editando
          ? `${nuevo ? "Nuevo artículo" : "Editando"} · ${art.codigo}`
          : `Consulta · artículo ${idx + 1} de ${articulos.length}`}
      </EstadoPie>
      <SepPie />
      <BotonPie Icono={LogOut} tono="neutro" onClick={onSalir} disabled={editando}>Salir</BotonPie>
    </>
  );

  return (
    <>
      <MarcoMantenimiento
        pestanas={["Lista", "Ficha"]}
        pestana={pestana}
        onPestana={(p) => { if (!editando || p === "Ficha") setPestana(p); }}
        subpestanas={pestana === "Ficha" ? [...SUBS] : undefined}
        subpestana={sub}
        onSubpestana={(s) => setSub(s as Sub)}
        pie={pie}
      >
        {pestana === "Lista" && (
          <Caja crecer>
            <div className="flex flex-none items-center gap-2 border-b border-line p-2.5">
              <div className="relative min-w-0 flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por descripción, código de barras o familia…"
                  className={claseEntrada(false, "w-full pl-9.5")} />
              </div>
              {!real && (
                <span className="flex-none rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-[11.5px] font-bold text-amber">
                  Carta de ejemplo · terminal sin emparejar
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:bg-ink-2 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-left [&>th]:text-[10.5px] [&>th]:font-extrabold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-paper/70">
                    <th className="w-11 text-center!">
                      {/* Marcar todo lo que se está VIENDO (lo filtrado), no los
                          1.200 del bar: nadie quiere duplicar la carta entera
                          por pulsar una casilla. */}
                      <input type="checkbox" aria-label="Marcar todo lo que se ve"
                        checked={lista.length > 0 && lista.every((a) => marcados.has(a.id))}
                        onChange={(e) => setMarcados(e.target.checked ? new Set(lista.map((a) => a.id)) : new Set())}
                        className="h-4.5 w-4.5 accent-(--brand)" />
                    </th>
                    <th className="w-20">Código</th>
                    <th className="w-34">C. barras</th>
                    <th>Descripción</th><th>Familia</th>
                    <th className="text-right!">Barra</th><th className="text-right!">Salón</th>
                    <th className="text-right!">Coste</th><th className="text-right!">Margen</th>
                    <th className="text-center!">Imp.</th>
                    {/* Las cuatro casillas de Glop. Aquí se MIRAN, no se tocan: se
                        cambian en la ficha, que es donde se ve qué hace cada una. */}
                    <th className="text-center!">Vendible</th>
                    <th className="text-center!">Stock</th>
                    <th className="text-center!">Ecom</th>
                    <th className="text-center!">Carta QR</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => {
                    const f = a.formatos[0];
                    const m = f ? margen(f, a.impuesto) : 0;
                    const sel = a.id === art.id;
                    return (
                      <tr key={a.id} aria-selected={sel}
                        onClick={() => { abrirArticulo(a.id); setPestana("Ficha"); setFmtSel(null); }}
                        className={`cursor-pointer border-b border-line text-[13.5px] ${sel ? "bg-accent-soft" : ""}`}>
                        {/* `stopPropagation`: la fila entera navega a la ficha, y
                            marcar la casilla no debe llevarte a otra pantalla. */}
                        <td className="px-2.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={marcados.has(a.id)} onChange={() => marcar(a.id)}
                            aria-label={`Marcar ${a.nombre}`}
                            className="h-4.5 w-4.5 accent-(--brand)" />
                        </td>
                        <td className="px-2.5 py-2 font-mono text-[13px] text-muted">{a.codigo}</td>
                        <td className="px-2.5 py-2 font-mono text-[12.5px] text-muted">{a.barras || "—"}</td>
                        <td className="px-2.5 py-2 font-semibold">{a.nombre}</td>
                        <td className="px-2.5 py-2">
                          <span className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[11px] font-bold">{nombreDeFamilia(a.familia)}</span>
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono">{f ? eur(f.barra) : "—"}</td>
                        <td className="px-2.5 py-2 text-right font-mono">{f ? eur(f.salon) : "—"}</td>
                        <td className="px-2.5 py-2 text-right font-mono text-muted">{f ? eur(f.coste) : "—"}</td>
                        <td className={`px-2.5 py-2 text-right font-mono font-extrabold ${m < 55 ? "text-danger" : "text-mint"}`}>
                          {m.toFixed(0)} %
                        </td>
                        <td className="px-2.5 py-2 text-center font-mono text-muted">{a.impuesto} %</td>
                        <Casilla si={a.visible} />
                        <Casilla si={a.parametros.controlaStock} />
                        <Casilla si={a.parametros.eCommerce} />
                        <Casilla si={a.parametros.cartaDigital} />
                      </tr>
                    );
                  })}
                  {lista.length === 0 && (
                    <tr><td colSpan={14} className="px-4 py-8 text-center text-sm text-muted">Ningún artículo se llama «{q.trim()}».</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Caja>
        )}

        {pestana === "Ficha" && sub === "Datos generales" && (
          <>
            <Caja>
              <div className="grid gap-3.5 p-3.5 lg:grid-cols-[1fr_1fr_170px]">
                <div>
                  <Campo etiqueta="Código y descripción" htmlFor="a-ds">
                    <div className="flex gap-1.5">
                      <input value={art.codigo} readOnly className={claseEntrada(true, "w-20 flex-none text-center font-mono")} />
                      <input id="a-ds" value={art.nombre} readOnly={ro} placeholder="Descripción del artículo"
                        onChange={(e) => set("nombre", e.target.value)} className={claseEntrada(ro, "min-w-0 flex-1")} />
                    </div>
                  </Campo>
                  {/* Como en Glop: código + descripción en solo lectura y la
                      LUPA, que además deja crear la familia sin salir de aquí. */}
                  <Campo etiqueta="Familia de venta" htmlFor="a-fam">
                    <div className="flex gap-1.5">
                      <input value={codigoDeFamilia(art.familia)} readOnly
                        className={claseEntrada(true, "w-16 flex-none text-center font-mono")} />
                      <input id="a-fam" value={nombreDeFamilia(art.familia)} readOnly
                        placeholder="Sin familia" className={claseEntrada(true, "min-w-0 flex-1")} />
                      <button type="button" disabled={ro} onClick={() => setBuscaFam(true)}
                        aria-label="Buscar familia de venta"
                        className="grid min-h-11 w-11 flex-none place-items-center rounded-[5px] border border-line bg-panel text-brand-lit transition-transform active:scale-95 disabled:opacity-40">
                        <Search size={16} />
                      </button>
                    </div>
                  </Campo>
                  <Campo etiqueta="Descripción para pedidos y comanda" htmlFor="a-cmd">
                    <input id="a-cmd" value={art.nombreComanda} readOnly={ro}
                      onChange={(e) => set("nombreComanda", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                </div>

                <div>
                  <Campo etiqueta="Impuesto de venta (incluido en el precio)" htmlFor="a-imp">
                    <Selector id="a-imp" value={art.impuesto} disabled={ro} onChange={(v) => set("impuesto", Number(v))}>
                      {IMPUESTOS.map((i) => <option key={i.valor} value={i.valor}>{i.texto}</option>)}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Código de barras" htmlFor="a-bar">
                    <input id="a-bar" value={art.barras} readOnly={ro} inputMode="numeric"
                      onChange={(e) => set("barras", e.target.value)} className={claseEntrada(ro, "font-mono")} />
                  </Campo>
                  <Campo etiqueta="Se vende al peso">
                    <Interruptor activo={art.alPeso} disabled={ro} etiqueta={art.alPeso ? "Sí, por kilos" : "No, por unidades"}
                      onToggle={() => setParam("alPeso", !art.alPeso)} />
                  </Campo>
                </div>

                <div className="flex flex-col gap-1.5">
                  {/* La muestra es el botón REAL del TPV, no un dibujo parecido:
                      el mismo componente que pinta la botonera de venta. */}
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[6px] border border-line bg-panel-2 p-3">
                    <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">Así se verá en el TPV</span>
                    <div className="w-32">
                      <BotonProducto comoPrevia nombre={art.nombre || "Sin nombre"}
                        precio={art.formatos[0]?.barra ?? 0}
                        color={art.color ?? colorDeFamilia(art.familia)} foto={art.foto} icono={art.icono} />
                    </div>
                    <button type="button" disabled={ro} onClick={() => setAspecto(true)}
                      className="flex min-h-10 items-center gap-2 rounded-[5px] border border-mint/40 bg-mint/10 px-3 text-[12px] font-semibold text-mint transition-transform active:scale-95 disabled:opacity-35">
                      <Camera size={15} /> Foto, color e icono
                    </button>
                  </div>
                  <Interruptor activo={art.visible} disabled={ro} etiqueta="Visible en TPV"
                    onToggle={() => setParam("vendible", !art.visible)} />
                  {/* Como en Glop: el comportamiento del artículo vive en su
                      propia ventana, que si no la ficha se hace ilegible. */}
                  <button type="button" onClick={() => setParams(true)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-line bg-panel px-3 text-[12.5px] font-medium text-paper/85 transition-transform active:scale-[.98]">
                    <SlidersHorizontal size={15} /> Parámetros del artículo
                  </button>
                </div>
              </div>
            </Caja>

            <Caja crecer titulo="Formatos de venta" contador={`${art.formatos.length} formatos`}>
              {real && (
                <p className="flex flex-none items-center gap-2 border-b border-line bg-amber/8 px-3.5 py-2 text-[12px] font-semibold text-amber">
                  <Info size={15} className="flex-none" />
                  De momento se guarda el precio de <b>Barra</b>. Salón y Terraza son otra
                  tarifa, y las tarifas todavía no están hechas: no las des por guardadas.
                </p>
              )}
              <div className="min-h-0 flex-1 overflow-auto border-t border-line">
                <table className="w-full min-w-[980px] border-collapse">
                  {/* Anchos FIJOS en las numéricas: si no, la tabla reparte su
                      ancho mínimo entre todas y un precio de 4 caracteres acaba
                      en una caja de 150px. La flexible es «Formato». */}
                  <thead>
                    <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:border-b [&>th]:border-line [&>th]:bg-panel [&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
                      <th className="w-20">Código</th><th className="min-w-45">Formato</th>
                      <th className="w-26 text-right!">Barra</th><th className="w-26 text-right!">Salón</th><th className="w-26 text-right!">Terraza</th>
                      <th className="w-24 text-center!">Combinado</th><th className="w-24 text-right!">Raciones</th>
                      <th className="w-24 text-right!">Coste</th><th className="w-20 text-right!">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {art.formatos.map((f) => {
                      const m = margen(f, art.impuesto);
                      const sel = f.id === fmtSel;
                      return (
                        <tr key={f.id} aria-selected={sel} onClick={() => setFmtSel(f.id)}
                          className={`cursor-pointer border-b border-line ${sel ? "bg-accent-soft" : ""}`}>
                          <td className="px-2.5 py-1 font-mono text-[13px] text-muted">{f.codigo}</td>
                          <td className="px-1.5 py-1">
                            <input value={f.nombre} readOnly={ro} onChange={(e) => setFormato(f.id, "nombre", e.target.value)}
                              className={claseEntrada(ro, "", true)} />
                          </td>
                          {(["barra", "salon", "terraza"] as const).map((sala) => (
                            <td key={sala} className="px-1.5 py-1">
                              <input type="number" step="0.05" min="0" value={f[sala]} readOnly={ro}
                                onChange={(e) => setFormato(f.id, sala, Number(e.target.value))}
                                className={claseEntrada(ro, "text-right font-mono", true)} />
                            </td>
                          ))}
                          <td className="px-2.5 py-1 text-center">
                            <button type="button" disabled={ro} aria-pressed={f.combinado}
                              onClick={() => setFormato(f.id, "combinado", !f.combinado)}
                              className={`grid h-6.5 w-6.5 place-items-center rounded border-2 transition-transform active:scale-90 disabled:opacity-50 ${
                                f.combinado ? "border-mint bg-mint text-white" : "border-line bg-panel-2"
                              }`}>
                              {f.combinado && <Check size={14} strokeWidth={3.2} />}
                            </button>
                          </td>
                          <td className="px-1.5 py-1">
                            <input type="number" step="0.5" min="0" value={f.raciones} readOnly={ro}
                              onChange={(e) => setFormato(f.id, "raciones", Number(e.target.value))}
                              className={claseEntrada(ro, "text-right font-mono", true)} />
                          </td>
                          <td className="px-1.5 py-1">
                            <input type="number" step="0.01" min="0" value={f.coste} readOnly={ro}
                              onChange={(e) => setFormato(f.id, "coste", Number(e.target.value))}
                              className={claseEntrada(ro, "text-right font-mono", true)} />
                          </td>
                          <td className={`px-2.5 py-1 text-right font-mono text-[13px] font-semibold ${m < 55 ? "text-danger" : "text-mint"}`}>
                            {m.toFixed(0)} %
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-none items-center gap-1.5 border-t border-line bg-panel-2 px-2.5 py-2">
                <button type="button" disabled={ro} aria-label="Añadir formato"
                  onClick={() => setBorrador((b) => {
                    if (!b) return b;
                    const n = siguienteNumero(b.formatos.map((f) => Number(f.codigo.split(".")[1]) || 0));
                    return { ...b, formatos: [...b.formatos, {
                      id: crypto.randomUUID(), codigo: `${b.codigo}.${n}`, nombre: "Nuevo formato",
                      barra: 0, salon: 0, terraza: 0, barras: "", combinado: false,
                      modificable: false, raciones: 1, coste: 0,
                    }] };
                  })}
                  className="grid h-11 w-13 place-items-center rounded-[5px] bg-mint text-[24px] font-extrabold text-white transition-transform active:scale-95 disabled:bg-paper/15 disabled:text-muted">
                  <Plus size={22} strokeWidth={3} />
                </button>
                <button type="button" disabled={ro || !fmtSel || art.formatos.length <= 1} aria-label="Quitar el formato seleccionado"
                  onClick={() => { setBorrador((b) => b ? { ...b, formatos: b.formatos.filter((f) => f.id !== fmtSel) } : b); setFmtSel(null); }}
                  className="grid h-11 w-13 place-items-center rounded-[5px] bg-danger text-white transition-transform active:scale-95 disabled:bg-paper/15 disabled:text-muted">
                  <X size={22} strokeWidth={3} />
                </button>
                <span className="ml-auto text-[12px] text-muted">
                  {ro ? "Pulsa «Modificar» abajo para poder tocar los precios." : "Los precios llevan el impuesto incluido."}
                </span>
              </div>
            </Caja>
          </>
        )}

        {pestana === "Ficha" && sub === "Comentarios y extras" && (
          <>
            <Aviso>
              Esto es lo que verá el camarero al vender el artículo. Un extra a 0,00 € no cobra
              nada: solo sale impreso en la comanda.
            </Aviso>
            <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-2">
              <Caja crecer titulo="Grupos de comentarios" contador={art.comentarios.length}>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-2.5">
                  {art.comentarios.map((g) => (
                    <div key={g.id} className="flex items-center gap-2.5 rounded-[6px] border border-line bg-panel-2 px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px] font-bold">{g.nombre}</b>
                        <span className="block truncate text-[11.5px] text-muted">{g.opciones.join(" · ")}</span>
                      </span>
                      <button type="button" disabled={ro} aria-label={`Quitar ${g.nombre}`}
                        onClick={() => set("comentarios", art.comentarios.filter((x) => x.id !== g.id))}
                        className="grid h-9.5 w-9.5 flex-none place-items-center rounded-[5px] border border-line text-danger transition-transform active:scale-90 disabled:opacity-35">
                        <X size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  ))}
                  {art.comentarios.length === 0 && (
                    <p className="px-1 py-4 text-[13px] text-muted">Sin grupos de comentarios.</p>
                  )}
                </div>
                <button type="button" disabled={ro}
                  className="m-2.5 flex min-h-11.5 items-center justify-center gap-2 rounded-[6px] border border-dashed border-brand-lit text-[13.5px] font-bold text-brand-lit transition-transform active:scale-[.98] disabled:opacity-35">
                  <Plus size={16} /> Añadir grupo de comentarios
                </button>
              </Caja>

              <Caja crecer titulo="Ingredientes extra" contador={art.extras.length}>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-2.5">
                  {art.extras.map((x) => (
                    <div key={x.id} className="flex items-center gap-2.5 rounded-[6px] border border-line bg-panel-2 px-3 py-2.5">
                      <b className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{x.nombre}</b>
                      <span className={`min-w-[76px] text-right font-mono text-[13px] font-extrabold ${x.precio > 0 ? "text-cobro" : "text-mint"}`}>
                        {x.precio > 0 ? eur(x.precio) : "Gratis"}
                      </span>
                      <button type="button" disabled={ro} aria-label={`Quitar ${x.nombre}`}
                        onClick={() => set("extras", art.extras.filter((e) => e.id !== x.id))}
                        className="grid h-9.5 w-9.5 flex-none place-items-center rounded-[5px] border border-line text-danger transition-transform active:scale-90 disabled:opacity-35">
                        <X size={16} strokeWidth={2.6} />
                      </button>
                    </div>
                  ))}
                  {art.extras.length === 0 && (
                    <p className="px-1 py-4 text-[13px] text-muted">Sin ingredientes extra.</p>
                  )}
                </div>
                <button type="button" disabled={ro}
                  className="m-2.5 flex min-h-11.5 items-center justify-center gap-2 rounded-[6px] border border-dashed border-brand-lit text-[13.5px] font-bold text-brand-lit transition-transform active:scale-[.98] disabled:opacity-35">
                  <Plus size={16} /> Añadir ingrediente extra
                </button>
              </Caja>
            </div>
          </>
        )}

        {pestana === "Ficha" && sub === "Categorías" && (
          <>
            <Aviso>Un artículo puede estar en varias categorías a la vez: la familia decide dónde vive, las categorías dónde aparece.</Aviso>
            <Caja crecer titulo="Categorías donde aparece" contador={art.categorias.length}>
              <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
                <div className="flex flex-wrap gap-2">
                  {familias.map((c) => (
                    <ChipSel key={c.id} texto={c.nombre} disabled={ro}
                      activo={art.categorias.includes(c.id)} onToggle={() => alternar("categorias", c.id)} />
                  ))}
                </div>
              </div>
            </Caja>
          </>
        )}

        {pestana === "Ficha" && sub === "Cocina y ticket" && (
          <Caja crecer>
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
              <div className="grid gap-3.5 lg:grid-cols-2">
                <div>
                  <Campo etiqueta="Nombre en el ticket del cliente" htmlFor="a-tk">
                    <input id="a-tk" value={art.nombreTicket} readOnly={ro}
                      onChange={(e) => set("nombreTicket", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                  <Campo etiqueta="Nombre en la comanda de cocina" htmlFor="a-ck">
                    <input id="a-ck" value={art.nombreComanda} readOnly={ro}
                      onChange={(e) => set("nombreComanda", e.target.value)} className={claseEntrada(ro)} />
                  </Campo>
                </div>
                <div>
                  <Campo etiqueta="Estación de preparación" htmlFor="a-est">
                    <Selector id="a-est" value={art.estacion} disabled={ro} onChange={(v) => set("estacion", v as Estacion)}>
                      {ESTACIONES.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
                    </Selector>
                  </Campo>
                  <Campo etiqueta="Tiempo de preparación (minutos)" htmlFor="a-tp">
                    <input id="a-tp" type="number" min="0" step="1" value={art.tiempoPrep} readOnly={ro}
                      onChange={(e) => set("tiempoPrep", Number(e.target.value))} className={claseEntrada(ro, "font-mono")} />
                  </Campo>
                </div>
              </div>
              <p className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-[.14em] text-muted">
                Alérgenos declarados ({art.alergenos.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {ALERGENOS.map((a) => (
                  <ChipSel key={a} texto={a} disabled={ro}
                    activo={art.alergenos.includes(a)} onToggle={() => alternar("alergenos", a)} />
                ))}
              </div>
            </div>
          </Caja>
        )}
      </MarcoMantenimiento>

      {buscaFam && (
        <BuscadorRegistros
          titulo="Familias"
          registros={familias}
          seleccionado={art.familia}
          etiquetaNuevo="Nueva familia"
          onCrear={crearFamilia}
          onAceptar={(id) => set("familia", id)}
          onCerrar={() => setBuscaFam(false)}
        />
      )}

      {aspecto && (
        <AspectoArticulo
          nombre={art.nombre} precio={art.formatos[0]?.barra ?? 0}
          colorFamilia={colorDeFamilia(art.familia)}
          foto={art.foto} color={art.color} icono={art.icono}
          onCambiar={(campo, valor) => set(campo, valor)}
          onCerrar={() => setAspecto(false)}
        />
      )}

      {params && (
        <Modal onCerrar={() => setParams(false)} ancho="xl">
          <CabeceraModal Icono={SlidersHorizontal} titulo="Parámetros del artículo"
            subtitulo={`${art.codigo} · ${art.nombre || "Sin descripción"}`} onCerrar={() => setParams(false)} />
          <div className="max-h-[70vh] overflow-y-auto p-4">
            {ro && (
              <p className="mb-3 rounded-[5px] border border-line bg-paper/3 px-3 py-2 text-[12.5px] text-muted">
                En consulta no se puede cambiar nada. Cierra y pulsa «Modificar» abajo.
              </p>
            )}
            {GRUPOS_PARAMETROS.map((g) => (
              <div key={g.titulo} className="mb-4 last:mb-0">
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.titulo}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.campos.map(({ clave, texto, ayuda }) => {
                    const activo = art.parametros[clave];
                    return (
                      <button key={clave} type="button" disabled={ro} onClick={() => setParam(clave, !activo)}
                        className={`flex min-h-12 items-start gap-2.5 rounded-[5px] border p-2.5 text-left transition-transform active:scale-[.99] disabled:opacity-60 ${
                          activo ? "border-brand-lit bg-accent-soft" : "border-line bg-panel"
                        }`}>
                        <span className={`mt-px grid h-5 w-5 flex-none place-items-center rounded border-2 ${
                          activo ? "border-brand bg-brand text-white" : "border-line"
                        }`}>
                          {activo && <Check size={13} strokeWidth={3.2} />}
                        </span>
                        <span className="min-w-0">
                          <b className="block text-[13px] font-semibold">{texto}</b>
                          <span className="block text-[11.5px] leading-snug text-muted">{ayuda}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {borrar && (
        <Modal onCerrar={() => setBorrar(false)} ancho="sm">
          <CabeceraModal Icono={MinusCircle} titulo="Eliminar artículo" subtitulo={art.nombre} onCerrar={() => setBorrar(false)} />
          <div className="p-4">
            <p className="text-[14px] leading-relaxed text-paper/80">
              Se borra <b>{art.nombre}</b> con sus {art.formatos.length} formatos. Los tickets ya
              cobrados no cambian.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setBorrar(false)}
                className="min-h-12 flex-1 rounded-[5px] border border-line bg-panel-2 text-[14.5px] font-bold transition-transform active:scale-[.98]">
                Cancelar
              </button>
              <button type="button" onClick={eliminar}
                className="min-h-12 flex-1 rounded-[5px] bg-danger text-[14.5px] font-bold text-white transition-transform active:scale-[.98]">
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
