"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { 
  Trash2, Sun, Store, Armchair, ShoppingBag, CalendarCheck,
  ZoomIn, ZoomOut, RefreshCw, X, Pencil, Trash, Copy, RotateCw, Plus, Minus, Receipt, LayoutGrid
} from "lucide-react";
import { PlanoSvg } from "@/components/plano-svg";
import { RailSalas, type RailTab } from "./RailSalas";
import { ASSETS, ASSETS_LEGACY, FORMAS_MESA, assetPorId, mesaPorCapacidad, dim, type PlanoAsset, PLANO_VER } from "../../lib/plano-assets";
import { toast } from "@/app/lib/toast";
import { eur } from "@/app/lib/money";
import { useConfirmar } from "@/components/dialogo-confirmar";

export interface Mesa {
  id: string;
  nombre: string;
  estado: string;
  room_id: string | null;
  pos_x: number | null;
  pos_y: number | null;
  capacidad: number;
  rotacion: number;
  sprite?: string | null;
  color?: string | null;
}

export interface Room {
  id: string;
  nombre: string;
  orden: number;
  suelo: string | null;
}

export interface Reserva {
  id: string;
  table_id: string | null;
  fecha_hora: string;
  comensales: number;
  estado: string;
  notas: string | null;
  nombre: string | null;
}

export interface Elemento {
  id: string;
  room_id: string;
  tipo: string;
  etiqueta: string | null;
  icono: string | null;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  rotacion: number;
  color?: string | null;
}

export interface PlanoSalasProps {
  sb: any;
  operario: { id: string; nombre: string };
  mesas: Mesa[];
  rooms: Room[];
  elementos: Elemento[];
  reservas: Reserva[];
  totalesMesa: Record<string, number>;
  aparcados: any[];
  aparcadosLineas: Record<string, any[]>;
  llevarList: any[];
  recuperarAparcado: (o: any) => void;
  nuevoParaLlevar: (nombre: string, telefono: string) => void;
  abrirLlevar: (o: any) => void;
  irASala: (dest: { tipo: "ticket" | "barra" | "room" | "llevar"; id?: string }) => void;
  vistaSala: string;
  recargarMesas: () => Promise<void>;
  setMesas: React.Dispatch<React.SetStateAction<Mesa[]>>;
  recargarElementos: () => Promise<void>;
  setElementos: React.Dispatch<React.SetStateAction<Elemento[]>>;
  recargarReservas: () => Promise<void>;
  abrirMesa: (m: Mesa) => Promise<void>;
  cobrarMesa: (m: Mesa) => void;
  dividirMesa: (m: Mesa) => void;
  iniciarTraspaso: (m: Mesa, tipo: "MESA" | "LINEAS") => void;
  cancelarTraspaso: () => void;
  ejecutarTraspaso: (destino: Mesa) => Promise<void>;
  reimprimirCocinaMesa: (m: Mesa) => void;
  imprimirCuentaMesa: (m: Mesa) => void;
  marca: any;
  ultimoDoc: any;
  reprimirUltimo: () => void;
  abrirCajonManual: () => void;
  modoTraspaso: "MESA" | "LINEAS" | null;
  comanda: Record<string, number>;
  /** Nombre real de una línea a partir de su CLAVE (con formato y extras). */
  nombreLinea: (clave: string) => string;
  traspLineas: Record<string, number>;
  setTraspLineas: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  prods: any[];
  busy: boolean;
  setModalUtilidades: (v: boolean) => void;
  reservasPorMesa: Record<string, Reserva[]>;
  locationId: string | null;
  renderVelo: () => React.ReactNode;
  puede: (k: string) => boolean;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

type PestanaPaleta = "MESAS" | "ESTRUCTURA" | "DECORACION";

function esEstructuralElemento(e: Pick<Elemento, "tipo" | "icono">): boolean {
  return e.tipo === "BARRA" || e.tipo === "PARED" || /^(barra|muro|separador|toldo)/i.test(e.icono ?? "");
}

function esAssetEstructural(a: PlanoAsset): boolean {
  return a.tipo === "barra" || a.id === "toldo" || a.id === "separador" || a.id.startsWith("muro") || a.tipo === "abertura";
}

export function PlanoSalas({
  sb,
  operario,
  mesas,
  rooms,
  elementos,
  reservas,
  totalesMesa,
  aparcados,
  aparcadosLineas,
  llevarList,
  recuperarAparcado,
  nuevoParaLlevar,
  abrirLlevar,
  irASala,
  vistaSala,
  recargarMesas,
  setMesas,
  recargarElementos,
  setElementos,
  recargarReservas,
  abrirMesa,
  cobrarMesa,
  dividirMesa,
  iniciarTraspaso,
  cancelarTraspaso,
  ejecutarTraspaso,
  reimprimirCocinaMesa,
  imprimirCuentaMesa,
  marca,
  ultimoDoc,
  reprimirUltimo,
  abrirCajonManual,
  modoTraspaso,
  comanda,
  nombreLinea,
  traspLineas,
  setTraspLineas,
  prods,
  busy,
  setModalUtilidades,
  reservasPorMesa,
  locationId,
  renderVelo,
  puede,
}: PlanoSalasProps) {
  // --- Estados locales del plano ---
  const [editandoPlano, setEditandoPlano] = useState(false);
  const [posOverride, setPosOverride] = useState<Record<string, { x: number; y: number }>>({});
  const [mesaSel, setMesaSel] = useState<Mesa | null>(null);
  const [mesaSelInfo, setMesaSelInfo] = useState<{ apertura: string; importe: number; comensales: number | null; nota?: string; lineas: { nombre: string; cantidad: number; precio: number }[] } | null>(null);
  const [mesaEdit, setMesaEdit] = useState<Mesa | null>(null);
  const [numMesa, setNumMesa] = useState("");
  const [capMesa, setCapMesa] = useState(4);
  const [elemEdit, setElemEdit] = useState<Elemento | null>(null);
  const [paletaAbierta, setPaletaAbierta] = useState(true);
  const [paletaTab, setPaletaTab] = useState<PestanaPaleta>("MESAS");
  const [arrastrando, setArrastrando] = useState(false);
  const [sobrePapel, setSobrePapel] = useState(false);
  
  // Selección en modo edición y overrides locales
  const [selId, setSelId] = useState<string | null>(null);
  const [selTipo, setSelTipo] = useState<"mesa" | "elem" | null>(null);
  const { confirmar, dialogo } = useConfirmar();
  const [dimOverride, setDimOverride] = useState<Record<string, { w: number; h: number }>>({});
  const [rotOverride, setRotOverride] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ id: string; sx: number; sy: number; sw: number; sh: number } | null>(null);
  
  // Zoom & Pan
  const [planoScale, setPlanoScale] = useState(1);
  const panOffset = { x: 0, y: 0 };
  
  // Nuevos modales locales
  const [nuevoLlevarForm, setNuevoLlevarForm] = useState({ nombre: "", telefono: "" });
  const [reservaPop, setReservaPop] = useState<Mesa | null>(null);
  const [resForm, setResForm] = useState<{ id: string | null; nombre: string; personas: string; hora: string }>({ id: null, nombre: "", personas: "", hora: "" });
  const [modalNota, setModalNota] = useState(false);
  const [notaTexto, setNotaTexto] = useState("");
  const [notaOrderId, setNotaOrderId] = useState<string | null>(null);

  // Refs
  const papeleraRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const posOverrideRef = useRef<Record<string, { x: number; y: number }>>({});
  const planoBoxRef = useRef<HTMLDivElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  // --- Dimensiones y escalado automático (Fijo 4:3) ---
  const planoContent = useMemo(() => {
    return { w: 800, h: 600 };
  }, []);

  const autoScale = () => {
    const el = planoBoxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const s = Math.min(r.width / planoContent.w, r.height / planoContent.h);
    setPlanoScale(Math.max(0.5, Math.min(1.2, s)));
  };

  useEffect(() => {
    autoScale();
    const ro = new ResizeObserver(autoScale);
    if (planoBoxRef.current) ro.observe(planoBoxRef.current);
    return () => ro.disconnect();
  }, [planoContent, vistaSala]);

  // --- Atajos de teclado en el editor de plano ---
  useEffect(() => {
    if (!editandoPlano || !selId) return;

    const handleKeyDown = (ev: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (
        active.tagName === "INPUT" || 
        active.tagName === "TEXTAREA" || 
        active.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        if (selTipo === "mesa") {
          const m = mesas.find(x => x.id === selId);
          if (m) {
            void borrarMesaId(selId);
            setSelId(null);
            setSelTipo(null);
            toast.success("Mesa eliminada");
          }
        } else if (selTipo === "elem") {
          void borrarElemId(selId);
          setSelId(null);
          setSelTipo(null);
          toast.success("Elemento eliminado");
        }
      } else if (ev.key === " ") {
        ev.preventDefault();
        if (selTipo === "mesa") {
          const m = mesas.find(x => x.id === selId);
          if (m) {
            const currentRot = rotOverride[selId] ?? m.rotacion ?? 0;
            const newRot = (currentRot + 90) % 360;
            setRotOverride((prev) => ({ ...prev, [selId]: newRot }));
            void guardarRotMesa(selId, newRot);
          }
        } else if (selTipo === "elem") {
          const e = elementos.find(x => x.id === selId);
          if (e) {
            const currentRot = rotOverride[selId] ?? e.rotacion ?? 0;
            const newRot = (currentRot + 90) % 360;
            setRotOverride((prev) => ({ ...prev, [selId]: newRot }));
            void guardarRotElem(selId, newRot);
          }
        }
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
        ev.preventDefault();
        const step = 5;
        let dx = 0;
        let dy = 0;
        if (ev.key === "ArrowUp") dy = -step;
        if (ev.key === "ArrowDown") dy = step;
        if (ev.key === "ArrowLeft") dx = -step;
        if (ev.key === "ArrowRight") dx = step;

        if (selTipo === "mesa") {
          const m = mesas.find(x => x.id === selId);
          if (m) {
            const px = posOverride[selId]?.x ?? m.pos_x;
            const py = posOverride[selId]?.y ?? m.pos_y;
            const nx = Math.max(0, Math.min(800, px + dx));
            const ny = Math.max(0, Math.min(600, py + dy));
            setPosOverride((prev) => ({ ...prev, [selId]: { x: nx, y: ny } }));
            void guardarPosMesa(selId, { x: nx, y: ny });
          }
        } else if (selTipo === "elem") {
          const e = elementos.find(x => x.id === selId);
          if (e) {
            const px = posOverride[selId]?.x ?? e.pos_x;
            const py = posOverride[selId]?.y ?? e.pos_y;
            const nx = Math.max(0, Math.min(800, px + dx));
            const ny = Math.max(0, Math.min(600, py + dy));
            setPosOverride((prev) => ({ ...prev, [selId]: { x: nx, y: ny } }));
            void guardarPosElem(selId, { x: nx, y: ny });
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editandoPlano, selId, selTipo, mesas, elementos, posOverride, rotOverride]);

  // --- Cargar previa de mesa ---
  async function cargarPreviewMesa(m: Mesa) {
    setMesaSelInfo(null);
    const { data: ord } = await sb.from("sales_order")
      .select("id,total,comensales,created_at")
      .eq("table_id", m.id).in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) { setMesaSelInfo({ apertura: "", importe: 0, comensales: null, lineas: [] }); return; }
    const o = ord as { id: string; total: number; comensales: number | null; created_at: string };
    // Líneas y nota en paralelo (antes 3 round-trips en serie → mesa "lenta" al tocarla).
    const [{ data: lns }, nq] = await Promise.all([
      sb.from("order_line").select("product_id,cantidad,precio_unitario").eq("order_id", o.id),
      sb.from("sales_order").select("notas").eq("id", o.id).maybeSingle(),
    ]);
    setMesaSelInfo({
      apertura: hhmm(o.created_at), importe: Number(o.total), comensales: o.comensales,
      nota: (nq.data as { notas?: string } | null)?.notas ?? "",
      lineas: ((lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number }[]).map((l) => ({
        nombre: prods.find((p) => p.id === l.product_id)?.nombre ?? "Producto", cantidad: Number(l.cantidad), precio: Number(l.precio_unitario),
      })),
    });
  }

  // --- Manejo del Click/Pulsación Larga en Mesa ---
  function onPressStart(m: Mesa) {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setResForm({ id: null, nombre: "", personas: String(m.capacidad || 2), hora: "" });
      setReservaPop(m);
    }, 450);
  }

  function onPressEnd() { if (pressTimer.current) clearTimeout(pressTimer.current); }

  function onMesaClick(m: Mesa) {
    if (longPressed.current) { longPressed.current = false; return; }
    if (modoTraspaso) { void ejecutarTraspaso(m); return; }
    
    // Si la mesa está libre (sin cuenta activa), la abrimos directamente al primer toque:
    const libre = (totalesMesa[m.id] ?? 0) === 0;
    if (libre) {
      void abrirMesa(m);
      return;
    }

    // Si tiene cuenta: 1er toque selecciona y carga preview, 2º toque abre
    if (mesaSel?.id === m.id) { void abrirMesa(m); return; }
    setMesaSel(m); void cargarPreviewMesa(m);
  }

  // --- Panning del lienzo desactivado para estabilidad absoluta ---
  const handlePlanoPointerDown = () => {};
  const handlePlanoPointerMove = () => {};
  const handlePlanoPointerUp = () => {};

  // --- Drag & Drop de Mesas/Objetos (Edición) ---
  function ptEnPapelera(x: number, y: number) {
    const el = papeleraRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  async function guardarPosMesa(id: string, pos: { x: number; y: number }) {
    await sb.from("restaurant_table").update({ pos_x: pos.x, pos_y: pos.y }).eq("id", id);
  }

  async function borrarMesaId(id: string) {
    await sb.from("restaurant_table").delete().eq("id", id);
    await recargarMesas();
    setMesaSel(null);
  }

  async function borrarElemId(id: string) {
    await sb.from("plano_elemento").delete().eq("id", id);
    await recargarElementos();
  }

  async function guardarPosElem(id: string, pos: { x: number; y: number }) {
    await sb.from("plano_elemento").update({ pos_x: pos.x, pos_y: pos.y }).eq("id", id);
  }

  async function guardarDimElem(id: string, dim: { w: number; h: number }) {
    await sb.from("plano_elemento").update({ ancho: dim.w, alto: dim.h }).eq("id", id);
    await recargarElementos();
  }

  function cambiarLongitudElemento(e: Elemento, longitud: number) {
    const actual = dimOverride[e.id] ?? { w: e.ancho, h: e.alto };
    const horizontal = actual.w >= actual.h;
    const largoActual = horizontal ? actual.w : actual.h;
    const grosorActual = horizontal ? actual.h : actual.w;
    const largo = Math.max(40, Math.round(longitud / 5) * 5);
    const grosor = Math.max(8, grosorActual);
    const siguiente = horizontal ? { w: largo, h: grosor } : { w: grosor, h: largo };
    setDimOverride((prev) => ({ ...prev, [e.id]: siguiente }));
    void guardarDimElem(e.id, siguiente);
  }

  async function guardarRotElem(id: string, rot: number) {
    await sb.from("plano_elemento").update({ rotacion: rot }).eq("id", id);
    await recargarElementos();
  }

  async function guardarRotMesa(id: string, rot: number) {
    await sb.from("restaurant_table").update({ rotacion: rot }).eq("id", id);
    await recargarMesas();
  }

  function rotarSeleccionado(id: string, tipo: "mesa" | "elem") {
    if (tipo === "mesa") {
      const m = mesas.find((z) => z.id === id);
      if (!m) return;
      const currentRot = rotOverride[id] ?? m.rotacion ?? 0;
      const newRot = (currentRot + 90) % 360;
      setRotOverride((prev) => ({ ...prev, [id]: newRot }));
      void guardarRotMesa(id, newRot);
    } else {
      const el = elementos.find((z) => z.id === id);
      if (!el) return;
      const currentRot = rotOverride[id] ?? el.rotacion ?? 0;
      const newRot = (currentRot + 90) % 360;
      setRotOverride((prev) => ({ ...prev, [id]: newRot }));
      void guardarRotElem(id, newRot);
    }
  }

  async function setNombreMesa(id: string, nombre: string) {
    await sb.from("restaurant_table").update({ nombre }).eq("id", id);
    await recargarMesas();
  }

  async function setCapacidad(id: string, cap: number) {
    const nuevaCap = Math.max(1, cap);
    await sb.from("restaurant_table").update({ capacidad: nuevaCap }).eq("id", id);
    await recargarMesas();
  }

  // --- Editor de Mesa (Popup) ---
  function abrirEditorMesa(m: Mesa) {
    setMesaEdit(m);
    setNumMesa(m.nombre.match(/\d+/)?.[0] ?? "");
    setCapMesa(m.capacidad || 4);
  }

  function mesaLibreEdit(m: Mesa) {
    return (totalesMesa[m.id] ?? 0) === 0 && m.estado === "LIBRE";
  }

  function siguienteNumMesa(): number {
    const nums = mesas.filter((m) => m.room_id === vistaSala)
      .map((m) => parseInt(m.nombre.replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
    let n = 1; while (nums.includes(n)) n++; return n;
  }

  function encontrarPosicionLibre(w = 120, h = 120): { x: number; y: number } {
    let px = 80;
    let py = 80;
    
    const mesasSala = mesas.filter((m) => m.room_id === vistaSala);
    const elemsSala = elementos.filter((e) => e.room_id === vistaSala);
    
    const solapa = (x: number, y: number) => {
      // 1. Contra mesas
      for (const m of mesasSala) {
        const mx = posOverride[m.id]?.x ?? m.pos_x ?? 80;
        const my = posOverride[m.id]?.y ?? m.pos_y ?? 80;
        const spriteMesa = m.sprite ? assetPorId(m.sprite) : undefined;
        const sizeMesa = dim(spriteMesa ?? mesaPorCapacidad(m.capacidad || 4));
        if (x < mx + sizeMesa.w && x + w > mx && y < my + sizeMesa.h && y + h > my) {
          return true;
        }
      }
      // 2. Contra elementos
      for (const e of elemsSala) {
        const ex = posOverride[e.id]?.x ?? e.pos_x;
        const ey = posOverride[e.id]?.y ?? e.pos_y;
        const ew = dimOverride[e.id]?.w ?? e.ancho;
        const eh = dimOverride[e.id]?.h ?? e.alto;
        if (x < ex + ew && x + w > ex && y < ey + eh && y + h > ey) {
          return true;
        }
      }
      return false;
    };
    
    let intentos = 0;
    while (solapa(px, py) && intentos < 200) {
      px += 95;
      if (px > 740) {
        px = 80;
        py += 95;
      }
      intentos++;
    }
    return { x: px, y: py };
  }


  async function anadirMesaConForma(seats: number, sprite: string | null) {
    const n = siguienteNumMesa();
    const a = (sprite ? assetPorId(sprite) : undefined) ?? mesaPorCapacidad(seats);
    const d = dim(a);
    const pos = encontrarPosicionLibre(d.w, d.h);
    const base = { room_id: vistaSala, nombre: seats <= 1 ? `B${n}` : `Mesa ${n}`, estado: "LIBRE", pos_x: pos.x, pos_y: pos.y, capacidad: seats };
    const cols = "id,nombre,estado,room_id,pos_x,pos_y,capacidad,rotacion";
    const r1 = await sb.from("restaurant_table").insert({ ...base, sprite }).select(`${cols},sprite`).single();
    const r2 = r1.error ? await sb.from("restaurant_table").insert(base).select(cols).single() : null;
    const created = (r1.error ? r2?.data : r1.data) as Mesa | null;
    await recargarMesas();
    if (created) {
      setSelId(created.id);
      setSelTipo("mesa");
    }
  }

  async function setFormaMesa(f: { sprite: string | null; seats: number }) {
    if (!mesaEdit) return;
    setMesaEdit({ ...mesaEdit, sprite: f.sprite, capacidad: f.seats });
    setCapMesa(f.seats);
    setPosOverride((pos) => ({ ...pos }));
    const res = await sb.from("restaurant_table").update({ sprite: f.sprite, capacidad: f.seats }).eq("id", mesaEdit.id);
    if (res.error) await sb.from("restaurant_table").update({ capacidad: f.seats }).eq("id", mesaEdit.id);
    await recargarMesas();
  }

  async function rotarMesaEdit() {
    if (!mesaEdit) return;
    const rot = ((mesaEdit.rotacion || 0) + 90) % 360;
    setMesaEdit({ ...mesaEdit, rotacion: rot });
    await sb.from("restaurant_table").update({ rotacion: rot }).eq("id", mesaEdit.id);
    await recargarMesas();
  }

  async function guardarMesaEdit() {
    if (!mesaEdit) return;
    const cap = Math.max(1, Math.min(12, capMesa));
    const update: Record<string, unknown> = { capacidad: cap };
    const n = parseInt(numMesa, 10);
    if (mesaLibreEdit(mesaEdit) && n) {
      const dupe = mesas.some((m) => m.room_id === vistaSala && m.id !== mesaEdit.id && parseInt(m.nombre.replace(/\D/g, ""), 10) === n);
      if (dupe) {
        toast.warning("Ya existe una mesa con ese número");
        return;
      }
      update.nombre = cap <= 1 ? `B${n}` : `Mesa ${n}`;
    }
    await sb.from("restaurant_table").update(update).eq("id", mesaEdit.id);
    setMesaEdit(null);
    await recargarMesas();
  }

  async function eliminarMesaEdit() {
    if (!mesaEdit || !mesaLibreEdit(mesaEdit)) return;
    await borrarMesaId(mesaEdit.id);
    setMesaEdit(null);
  }

  // --- Elementos / Decorativos del plano ---
  async function anadirElemento(a: PlanoAsset) {
    const d = dim(a);
    const pos = encontrarPosicionLibre(d.w, d.h);
    const tipo = a.tipo === "barra" ? "BARRA" : a.tipo === "separador" ? "PARED" : a.tipo === "abertura" ? "PUERTA" : "PLANTA";
    const { data } = await sb.from("plano_elemento").insert({ room_id: vistaSala, tipo, etiqueta: a.nombre, icono: a.id, pos_x: pos.x, pos_y: pos.y, ancho: d.w, alto: d.h }).select("id").single();
    await recargarElementos();
    if (data) {
      setSelId((data as { id: string }).id);
      setSelTipo("elem");
    }
  }

  async function rotarElemEdit() {
    if (!elemEdit) return;
    const rot = ((elemEdit.rotacion || 0) + 90) % 360;
    setElemEdit({ ...elemEdit, rotacion: rot });
    await sb.from("plano_elemento").update({ rotacion: rot }).eq("id", elemEdit.id);
    await recargarElementos();
  }

  async function setTamElem(dw: number, dh: number) {
    if (!elemEdit) return;
    const ancho = Math.max(20, elemEdit.ancho + dw);
    const alto = Math.max(8, elemEdit.alto + dh);
    setElemEdit({ ...elemEdit, ancho, alto });
    await sb.from("plano_elemento").update({ ancho, alto }).eq("id", elemEdit.id);
    await recargarElementos();
  }

  async function duplicarElem() {
    if (!elemEdit) return;
    const e = elemEdit;
    await sb.from("plano_elemento").insert({ room_id: e.room_id, tipo: e.tipo, etiqueta: e.etiqueta, icono: e.icono, pos_x: e.pos_x + 24, pos_y: e.pos_y + 24, ancho: e.ancho, alto: e.alto, rotacion: e.rotacion });
    setElemEdit(null);
    await recargarElementos();
  }

  async function eliminarElemEdit() {
    if (!elemEdit) return;
    await borrarElemId(elemEdit.id);
    setElemEdit(null);
  }

  // --- Anotación / Notas de Mesa ---
  async function localAbrirNotaMesa(m: Mesa) {
    const { data: ord } = await sb.from("sales_order").select("id").eq("table_id", m.id)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const oid = (ord as { id: string } | null)?.id;
    if (!oid) {
      toast.warning("Mesa libre: sin cuenta activa donde anotar");
      return;
    }
    setNotaOrderId(oid);
    const nq = await sb.from("sales_order").select("notas").eq("id", oid).maybeSingle();
    setNotaTexto((nq.data as { notas?: string } | null)?.notas ?? "");
    setModalNota(true);
  }

  async function localGuardarNota() {
    if (notaOrderId) {
      await sb.from("sales_order").update({ notas: notaTexto }).eq("id", notaOrderId);
      if (mesaSel) void cargarPreviewMesa(mesaSel);
      toast.success("Nota guardada");
    }
    setModalNota(false);
  }

  // --- Reservas de Mesa (Pulsación Larga) ---
  function fechaHoy(hm: string): string {
    const [h, mi] = hm.split(":").map(Number);
    const d = new Date(); d.setHours(h ?? 0, mi ?? 0, 0, 0);
    return d.toISOString();
  }

  async function localGuardarReserva(m: Mesa) {
    if (!resForm.hora) return;
    const datos = {
      fecha_hora: fechaHoy(resForm.hora),
      comensales: Number(resForm.personas) || (m.capacidad || 2),
      nombre: resForm.nombre.trim() || null,
    };
    if (resForm.id) await sb.from("reservation").update(datos).eq("id", resForm.id);
    else await sb.from("reservation").insert({ location_id: locationId, table_id: m.id, estado: "CONFIRMADA", ...datos });
    setResForm({ id: null, nombre: "", personas: String(m.capacidad || 2), hora: "" });
    setReservaPop(null);
    await recargarReservas();
  }

  async function localQuitarReserva(r: Reserva) {
    await sb.from("reservation").delete().eq("id", r.id);
    setResForm({ id: null, nombre: "", personas: "", hora: "" });
    setReservaPop(null);
    await recargarReservas();
    toast.success("Reserva eliminada");
  }

  function localEditarReserva(r: Reserva) {
    setResForm({ id: r.id, nombre: r.nombre ?? "", personas: String(r.comensales), hora: hhmm(r.fecha_hora) });
  }

  // --- Elementos decorativos (Muros/Plantas) ---
  function ElementoPlano(e: Elemento) {
    const ov = posOverride[e.id];
    const px = ov?.x ?? e.pos_x;
    const py = ov?.y ?? e.pos_y;
    const pw = dimOverride[e.id]?.w ?? e.ancho;
    const ph = dimOverride[e.id]?.h ?? e.alto;
    const prot = rotOverride[e.id] ?? e.rotacion ?? 0;
    const isSel = selId === e.id;
    const estructural = esEstructuralElemento(e);
    
    let zIndex = 5;
    if (e.icono?.startsWith("suelo:")) {
      zIndex = 1;
    } else if (e.tipo === "BARRA" || e.icono?.includes("barra")) {
      zIndex = 2;
    } else if (e.tipo === "PARED" || e.icono?.includes("separador")) {
      zIndex = 3;
    } else if (e.tipo === "PUERTA" || e.icono?.includes("puerta") || e.icono?.includes("abertura")) {
      zIndex = 4;
    }

    const st = { 
      left: px, 
      top: py, 
      width: pw, 
      height: ph, 
      transform: prot ? `rotate(${prot}deg)` : undefined,
      zIndex: isSel ? 30 : zIndex
    };
    
    let inner: React.ReactNode;
    const a = e.icono?.startsWith("suelo:") ? null : assetPorId(e.icono);
    if (e.icono?.startsWith("suelo:")) {
      inner = <div className="h-full w-full" style={{ backgroundImage: `url(/plano/${e.icono.slice(6)}.svg?v=${PLANO_VER})`, backgroundRepeat: "repeat", backgroundSize: "60px auto" }} />;
    } else if (a) {
      inner = (
        <PlanoSvg 
          file={a.file} 
          className="pointer-events-none block h-full w-full select-none" 
        />
      );
    } else if (e.tipo === "BARRA") {
      inner = <div className="flex h-full w-full items-center justify-center rounded-md bg-amber-800/85 text-xs font-semibold text-amber-50">{e.etiqueta}</div>;
    } else if (e.tipo === "PARED") {
      inner = <div className="h-full w-full rounded bg-foreground/25" />;
    } else if (e.tipo === "PUERTA") {
      inner = <div className="flex h-full w-full items-center justify-center rounded border-2 border-dashed border-foreground/30 text-[10px] text-muted-foreground">{e.etiqueta}</div>;
    } else {
      inner = <div className="flex h-full w-full items-center justify-center text-2xl">{e.icono ?? <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{e.etiqueta}</span>}</div>;
    }

    if (!editandoPlano) return <div key={e.id} style={st} className="pointer-events-none absolute">{inner}</div>;
    return (
      <button 
        type="button" 
        key={e.id} 
        style={st} 
        onDragStart={(ev) => ev.preventDefault()}
        className={`absolute border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ${editandoPlano ? `cursor-move touch-none ${isSel ? "ring-2 ring-blue-500 scale-[1.03] z-30" : "ring-1 ring-brand/20 hover:scale-[1.02]"}` : "pointer-events-none transition-all duration-150"}`}
        onPointerDown={(ev) => { 
          ev.currentTarget.setPointerCapture(ev.pointerId); 
          dragRef.current = { id: e.id, sx: ev.clientX, sy: ev.clientY, ox: px, oy: py, moved: false }; 
          setArrastrando(true); 
        }}
        onPointerMove={(ev) => {
          const dr = dragRef.current;
          if (dr?.id !== e.id) return;
          const scale = planoScale || 1;
          const dx = (ev.clientX - dr.sx) / scale;
          const dy = (ev.clientY - dr.sy) / scale;
          if (!dr.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
          dr.moved = true;
          
          const snap = (v: number) => Math.max(0, Math.round(v / 5) * 5);
          // El CSS rota en torno al centro. Limitar por `pw`/`ph` sin rotar
          // hacía que un muro vertical siguiera reservando todo su largo en el
          // eje X y no pudiera llegar al borde derecho.
          const angulo = (prot * Math.PI) / 180;
          const anchoVisible = Math.abs(pw * Math.cos(angulo)) + Math.abs(ph * Math.sin(angulo));
          const altoVisible = Math.abs(pw * Math.sin(angulo)) + Math.abs(ph * Math.cos(angulo));
          const desplazaX = (pw - anchoVisible) / 2;
          const desplazaY = (ph - altoVisible) / 2;
          const nx = Math.max(-desplazaX, Math.min(800 - anchoVisible - desplazaX, snap(dr.ox + dx)));
          const ny = Math.max(-desplazaY, Math.min(600 - altoVisible - desplazaY, snap(dr.oy + dy)));
          
          const node = ev.currentTarget;
          node.style.left = `${nx}px`;
          node.style.top = `${ny}px`;
          
          posOverrideRef.current[e.id] = { x: nx, y: ny };
          setSobrePapel(ptEnPapelera(ev.clientX, ev.clientY));
        }}
        onPointerUp={(ev) => {
          const dr = dragRef.current; dragRef.current = null;
          setArrastrando(false); 
          const overTrash = sobrePapel || ptEnPapelera(ev.clientX, ev.clientY);
          setSobrePapel(false);
          ev.currentTarget.releasePointerCapture(ev.pointerId);
          
          if (dr?.moved && overTrash) { 
            void borrarElemId(e.id); 
            setSelId(null);
            setSelTipo(null);
            return; 
          }
          const finalPos = posOverrideRef.current[e.id];
          if (dr?.moved && finalPos) {
            setPosOverride((prev) => ({ ...prev, [e.id]: finalPos }));
            void guardarPosElem(e.id, finalPos);
          } else if (dr && !dr.moved) {
            setSelId(e.id);
            setSelTipo("elem");
          }
        }}
      >
        {inner}
        {/* Solo barras, muros y toldos se estiran; plantas y decoración conservan su forma. */}
        {isSel && estructural && (
          <span 
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              ev.currentTarget.setPointerCapture(ev.pointerId);
              const pw = dimOverride[e.id]?.w ?? e.ancho;
              const ph = dimOverride[e.id]?.h ?? e.alto;
              resizeRef.current = { id: e.id, sx: ev.clientX, sy: ev.clientY, sw: pw, sh: ph };
            }}
            onPointerMove={(ev) => {
              const r = resizeRef.current;
              if (r && r.id === e.id) {
                ev.stopPropagation();
                const scale = planoScale || 1;
                const dx = (ev.clientX - r.sx) / scale;
                const dy = (ev.clientY - r.sy) / scale;
                const angulo = (prot * Math.PI) / 180;
                const dxLocal = dx * Math.cos(angulo) + dy * Math.sin(angulo);
                const dyLocal = -dx * Math.sin(angulo) + dy * Math.cos(angulo);
                const horizontal = r.sw >= r.sh;
                const largoInicial = horizontal ? r.sw : r.sh;
                const grosorInicial = horizontal ? r.sh : r.sw;
                const largo = Math.max(40, Math.round((largoInicial + (horizontal ? dxLocal : dyLocal)) / 5) * 5);
                const grosor = Math.max(8, grosorInicial);
                setDimOverride((prev) => ({ ...prev, [r.id]: horizontal ? { w: largo, h: grosor } : { w: grosor, h: largo } }));
              }
            }}
            onPointerUp={(ev) => {
              const r = resizeRef.current;
              if (r && r.id === e.id) {
                ev.stopPropagation();
                ev.currentTarget.releasePointerCapture(ev.pointerId);
                resizeRef.current = null;
                const d = dimOverride[r.id];
                if (d) void guardarDimElem(r.id, d);
              }
            }}
            className="absolute -bottom-1 -right-1 z-40 h-3 w-3 cursor-se-resize rounded-full border border-white bg-brand shadow pointer-events-auto hover:scale-125 transition-all"
          />
        )}
      </button>
    );
  }

  // --- Dibujar Mesa Plano ---
  function MesaPlano(m: Mesa, i: number) {
    const cuenta = totalesMesa[m.id] ?? 0;
    const porCobrar = m.estado === "POR_COBRAR";
    const ocupada = cuenta > 0 || m.estado !== "LIBRE";
    const resvs = reservasPorMesa[m.id] ?? [];
    const reservada = resvs.length > 0;
    const a = (m.sprite ? assetPorId(m.sprite) : undefined) ?? mesaPorCapacidad(m.capacidad || 4);
    const d = dim(a);
    const ov = posOverride[m.id];
    const x = ov?.x ?? m.pos_x ?? (40 + (i % 4) * 220);
    const y = ov?.y ?? m.pos_y ?? (40 + Math.floor(i / 4) * 230);
    const prot = rotOverride[m.id] ?? m.rotacion ?? 0;
    const isSel = selId === m.id;
    const seleccionada = mesaSel?.id === m.id;
    const esRedonda = a.file.includes("redonda") || a.file.includes("taburete") || a.file.includes("toldo");
    const esTaburete = a.file.includes("taburete");
    const esHamaca = a.file.includes("hamaca");

    // Colores táctiles mejorados
    const fill = editandoPlano 
      ? (isSel ? "#60a5fa" : "#8a5a2b") 
      : seleccionada 
        ? "#3b82f6" 
        : porCobrar
          ? "#eab308"
          : ocupada 
            ? "#f59e0b" 
            : (reservada ? "#38bdf8" : "#8a5a2b");

    // Clases dinámicas premium (sin box-shadows en el contenedor para evitar recuadros opacos)
    const shadowClass = seleccionada 
      ? "scale-[1.04] ring-2 ring-brand z-20" 
      : "";

    return (
      <button 
        type="button"
        key={m.id}
        onDragStart={(e) => e.preventDefault()}
        onClick={() => { if (!editandoPlano) onMesaClick(m); }}
        onPointerDown={(ev) => {
          if (!editandoPlano) { onPressStart(m); return; }
          ev.currentTarget.setPointerCapture(ev.pointerId);
          dragRef.current = { id: m.id, sx: ev.clientX, sy: ev.clientY, ox: x, oy: y, moved: false };
          setArrastrando(true);
        }}
        onPointerMove={(ev) => {
          const dr = dragRef.current;
          if (!editandoPlano || dr?.id !== m.id) return;
          const scale = planoScale || 1;
          const dx = (ev.clientX - dr.sx) / scale;
          const dy = (ev.clientY - dr.sy) / scale;
          if (!dr.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
          dr.moved = true;
          
          const snap = (v: number) => Math.max(0, Math.round(v / 5) * 5);
          const nx = Math.max(0, Math.min(800 - d.w, snap(dr.ox + dx)));
          const ny = Math.max(0, Math.min(600 - d.h, snap(dr.oy + dy)));
          
          const node = ev.currentTarget;
          node.style.left = `${nx}px`;
          node.style.top = `${ny}px`;
          
          posOverrideRef.current[m.id] = { x: nx, y: ny };
          setSobrePapel(ptEnPapelera(ev.clientX, ev.clientY));
        }}
        onPointerUp={(ev) => {
          if (!editandoPlano) { onPressEnd(); return; }
          const dr = dragRef.current; dragRef.current = null;
          setArrastrando(false); 
          const overTrash = sobrePapel || ptEnPapelera(ev.clientX, ev.clientY);
          setSobrePapel(false);
          ev.currentTarget.releasePointerCapture(ev.pointerId);
          
          if (dr?.moved && overTrash) {
            if (mesaLibreEdit(m)) { 
              void borrarMesaId(m.id); 
              setSelId(null);
              setSelTipo(null);
            } else {
              ev.currentTarget.style.left = `${x}px`;
              ev.currentTarget.style.top = `${y}px`;
            }
            return;
          }
          const finalPos = posOverrideRef.current[m.id];
          if (dr?.moved && finalPos) {
            setPosOverride((prev) => ({ ...prev, [m.id]: finalPos }));
            void guardarPosMesa(m.id, finalPos);
          } else if (dr && !dr.moved) {
            setSelId(m.id);
            setSelTipo("mesa");
          }
        }}
        onPointerLeave={() => { if (!editandoPlano) onPressEnd(); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ 
          left: x, 
          top: y, 
          width: d.w, 
          height: d.h,
          zIndex: (editandoPlano && isSel) ? 30 : (seleccionada ? 20 : 10)
        }}
        className={`absolute select-none border-none border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none ${esRedonda ? "rounded-full" : "rounded-xl"} ${editandoPlano ? `cursor-move touch-none ${isSel ? "ring-2 ring-blue-500 scale-[1.03] z-30" : "ring-1 ring-brand/20 hover:scale-[1.02]"}` : `transition-all duration-200 hover:scale-[1.06] ${shadowClass}`} ${seleccionada && !editandoPlano ? "z-10" : ""}`}
      >
        <PlanoSvg 
          file={a.file} 
          style={{ 
            transform: prot ? `rotate(${prot}deg)` : undefined, 
            "--mesa-fill": fill,
            "--highlight-fill": (seleccionada || ocupada || reservada || (editandoPlano && isSel)) ? fill : undefined
          } as React.CSSProperties} 
          className="pointer-events-none block h-full w-full" 
        />
        {esTaburete ? (() => {
          let labelClass = "absolute left-[115%] top-1/2 -translate-y-1/2 flex items-center justify-start text-[10px] font-black text-foreground drop-shadow-sm pointer-events-none select-none whitespace-nowrap";
          if (prot > 45 && prot <= 135) {
            labelClass = "absolute top-[115%] left-1/2 -translate-x-1/2 flex items-center justify-center text-[10px] font-black text-foreground drop-shadow-sm pointer-events-none select-none whitespace-nowrap";
          } else if (prot > 135 && prot <= 225) {
            labelClass = "absolute right-[115%] top-1/2 -translate-y-1/2 flex items-center justify-end text-[10px] font-black text-foreground drop-shadow-sm pointer-events-none select-none whitespace-nowrap";
          } else if (prot > 225 && prot <= 315) {
            labelClass = "absolute bottom-[115%] left-1/2 -translate-x-1/2 flex items-center justify-center text-[10px] font-black text-foreground drop-shadow-sm pointer-events-none select-none whitespace-nowrap";
          }
          return (
            <span className={labelClass}>
              {m.nombre.replace("Mesa ", "")}
            </span>
          );
        })() : esHamaca ? (() => {
          let labelClass = "absolute left-1/2 bottom-[105%] -translate-x-1/2 flex items-center justify-center text-[10px] font-black text-slate-900 pointer-events-none select-none whitespace-nowrap";
          if (prot > 45 && prot <= 135) {
            labelClass = "absolute left-[105%] top-1/2 -translate-y-1/2 flex items-center justify-start text-[10px] font-black text-slate-900 pointer-events-none select-none whitespace-nowrap";
          } else if (prot > 135 && prot <= 225) {
            labelClass = "absolute left-1/2 top-[105%] -translate-x-1/2 flex items-center justify-center text-[10px] font-black text-slate-900 pointer-events-none select-none whitespace-nowrap";
          } else if (prot > 225 && prot <= 315) {
            labelClass = "absolute right-[105%] top-1/2 -translate-y-1/2 flex items-center justify-end text-[10px] font-black text-slate-900 pointer-events-none select-none whitespace-nowrap";
          }
          return (
            <span className={labelClass}>
              {m.nombre.replace("Mesa ", "")}
            </span>
          );
        })() : (
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="text-[10px] font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{m.nombre.replace("Mesa ", "")}</span>
            {porCobrar && (
              <span className="mt-0.5 rounded bg-red-600 px-1 py-0.5 text-[6.5px] font-extrabold uppercase tracking-wider text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">CUENTA</span>
            )}
          </span>
        )}
        {reservada && !editandoPlano && (
          <span className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-sky-600 px-2 py-0.5 text-[10px] font-bold leading-tight text-white shadow-md border border-sky-400">
            {resvs[0]!.nombre || "Reserva"} · {hhmm(resvs[0]!.fecha_hora)}{resvs.length > 1 ? ` +${resvs.length - 1}` : ""}
          </span>
        )}
      </button>
    );
  }

  // --- Renderización de Barra Lateral (Salas / Zonas) ---
  const railSalasRendered = useMemo(() => {
    const iconoSala = (nombre: string) => {
      const n = nombre.toLowerCase();
      if (n.includes("terraza")) return Sun;
      if (n.includes("barra")) return Store;
      if (n.includes("llevar")) return ShoppingBag;
      return Armchair;
    };
    const tabs: RailTab[] = [
      { id: "TICKET", label: "Ticket", icon: Receipt, onClick: () => irASala({ tipo: "ticket" }) },
      { id: "BARRA", label: "Aparcado", icon: Store, badge: aparcados.length || undefined, onClick: () => irASala({ tipo: "barra" }) },
      ...rooms.map((rm) => ({
        id: rm.id, label: rm.nombre, icon: iconoSala(rm.nombre),
        badge: mesas.filter((m) => m.room_id === rm.id && (totalesMesa[m.id] ?? 0) > 0).length || undefined,
        onClick: () => irASala({ tipo: "room", id: rm.id }),
      })),
      { id: "LLEVAR", label: "Para llevar", icon: ShoppingBag, badge: llevarList.length || undefined, onClick: () => irASala({ tipo: "llevar" }) },
      { id: "RESERVAS", label: "Reservas", icon: CalendarCheck, badge: reservas.length || undefined, onClick: () => irASala({ id: "RESERVAS", tipo: "room" }) }, // mapped to reserves tab
    ];
    return (
      <RailSalas tabs={tabs} activo={vistaSala === "RESERVAS" ? "RESERVAS" : vistaSala} busy={busy} onConfig={() => setModalUtilidades(true)} />
    );
  }, [rooms, mesas, totalesMesa, aparcados, llevarList, reservas, vistaSala, busy]);

  // Layout calculations
  const mesasSala = mesas.filter((m) => m.room_id === vistaSala);
  const roomActiva = rooms.find((r) => r.id === vistaSala);
  const planoBg = roomActiva?.suelo
    ? { backgroundImage: `url(/plano/${roomActiva.suelo}.svg?v=${PLANO_VER})`, backgroundRepeat: "repeat" as const, backgroundSize: "60px auto" }
    : { backgroundImage: "radial-gradient(rgba(120,120,120,0.12) 1.5px, transparent 1.5px)", backgroundSize: "28px 28px" };

  const lienzoStyle = {
    width: planoContent.w, height: planoContent.h,
    transform: `scale(${planoScale}) translate(${panOffset.x / planoScale}px, ${panOffset.y / planoScale}px)`, 
    transformOrigin: "center",
    "--mesa-fill": marca.mesa_color, "--silla-fill": marca.silla_color,
  } as unknown as React.CSSProperties;

  const enPlano = !["BARRA", "LLEVAR", "RESERVAS"].includes(vistaSala);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden select-none">
      {renderVelo()}
      {dialogo}

      {/* Header Fijo */}
      <header className="flex flex-none items-center justify-between border-b border-border bg-card px-4 py-2.5 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-brand animate-pulse" />
          <strong className="font-semibold text-sm">Salón · {operario.nombre}</strong>
          
          {editandoPlano && (
            <button 
              type="button" 
              onClick={() => setPaletaAbierta((v) => !v)} 
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-black shadow-sm hover:bg-accent text-foreground transition-all active:scale-95"
            >
              <LayoutGrid size={14} className="text-brand" />
              {paletaAbierta ? "Ocultar catálogo" : "Ver catálogo"}
            </button>
          )}
        </div>
        {editandoPlano ? (
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand border border-brand/20 animate-pulse">
            🛠️ Edición de Salón Activa · Arrastra las mesas
          </span>
        ) : (
          /* Leyenda en el navbar en modo vista */
          <div className="flex items-center gap-3.5 rounded-full bg-muted/40 border border-border/60 px-4 py-1 text-[10px] font-bold">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />Libre</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Ocupada</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />Reservada</span>
          </div>
        )}
      </header>

      {/* Workspace Principal */}
      <div className="flex min-h-0 flex-1 relative">
        {/* Editor/Paleta lateral izquierda (solo modo edición) */}
        {editandoPlano && (
          paletaAbierta ? (
            <aside className="flex w-64 flex-none flex-col border-r border-border bg-card shadow-lg z-20 transition-all duration-300">
              <div className="grid grid-cols-[1fr_1fr_1fr_32px] items-stretch border-b border-border">
                {(["MESAS", "ESTRUCTURA", "DECORACION"] as const).map((t) => (
                  <button 
                    type="button" 
                    key={t} 
                    onClick={() => setPaletaTab(t)}
                    className={`min-w-0 px-1 py-2.5 text-center text-[10px] font-bold leading-tight tracking-wide uppercase ${paletaTab === t ? "border-b-2 border-brand text-brand bg-brand/5" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t === "MESAS" ? "Mesas" : t === "ESTRUCTURA" ? <>Estructu<br />ra</> : <>Decora<br />ción</>}
                  </button>
                ))}
                <button type="button" onClick={() => setPaletaAbierta(false)} className="text-lg text-muted-foreground hover:text-foreground font-bold" title="Ocultar">‹</button>
              </div>
              
              <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 bg-muted/5">
                {paletaTab === "MESAS"
                  ? FORMAS_MESA.map((f: any) => (
                      <button 
                        type="button" 
                        key={f.file} 
                        onClick={() => anadirMesaConForma(f.seats, f.sprite)}
                        className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-2.5 text-center hover:border-brand/50 hover:bg-brand/5 active:scale-95 transition-all shadow-sm"
                      >
                        <img src={`/plano/${f.file}?v=${PLANO_VER}`} alt="" className="h-10 w-10 object-contain filter drop-shadow-sm" />
                        <span className="text-[9px] font-bold leading-tight">{f.nombre}</span>
                      </button>
                    ))
                  : ASSETS.filter((a: PlanoAsset) => {
                      if (ASSETS_LEGACY.has(a.id)) return false;
                      return paletaTab === "ESTRUCTURA" ? esAssetEstructural(a) : a.tipo === "planta";
                    }).map((a: PlanoAsset) => (
                      <button 
                        type="button" 
                        key={a.id} 
                        onClick={() => anadirElemento(a)}
                        className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-2.5 text-center hover:border-brand/50 hover:bg-brand/5 active:scale-95 transition-all shadow-sm"
                      >
                        <img src={`/plano/${a.file}?v=${PLANO_VER}`} alt="" className={paletaTab === "ESTRUCTURA" ? "h-10 w-full object-contain" : "h-10 w-10 object-contain"} />
                        <span className="text-[9px] font-bold leading-tight">{a.nombre}</span>
                      </button>
                    ))}
              </div>
            </aside>
          ) : (
            <button 
              type="button" 
              onClick={() => setPaletaAbierta(true)} 
              className="flex w-9 flex-none items-center justify-center border-r border-border bg-card text-muted-foreground hover:text-foreground font-bold shadow z-20" 
              title="Añadir"
            >
              ›
            </button>
          )
        )}

        {/* Zona del Plano / Listados centrales */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-muted/10">
          
          {/* Barra (Cuentas aparcadas) */}
          {vistaSala === "BARRA" ? (
            <div className="p-5 h-full overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-brand" /> Cuentas Aparcadas
                </h3>
                <button type="button" onClick={() => irASala({ tipo: "ticket" })} className="bg-brand text-brand-foreground px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-brand-hover active:scale-95 transition-all">+ Nueva venta</button>
              </div>
              {aparcados.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-card">No hay cuentas abiertas. Pulsa «Nueva venta» para empezar una.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {aparcados.map((o) => {
                    const lineas = aparcadosLineas[o.id] ?? [];
                    return (
                      <button 
                        type="button" 
                        key={o.id} 
                        onClick={() => recuperarAparcado(o)}
                        className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-brand/40 hover:shadow-md active:scale-98"
                      >
                        <div className="bg-brand px-2 py-1.5 text-center text-xs font-extrabold text-brand-foreground truncate">{o.aparcado_como || `Barra ${hhmm(o.created_at)}`}</div>
                        <div className="flex-1 p-3">
                          <div className="mb-1.5 flex gap-1 border-b border-border pb-1 text-[9px] font-bold uppercase text-muted-foreground">
                            <span className="flex-1">Artículo</span><span className="w-8 text-right">Uds</span><span className="w-12 text-right">Total</span>
                          </div>
                          <ul className="space-y-1 text-xs">
                            {lineas.slice(0, 5).map((l, idx) => (
                              <li key={`${o.id}-${idx}`} className="flex gap-1">
                                <span className="flex-1 truncate">{l.nombre}</span>
                                <span className="w-8 text-right font-medium text-muted-foreground">{l.cantidad}</span>
                                <span className="w-12 text-right font-bold">{eur(l.total)}</span>
                              </li>
                            ))}
                            {lineas.length > 5 && <li className="text-[10px] text-muted-foreground italic font-semibold">+{lineas.length - 5} más…</li>}
                            {lineas.length === 0 && <li className="text-[10px] text-muted-foreground">Sin líneas</li>}
                          </ul>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-border p-3 bg-muted/10">
                          <span className="rounded bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-black text-brand uppercase">Abrir</span>
                          <span className="text-base font-black tabular-nums">{eur(Number(o.total))}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : vistaSala === "LLEVAR" ? (
            /* Para Llevar */
            <div className="mx-auto max-w-2xl space-y-4 p-5 h-full overflow-y-auto">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 font-bold text-sm">Nuevo pedido para llevar</h3>
                <div className="flex flex-wrap gap-3">
                  <input value={nuevoLlevarForm.nombre} onChange={(e) => setNuevoLlevarForm((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nombre del cliente" className="min-w-40 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                  <input value={nuevoLlevarForm.telefono} onChange={(e) => setNuevoLlevarForm((s) => ({ ...s, telefono: e.target.value }))} placeholder="Teléfono" inputMode="tel" className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                  <button 
                    type="button" 
                    onClick={() => {
                      nuevoParaLlevar(nuevoLlevarForm.nombre, nuevoLlevarForm.telefono);
                      setNuevoLlevarForm({ nombre: "", telefono: "" });
                    }} 
                    disabled={!nuevoLlevarForm.nombre.trim()} 
                    className="bg-brand text-brand-foreground px-5 py-2 rounded-lg font-bold shadow hover:bg-brand-hover active:scale-95 disabled:opacity-40 transition-all"
                  >
                    Crear
                  </button>
                </div>
              </div>
              
              {llevarList.length === 0 && <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-card">Sin pedidos para llevar abiertos.</div>}
              <div className="space-y-2">
                {llevarList.map((o) => (
                  <button 
                    type="button" 
                    key={o.id} 
                    onClick={() => abrirLlevar(o)} 
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 hover:border-brand/40 active:scale-[0.99] transition-all shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-1.5">🛍️ {o.cliente_nombre}</div>
                      {o.cliente_telefono && <div className="text-xs text-muted-foreground font-semibold mt-0.5">{o.cliente_telefono}</div>}
                    </div>
                    <span className="font-black text-lg text-brand tabular-nums">{eur(Number(o.total))}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : vistaSala === "RESERVAS" ? (
            /* Reservas de mesa */
            <div className="mx-auto max-w-2xl space-y-3 p-5 h-full overflow-y-auto">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
                <span className="h-3 w-3 rounded-full bg-sky-500" /> Registro de Reservas
              </h3>
              {reservas.length === 0 && <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-card">Sin reservas registradas para hoy.</div>}
              <div className="space-y-2">
                {reservas.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:border-sky-400 transition-colors">
                    <div className="min-w-0">
                      <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                        <span className="bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded px-2 py-0.5 text-xs font-black tabular-nums">
                          {new Date(r.fecha_hora).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {r.nombre && <span>{r.nombre}</span>}
                        <span className="text-muted-foreground font-medium">· {r.comensales} pax</span>
                        {r.table_id && <span className="text-brand font-semibold">· {mesas.find((mm) => mm.id === r.table_id)?.nombre ?? "Mesa"}</span>}
                      </div>
                      {r.notas && <div className="text-xs text-muted-foreground mt-1 truncate max-w-md">📝 {r.notas}</div>}
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black uppercase text-muted-foreground tracking-wider">{r.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Plano Interactivo SVG */
            <div 
              ref={planoBoxRef} 
              style={planoBg} 
              onPointerDown={handlePlanoPointerDown}
              onPointerMove={handlePlanoPointerMove}
              onPointerUp={handlePlanoPointerUp}
              className="relative h-full w-full p-2 select-none grid place-items-center overflow-auto bg-muted/5"
            >
              {/* Cabecera Flotante */}
              {!editandoPlano && (
                <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-background/90 backdrop-blur border border-border px-3.5 py-1.5 text-xs font-extrabold shadow flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                    {roomActiva?.nombre ?? "Sala"}
                    <span className="ml-1 font-bold text-muted-foreground">({mesasSala.filter((m) => (totalesMesa[m.id] ?? 0) > 0).length}/{mesasSala.length} ocupadas)</span>
                  </span>
                </div>
              )}

              {/* Botones de Control de Zoom (Flotante) */}
              {enPlano && (
                <div className="absolute right-4 top-4 z-20 flex flex-col gap-1.5 bg-background/90 backdrop-blur border border-border p-1.5 rounded-xl shadow-md">
                  <button 
                    type="button" 
                    onClick={() => setPlanoScale((s) => Math.min(1.4, s + 0.1))}
                    className="p-2 hover:bg-accent rounded-lg text-foreground transition-all active:scale-90"
                    title="Acercar"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPlanoScale((s) => Math.max(0.5, s - 0.1))}
                    className="p-2 hover:bg-accent rounded-lg text-foreground transition-all active:scale-90"
                    title="Alejar"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button 
                    type="button" 
                    onClick={autoScale}
                    className="p-2 hover:bg-accent rounded-lg text-foreground transition-all active:scale-90"
                    title="Ajustar"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              )}

              {/* Lienzo SVG */}
              <div className={`relative flex-none transition-transform duration-75 select-none ${editandoPlano ? "border-2 border-dashed border-brand/40 bg-background/25 shadow-inner" : "rounded-2xl"}`} style={lienzoStyle}>
                {elementos.filter((e) => e.room_id === vistaSala)
                  .sort((a, b) => (b.icono?.startsWith("suelo:") ? 1 : 0) - (a.icono?.startsWith("suelo:") ? 1 : 0))
                  .map((e) => ElementoPlano(e))}
                {mesasSala.map((m, idx) => MesaPlano(m, idx))}
                {mesasSala.length === 0 && (
                  <p className="absolute inset-0 grid place-items-center text-muted-foreground text-sm font-semibold select-none">Sin mesas en esta sala.</p>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Panel lateral derecho (detalles cuenta de la mesa seleccionada) */}
        {enPlano && !editandoPlano && !modoTraspaso && (
          <aside className="flex w-72 flex-none flex-col border-l border-border bg-card shadow-lg z-10 transition-all duration-300">
            <div className="border-b border-border p-4 bg-muted/5">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                <span className="text-muted-foreground font-semibold">MESA</span>
                <span className="font-extrabold text-sm text-brand">{mesaSel?.nombre ?? "—"}</span>
                
                <span className="text-muted-foreground font-semibold">APERTURA</span>
                <span className="tabular-nums font-semibold">{mesaSelInfo?.apertura || "—"}</span>
                
                <span className="text-muted-foreground font-semibold">COMENSALES</span>
                <span className="font-semibold">{mesaSelInfo?.comensales ?? "—"}</span>
                
                <span className="text-muted-foreground font-semibold">IMPORTE</span>
                <span className="font-black text-sm text-amber-500 tabular-nums">{eur(mesaSelInfo?.importe ?? 0)}</span>
              </div>
              {mesaSelInfo?.nota && (
                <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  📝 {mesaSelInfo.nota}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-3">
              {!mesaSel ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-2">
                  <span className="text-4xl">🖱️</span>
                  <span>Toca una mesa para ver su cuenta.<br />Toca de nuevo para abrirla.</span>
                </div>
              ) : (mesaSelInfo?.lineas.length ?? 0) === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-2">
                  <span className="text-4xl">🍵</span>
                  <span>Mesa libre · sin consumiciones</span>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex gap-1 border-b border-border pb-1.5 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                    <span className="flex-1">Descripción</span><span className="w-8 text-right">Cant</span><span className="w-14 text-right">Precio</span>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {mesaSelInfo!.lineas.map((l, idx) => (
                      <li key={`${mesaSel.id}-${idx}`} className="flex gap-1 items-center border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                        <span className="flex-1 truncate font-medium">{l.nombre}</span>
                        <span className="w-8 text-right font-semibold text-muted-foreground tabular-nums">{l.cantidad}</span>
                        <span className="w-14 text-right font-bold tabular-nums">{eur(l.precio)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {mesaSel && (
              <div className="border-t border-border p-3 bg-muted/5 flex flex-col gap-2">
                <button type="button" onClick={() => abrirMesa(mesaSel)} className="bg-brand text-brand-foreground w-full py-2.5 rounded-lg text-sm font-extrabold shadow hover:bg-brand-hover active:scale-95 transition-all">
                  Abrir {mesaSel.nombre} →
                </button>
              </div>
            )}
          </aside>
        )}

        {/* Panel lateral de Traspaso por líneas */}
        {enPlano && modoTraspaso === "LINEAS" && (
          <aside className="flex w-72 flex-none flex-col border-l border-border bg-card shadow-lg z-10">
            <div className="border-b border-border p-4 bg-amber-500/10 text-sm font-bold text-amber-800 flex items-center gap-2">
              <span>Traspaso de {mesaSel?.nombre ?? "Mesa"}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 bg-amber-500/5">
              {Object.entries(comanda).length === 0 && <p className="mt-8 text-center text-xs text-muted-foreground font-semibold">Sin líneas.</p>}
              {/* `clave` es la clave de la COMANDA (producto|formato|extras#n), no el
                  product_id: por eso el nombre se resuelve con nombreLinea (antes se
                  buscaba en `prods` por la clave y salía siempre "Producto"). */}
              {Object.entries(comanda).map(([clave, qty]) => {
                const nombre = nombreLinea(clave) || "Producto";
                const mv = traspLineas[clave] ?? 0;
                return (
                  <div key={clave} className="flex items-center gap-2 py-2 border-b border-amber-500/10 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{nombre}</span>
                    <button type="button" onClick={() => setTraspLineas((t) => ({ ...t, [clave]: Math.max(0, (t[clave] ?? 0) - 1) }))} className="h-7 w-7 flex-none rounded border border-border bg-background hover:bg-accent font-bold">−</button>
                    <span className="w-12 text-center text-xs font-bold tabular-nums">{mv}/{qty}</span>
                    <button type="button" onClick={() => setTraspLineas((t) => ({ ...t, [clave]: Math.min(qty, (t[clave] ?? 0) + 1) }))} className="h-7 w-7 flex-none rounded border border-border bg-background hover:bg-accent font-bold">+</button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-3 text-center text-xs font-bold text-amber-600 animate-pulse bg-amber-500/10">
              👉 Toca la mesa destino en el plano
            </div>
          </aside>
        )}

        {/* Rail de Salas (Botones laterales) */}
        {railSalasRendered}
      </div>

      {/* Traspaso: aviso flotante central */}
      {modoTraspaso && (
        <div className="fixed left-1/2 top-16 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-amber-400 bg-amber-50 px-5 py-2.5 text-sm font-extrabold text-amber-900 shadow-xl dark:bg-amber-900/90 dark:text-amber-100 animate-bounce">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            Traspaso de {mesaSel?.nombre ?? "Mesa"}{modoTraspaso === "LINEAS" ? " (por líneas)" : ""} activo
          </span>
          <button type="button" onClick={cancelarTraspaso} className="rounded-full bg-amber-800 hover:bg-amber-900 px-3 py-1 text-xs text-white shadow transition-colors">
            Cancelar
          </button>
        </div>
      )}

      {/* Papelera de borrado (Edición) */}
      {editandoPlano && arrastrando && (
        <div 
          ref={papeleraRef}
          className={`pointer-events-none fixed bottom-24 left-1/2 z-50 flex h-28 w-28 -translate-x-1/2 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed shadow-2xl transition-all duration-200 ${sobrePapel ? "scale-110 border-rose-600 bg-rose-600 text-white" : "border-rose-400 bg-card text-rose-500"}`}
        >
          <Trash2 size={32} strokeWidth={1.75} />
          <span className="text-[9px] font-black tracking-wider uppercase">Soltar</span>
        </div>
      )}

      {/* Footer de Acciones del Plano */}
      {enPlano && (
        editandoPlano ? (
          <footer className="flex-none border-t border-border bg-brand/10 px-4 py-3 z-30 shadow-md">
            <div className="grid grid-cols-3 items-center w-full gap-3">
              {/* Left Column: empty space / edit mode label */}
              <div className="flex justify-start text-[11px] font-black text-brand uppercase tracking-wider">
                🛠️ Diseñando Salón
              </div>
              
              {/* Center Column: Parameter Editor */}
              <div className="flex justify-center">
                {selId ? (() => {
                  if (selTipo === "mesa") {
                    const m = mesas.find((z) => z.id === selId);
                    if (!m) return null;
                    const libre = mesaLibreEdit(m);
                    return (
                      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm text-sm">
                        <span className="font-extrabold text-xs text-brand uppercase tracking-wide">Mesa Seleccionada</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-muted-foreground">Nº:</span>
                          <input 
                            type="text" 
                            value={m.nombre.replace("Mesa ", "")} 
                            onChange={(ev) => {
                              if (libre) void setNombreMesa(m.id, `Mesa ${ev.target.value.replace(/\D/g, "")}`);
                            }}
                            disabled={!libre}
                            className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-center font-bold outline-none focus:border-brand disabled:opacity-50 text-xs text-foreground"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-muted-foreground">Sillas:</span>
                          <button type="button" onClick={() => setCapacidad(m.id, (m.capacidad || 4) - 1)} className="h-6 w-6 rounded border border-border bg-background font-bold text-xs flex items-center justify-center text-foreground">-</button>
                          <span className="w-5 text-center font-bold text-xs text-foreground">{m.capacidad}</span>
                          <button type="button" onClick={() => setCapacidad(m.id, (m.capacidad || 4) + 1)} className="h-6 w-6 rounded border border-border bg-background font-bold text-xs flex items-center justify-center text-foreground">+</button>
                        </div>

                        <button
                          type="button"
                          onClick={() => rotarSeleccionado(m.id, "mesa")}
                          className="rounded bg-secondary border border-border px-2.5 py-1 text-xs font-bold hover:bg-accent flex items-center gap-1 text-foreground"
                        >
                          <RotateCw size={11} /> Girar
                        </button>
                        {/* Forma de la mesa (redonda, cuadrada, nº de plazas…). El modal
                            estaba construido ENTERO pero era inalcanzable: nada llamaba a
                            abrirEditorMesa, así que no había manera de cambiar la forma de
                            una mesa una vez creada. Este botón lo conecta. */}
                        <button
                          type="button"
                          onClick={() => abrirEditorMesa(m)}
                          className="rounded bg-secondary border border-border px-2.5 py-1 text-xs font-bold hover:bg-accent flex items-center gap-1 text-foreground"
                        >
                          <Pencil size={11} /> Forma
                        </button>
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (libre && await confirmar({ titulo: "¿Eliminar esta mesa?", textoConfirmar: "Eliminar", peligroso: true })) {
                              void borrarMesaId(m.id);
                              setSelId(null);
                              setSelTipo(null);
                            }
                          }}
                          disabled={!libre}
                          className="rounded bg-rose-50 border border-rose-200 text-rose-600 px-2.5 py-1 text-xs font-bold hover:bg-rose-100 disabled:opacity-40"
                        >
                          Eliminar
                        </button>
                        {!libre && <span className="text-[10px] text-amber-600 font-semibold">Cuenta abierta</span>}
                      </div>
                    );
                  } else {
                    const el = elementos.find((z) => z.id === selId);
                    if (!el) return null;
                    const pw = dimOverride[el.id]?.w ?? el.ancho;
                    const ph = dimOverride[el.id]?.h ?? el.alto;
                    const estructural = esEstructuralElemento(el);
                    const longitud = pw >= ph ? pw : ph;
                    return (
                      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm text-sm">
                        <span className="font-extrabold text-xs text-brand uppercase tracking-wide">{el.etiqueta || "Elemento"}</span>
                        {estructural ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-muted-foreground">Longitud:</span>
                          <input 
                            type="number" 
                            value={longitud} 
                            onChange={(ev) => {
                              cambiarLongitudElemento(el, Number(ev.target.value) || 40);
                            }}
                            className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-center font-semibold outline-none text-xs text-foreground"
                          />
                        </div>
                        ) : <span className="text-xs font-semibold text-muted-foreground">Tamaño fijo</span>}

                        <button
                          type="button"
                          onClick={() => rotarSeleccionado(el.id, "elem")}
                          className="rounded bg-secondary border border-border px-2.5 py-1 text-xs font-bold hover:bg-accent flex items-center gap-1 text-foreground"
                        >
                          <RotateCw size={11} /> Girar
                        </button>
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (await confirmar({ titulo: "¿Eliminar este elemento?", textoConfirmar: "Eliminar", peligroso: true })) {
                              void borrarElemId(el.id);
                              setSelId(null);
                              setSelTipo(null);
                            }
                          }}
                          className="rounded bg-rose-50 border border-rose-200 text-rose-600 px-2.5 py-1 text-xs font-bold hover:bg-rose-100"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  }
                })() : (
                  <span className="text-xs text-muted-foreground font-semibold">
                    Selecciona una mesa o decoración para editarla
                  </span>
                )}
              </div>
              
              {/* Right Column: Cancelar & Guardar */}
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { 
                    setPosOverride({}); 
                    setDimOverride({});
                    setRotOverride({});
                    setSelId(null);
                    setSelTipo(null);
                    setEditandoPlano(false); 
                    void recargarMesas(); 
                    void recargarElementos(); 
                    toast.info("Diseño descartado");
                  }} 
                  className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs font-bold hover:bg-accent transition-all active:scale-95 text-foreground shadow-sm animate-fade-in"
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick={() => { 
                    setPosOverride({}); 
                    setDimOverride({});
                    setRotOverride({});
                    setSelId(null);
                    setSelTipo(null);
                    setEditandoPlano(false); 
                    void recargarMesas(); 
                    void recargarElementos(); 
                    toast.success("Diseño guardado correctamente");
                  }} 
                  className="rounded-lg bg-brand text-brand-foreground px-5 py-2.5 text-xs font-extrabold shadow hover:bg-brand-hover active:scale-95 transition-all animate-fade-in"
                >
                  Guardar
                </button>
              </div>
            </div>
          </footer>
        ) : (
          <footer className="flex-none border-t border-border bg-surface px-3 py-2.5 z-30 shadow-md">
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar w-full py-0.5">
              {(() => {
                const tieneCuenta = !!mesaSel && (totalesMesa[mesaSel.id] ?? 0) > 0;
                return (
                  <>
                    <button type="button" onClick={() => { setMesaSel(null); setMesaSelInfo(null); setEditandoPlano(true); setPaletaAbierta(true); }} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5">Editar salón</button>
                    <button type="button" onClick={abrirCajonManual} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5">Abrir cajón</button>
                    <button type="button" onClick={() => mesaSel && localAbrirNotaMesa(mesaSel)} disabled={!mesaSel} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Notas mesa</button>
                    <button type="button" onClick={() => mesaSel && dividirMesa(mesaSel)} disabled={!tieneCuenta} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Dividir pagos</button>
                    <button type="button" onClick={() => mesaSel && iniciarTraspaso(mesaSel, "LINEAS")} disabled={!tieneCuenta} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Trasp. líneas</button>
                    <button type="button" onClick={() => mesaSel && iniciarTraspaso(mesaSel, "MESA")} disabled={!tieneCuenta} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Trasp. mesa</button>
                    <button type="button" onClick={() => mesaSel && reimprimirCocinaMesa(mesaSel)} disabled={!tieneCuenta} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Re. cocina</button>
                    <button type="button" onClick={reprimirUltimo} disabled={!ultimoDoc} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Último doc.</button>
                    <button type="button" onClick={() => mesaSel && imprimirCuentaMesa(mesaSel)} disabled={!tieneCuenta} className="flex-shrink-0 whitespace-nowrap btn-ghost text-xs font-bold py-2 px-3.5 disabled:opacity-40">Imp. cuenta</button>
                    
                    <button type="button" onClick={() => mesaSel && abrirMesa(mesaSel)} disabled={!mesaSel} className="flex-shrink-0 whitespace-nowrap btn-primary text-xs font-black py-2 px-5 disabled:opacity-40">
                      Abrir Mesa
                    </button>
                    <button 
                      type="button" 
                      onClick={() => mesaSel && cobrarMesa(mesaSel)} 
                      disabled={!tieneCuenta || !puede("cobrar")} 
                      className="flex-shrink-0 whitespace-nowrap ml-auto rounded-lg bg-[#c46a2a] px-6 py-2 text-xs font-black text-white hover:bg-[#a3541c] active:scale-95 disabled:opacity-40 shadow-sm transition-all"
                    >
                      Cobrar
                    </button>
                  </>
                );
              })()}
            </div>
          </footer>
        )
      )}

      {/* MODAL: Editor de Mesa */}
      {mesaEdit && (() => {
        const libre = mesaLibreEdit(mesaEdit);
        const n = parseInt(numMesa, 10);
        const dupe = !!n && mesas.some((m) => m.room_id === vistaSala && m.id !== mesaEdit.id && parseInt(m.nombre.replace(/\D/g, ""), 10) === n);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setMesaEdit(null)}>
            <div className="w-full max-w-xs rounded-xl border border-border bg-card p-5 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 font-bold text-base border-b border-border pb-2 flex items-center justify-between">
                <span>Editar {mesaEdit.nombre}</span>
                <button type="button" onClick={() => setMesaEdit(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </h3>

              <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground" htmlFor="num-mesa">Número de mesa</label>
              <input id="num-mesa" value={numMesa} onChange={(e) => setNumMesa(e.target.value.replace(/\D/g, ""))} inputMode="numeric" disabled={!libre}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-lg font-bold tabular-nums outline-none focus:border-brand disabled:opacity-50" />
              {!libre && <p className="mt-1 text-[10px] text-amber-600 font-semibold">No se puede cambiar el número: tiene cuenta abierta.</p>}
              {libre && dupe && <p className="mt-1 text-[10px] text-rose-600 font-semibold">Ya existe la mesa {n} en esta sala.</p>}

              <div className="mb-1 mt-3 block text-xs font-bold uppercase text-muted-foreground">Forma y Capacidad</div>
              <div className="grid grid-cols-4 gap-1.5">
                {FORMAS_MESA.map((f: any) => {
                  const activa = (mesaEdit.sprite ?? null) === f.sprite && mesaEdit.capacidad === f.seats;
                  return (
                    <button 
                      type="button" 
                      key={f.file} 
                      onClick={() => setFormaMesa(f)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all ${activa ? "border-brand bg-brand/10 text-brand shadow-sm font-black" : "border-border hover:bg-accent text-muted-foreground"}`}
                    >
                      <img src={`/plano/${f.file}?v=${PLANO_VER}`} alt="" className="h-6 w-6 object-contain filter drop-shadow-sm" />
                      <span className="text-[8px] font-bold leading-none">{f.nombre}</span>
                    </button>
                  );
                })}
              </div>
              
              <button type="button" onClick={rotarMesaEdit} className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-semibold hover:bg-accent flex items-center justify-center gap-1.5">
                <RotateCw size={14} /> Girar 90°
              </button>

              <div className="mt-5 flex gap-2 border-t border-border pt-4">
                <button type="button" onClick={eliminarMesaEdit} disabled={!libre} title={libre ? "" : "No se puede borrar con cuenta abierta"} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/40 disabled:opacity-40">Borrar</button>
                <button type="button" onClick={() => setMesaEdit(null)} className="flex-1 rounded-lg border border-border py-2 text-xs font-bold hover:bg-accent">Cerrar</button>
                <button type="button" onClick={guardarMesaEdit} disabled={libre && dupe} className="flex-1 rounded-lg bg-brand py-2 text-xs font-extrabold text-brand-foreground disabled:opacity-40">Guardar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Editor de Objeto */}
      {elemEdit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setElemEdit(null)}>
          <div className="w-full max-w-xs rounded-xl border border-border bg-card p-5 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-bold text-base border-b border-border pb-2 flex items-center justify-between">
              <span>{elemEdit.etiqueta || "Objeto"}</span>
              <button type="button" onClick={() => setElemEdit(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </h3>
            
            <div className="mb-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-muted-foreground uppercase text-[10px]">Ancho</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setTamElem(-40, 0)} className="h-7 w-7 rounded-md border border-border hover:bg-accent font-bold flex items-center justify-center"><Minus size={14} /></button>
                  <span className="w-10 text-center font-bold tabular-nums">{elemEdit.ancho}px</span>
                  <button type="button" onClick={() => setTamElem(40, 0)} className="h-7 w-7 rounded-md border border-border hover:bg-accent font-bold flex items-center justify-center"><Plus size={14} /></button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-muted-foreground uppercase text-[10px]">Alto</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setTamElem(0, -20)} className="h-7 w-7 rounded-md border border-border hover:bg-accent font-bold flex items-center justify-center"><Minus size={14} /></button>
                  <span className="w-10 text-center font-bold tabular-nums">{elemEdit.alto}px</span>
                  <button type="button" onClick={() => setTamElem(0, 20)} className="h-7 w-7 rounded-md border border-border hover:bg-accent font-bold flex items-center justify-center"><Plus size={14} /></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 mt-4">
              <button type="button" onClick={rotarElemEdit} className="rounded-lg border border-border py-2 text-xs font-bold hover:bg-accent flex flex-col items-center gap-1">
                <RotateCw size={14} /> Girar
              </button>
              <button type="button" onClick={duplicarElem} className="rounded-lg border border-border py-2 text-xs font-bold hover:bg-accent flex flex-col items-center gap-1">
                <Copy size={14} /> Duplicar
              </button>
              <button type="button" onClick={eliminarElemEdit} className="rounded-lg border border-rose-300 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/40 flex flex-col items-center gap-1">
                <Trash size={14} /> Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nota de Mesa */}
      {modalNota && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setModalNota(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-bold text-base border-b border-border pb-2 flex items-center justify-between">
              <span>Nota para {mesaSel?.nombre}</span>
              <button type="button" onClick={() => setModalNota(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </h3>
            <textarea 
              value={notaTexto} 
              onChange={(e) => setNotaTexto(e.target.value)} 
              rows={4}
              placeholder="Ej.: Alergia a mariscos · Sin sal · Cumpleaños · Bebidas bien frías…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand shadow-inner" 
            />
            <div className="mt-4 flex gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setModalNota(false)} className="flex-1 rounded-lg border border-border py-2 text-xs font-bold hover:bg-accent">Cancelar</button>
              <button type="button" onClick={localGuardarNota} className="flex-1 rounded-lg bg-brand py-2 text-xs font-extrabold text-brand-foreground shadow hover:bg-brand-hover">Guardar Nota</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reservas de Mesa (Pulsación Larga) */}
      {reservaPop && (() => {
        const m = reservaPop;
        const list = reservasPorMesa[m.id] ?? [];
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setReservaPop(null)}>
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 font-bold text-base border-b border-border pb-2 flex items-center justify-between">
                <span>Reservas: {m.nombre}</span>
                <button type="button" onClick={() => setReservaPop(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </h3>

              {list.length > 0 && (
                <div className="mb-4 space-y-1.5 max-h-40 overflow-y-auto">
                  {list.map((r) => (
                    <div 
                      key={r.id} 
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${resForm.id === r.id ? "border-brand bg-brand/5 font-bold" : "border-border bg-muted/10"}`}
                    >
                      <button type="button" onClick={() => localEditarReserva(r)} className="min-w-0 flex-1 truncate text-left">
                        <b className="tabular-nums text-brand">{hhmm(r.fecha_hora)}</b> · {r.nombre || "Reserva"} <span className="text-muted-foreground font-medium">({r.comensales} pax)</span>
                      </button>
                      <button type="button" onClick={() => localQuitarReserva(r)} className="ml-2 text-rose-600 hover:underline font-bold text-[10px]">Eliminar</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 bg-muted/10 p-3 rounded-lg border border-border/50">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{resForm.id ? "Editar reserva" : "Nueva reserva"}</div>
                <input value={resForm.nombre} onChange={(e) => setResForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre cliente" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-brand" />
                <div className="flex gap-2">
                  <input type="time" aria-label="Hora" value={resForm.hora} onChange={(e) => setResForm((f) => ({ ...f, hora: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-brand" />
                  <input type="number" min={1} aria-label="Comensales" value={resForm.personas} onChange={(e) => setResForm((f) => ({ ...f, personas: e.target.value }))} placeholder="pax" className="w-20 flex-none rounded-lg border border-border bg-background px-3 py-1.5 text-center text-xs tabular-nums outline-none focus:border-brand" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => localGuardarReserva(m)} disabled={!resForm.hora} className="bg-brand text-brand-foreground flex-1 py-1.5 rounded-lg text-xs font-black shadow disabled:opacity-40">
                    {resForm.id ? "Guardar" : "Crear Reserva"}
                  </button>
                  {resForm.id && <button type="button" onClick={() => setResForm({ id: null, nombre: "", personas: String(m.capacidad || 2), hora: "" })} className="btn-ghost py-1.5 text-xs font-bold">Limpiar</button>}
                </div>
              </div>

              <button type="button" onClick={() => setReservaPop(null)} className="btn-ghost mt-4 w-full py-2 text-xs font-bold">Cerrar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Inline custom mini icons to avoid extra package imports
function ReceiptIcon(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="22" 
      height="22" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.75" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
      <path d="M16 8H8" />
      <path d="M16 12H8" />
      <path d="M13 16H8" />
    </svg>
  );
}
