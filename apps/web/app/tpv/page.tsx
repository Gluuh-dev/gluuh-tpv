"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { estacionDe, ESTACION_LABEL } from "../lib/estaciones";
import { ASSETS, ASSETS_LEGACY, FORMAS_MESA, assetPorId, mesaPorCapacidad, dim, type PlanoAsset } from "../lib/plano-assets";
import { leerBranding, BRANDING_DEFAULT, subirMedia, type Branding } from "../lib/branding";
import { imprimirTicket, imprimirComanda, resolverImpresora, formatearTicket, guardarTicketComoFichero, type TicketImpresion, type ConfigImpresion } from "../lib/impresion";
import { claveBase, claveDeLinea, claveParaAnadir } from "./clave-linea";
import { toast } from "sonner";
import { getSetting } from "../lib/settings";
import { exportarBackupLocal } from "../lib/backup-local";
import { BarraEstado } from "./components/BarraEstado";
import { ColumnaFunciones } from "./components/ColumnaFunciones";
import { ModificadoresModal, type SeleccionModificadores } from "./components/ModificadoresModal";
import { MenuModal } from "./components/MenuModal";
import { DividirCuentaModal } from "./components/DividirCuentaModal";
import { CobrarModal, type CobrarOpciones, type LineaPago } from "./components/CobrarModal";
import { CabeceraCuenta } from "./components/CabeceraCuenta";
import { BarraTotales } from "./components/BarraTotales";
import { FilaAccionesLinea } from "./components/FilaAccionesLinea";
import { TileProducto } from "./components/TileProducto";
import { TileCategoria } from "./components/TileCategoria";
import { TecladoTPV } from "./components/TecladoTPV";
import { RailSalas, type RailTab } from "./components/RailSalas";
import { useCatalogo, gruposDeProducto, type Family, type Cat, type Prod, type Formato, type ModGrupo, type ModOpcion } from "../lib/catalogo-store";
import { CLASES_FISCALES, ivaAuto } from "@/lib/fiscal-clases";
import { PlanoSvg } from "@/components/plano-svg";
import { Plus, Trash2, ChevronUp, ChevronDown, Search,
  Receipt, Store, Armchair, Sun, ShoppingBag, CalendarCheck,
  Beer, Coffee, CupSoda, Wine, Beef, Sandwich, Pizza, UtensilsCrossed, Croissant, CakeSlice, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { IconGift } from "@tabler/icons-react";

/* ─── Tipos ─── */
interface Mesa   { id: string; nombre: string; estado: string; room_id: string | null; pos_x: number | null; pos_y: number | null; capacidad: number; rotacion: number; sprite?: string | null }
interface Room   { id: string; nombre: string; orden: number; suelo: string | null }
interface Reserva { id: string; table_id: string | null; fecha_hora: string; comensales: number; estado: string; notas: string | null; nombre: string | null }
interface Elemento { id: string; room_id: string; tipo: string; etiqueta: string | null; icono: string | null; pos_x: number; pos_y: number; ancho: number; alto: number; rotacion: number }
interface Ticket {
  impuestos: { impuesto: string; desglose: { tipo: number; base: number; cuota: number }[]; importeTotal: number };
  verifactu: { huella: string; qrDataUrl: string; leyenda: string; qrUrl?: string };
  numSerieFactura: string;
}
// Menú/combo del tenant, mapeado a la forma que consume MenuModal (un paso por grupo).
interface MenuTPV {
  id: string; nombre: string; precio: number; clase_fiscal: string;
  grupos: { id: string; nombre: string; opciones: { id: string; nombre: string }[] }[];
}

/* ─── Helpers ─── */
const eur = (n: number) => Number(n).toFixed(2) + " €";
// Iniciales del camarero para la marca sutil de atribución por línea.
const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
const TERR: Record<string, string> = {
  PENINSULA_BALEARES: "PENINSULA_BALEARES", CANARIAS: "CANARIAS",
  CEUTA_MELILLA: "CEUTA_MELILLA", FORAL_PV: "PENINSULA_BALEARES", FORAL_NAVARRA: "PENINSULA_BALEARES",
};

// VERIFACTU DESACTIVADO: no se persiste ni encadena ninguna factura todavía.
// Pagos en modo PRUEBA (ficticios). Poner a true AL FINAL para activar la fiscalidad real.
const VERIFACTU_ACTIVO = false;

/* ─── Formas de pago (cobro) ─── */
interface FormaPagoTPV { id: string; nombre: string; tipo: string; abre_cajon: boolean; cuenta_arqueo: boolean }
// Fallback si la tabla payment_method aún no tiene filas.
const FORMAS_PAGO_FALLBACK: FormaPagoTPV[] = [
  { id: "efectivo", nombre: "Contado", tipo: "EFECTIVO", abre_cajon: true, cuenta_arqueo: true },
  { id: "tarjeta", nombre: "Tarjeta", tipo: "TARJETA", abre_cajon: false, cuenta_arqueo: true },
];
// payment_method.tipo (EFECTIVO/TARJETA/BIZUM/VALE/OTRO) → payment.metodo (CHECK del esquema).
function metodoPago(tipo?: string): "EFECTIVO" | "TARJETA" | "BIZUM" | "WALLET" {
  switch (tipo) {
    case "EFECTIVO": return "EFECTIVO";
    case "TARJETA": return "TARJETA";
    case "BIZUM": return "BIZUM";
    default: return "WALLET";   // VALE / OTRO / desconocido → monedero
  }
}

/* ─── Modo de pago extra ─── */
type ModoDescuento = { tipo: "PCT" | "EUR"; valor: number };

/* ─── Config de la botonera de productos (setting GLOBAL tpv.botones) ─── */
type BotonesConfig = {
  columnas: "auto" | 6 | 8 | 10;
  mostrarPrecio: boolean;
  mostrarFoto: boolean;
  tamanoTexto: "S" | "M" | "L";
};
const BOTONES_DEFAULT: BotonesConfig = { columnas: "auto", mostrarPrecio: true, mostrarFoto: true, tamanoTexto: "M" };

/* ─── Icono lucide por categoría (category.icono, mig. 0060): nombre → componente.
   Si el nombre no está en el mapa (o no hay icono), el tile muestra solo el texto. ─── */
const ICONOS_CAT: Record<string, LucideIcon> = {
  beer: Beer, coffee: Coffee, "cup-soda": CupSoda, wine: Wine, beef: Beef,
  sandwich: Sandwich, pizza: Pizza, "utensils-crossed": UtensilsCrossed,
  croissant: Croissant, "cake-slice": CakeSlice,
};

/* ─── Teclado keys ─── */
const KEYPAD_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["0", ",", "CLR"],
  ["DTO%", "DTO€", "PREC"],
  ["CAN", "", ""],
] as const;

export default function TPV() {
  const sb = supabaseBrowser();
  const router = useRouter();

  /* ── Datos ── */
  const [loading, setLoading]     = useState(true);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [locInfo, setLocInfo] = useState<{ nombre: string; cif: string; direccion: string }>({ nombre: "", cif: "", direccion: "" });
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [terminal, setTerminal] = useState("Navegador");
  const [marca, setMarca] = useState<Branding>(BRANDING_DEFAULT);
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");
  const [userId, setUserId]       = useState<string | null>(null);
  const [mesas, setMesas]         = useState<Mesa[]>([]);
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [reservas, setReservas]   = useState<Reserva[]>([]);
  const [elementos, setElementos] = useState<Elemento[]>([]);
  const [vistaSala, setVistaSala] = useState<string>("");  // room id, "BARRA", "RESERVAS" o "LLEVAR"
  // Navegación estilo Glop: false = pantalla Ticket (venta directa, por defecto al entrar);
  // true = navegando por el rail (plano de sala, barra o para llevar).
  const [navSala, setNavSala] = useState(false);
  // Mesa preseleccionada en el plano: 1er toque = ver cuenta; 2º toque = abrir en TPV.
  const [mesaSel, setMesaSel] = useState<Mesa | null>(null);
  const [mesaSelInfo, setMesaSelInfo] = useState<{ apertura: string; importe: number; comensales: number | null; nota?: string; lineas: { nombre: string; cantidad: number; precio: number }[] } | null>(null);
  // Edición del plano DENTRO del TPV: arrastrar mesas para recolocarlas.
  const [editandoPlano, setEditandoPlano] = useState(false);
  const [posOverride, setPosOverride] = useState<Record<string, { x: number; y: number }>>({});
  const [mesaEdit, setMesaEdit] = useState<Mesa | null>(null);   // mesa abierta en el editor
  const [numMesa, setNumMesa] = useState("");
  const [capMesa, setCapMesa] = useState(4);
  const [elemEdit, setElemEdit] = useState<Elemento | null>(null);   // objeto (barra/planta/…) en edición
  const [paletaAbierta, setPaletaAbierta] = useState(true);          // menú lateral de "añadir"
  const [paletaTab, setPaletaTab] = useState<"MESAS" | "OBJETOS">("MESAS");
  const [arrastrando, setArrastrando] = useState(false);   // arrastrando en edición → muestra papelera
  const [sobrePapel, setSobrePapel] = useState(false);     // el puntero está encima de la papelera
  const papeleraRef = useRef<HTMLDivElement | null>(null);
  const catScrollRef = useRef<HTMLDivElement | null>(null);   // scroll de categorías
  const prodScrollRef = useRef<HTMLDivElement | null>(null);  // scroll de productos
  // Traspaso entre mesas (estilo Glop): elige origen → botón → toca destino.
  const [modoTraspaso, setModoTraspaso] = useState<null | "MESA" | "LINEAS">(null);
  const [traspLineas, setTraspLineas] = useState<Record<string, number>>({});
  // Nota por mesa/pedido (alergias, avisos…).
  const [modalNota, setModalNota] = useState(false);
  const [notaTexto, setNotaTexto] = useState("");
  const [notaOrderId, setNotaOrderId] = useState<string | null>(null);
  const [notaMesa, setNotaMesa] = useState("");   // nota de la cuenta abierta en el TPV
  /* Para llevar (cuenta sin mesa, con nombre + teléfono) */
  const [llevar, setLlevar] = useState<{ nombre: string; telefono: string } | null>(null);
  const [llevarList, setLlevarList] = useState<{ id: string; cliente_nombre: string; cliente_telefono: string | null; total: number }[]>([]);
  const [nuevoLlevar, setNuevoLlevar] = useState({ nombre: "", telefono: "" });
  const [reservaPop, setReservaPop] = useState<Mesa | null>(null);  // popover de reservas de mesa
  const [resForm, setResForm] = useState<{ id: string | null; nombre: string; personas: string; hora: string }>({ id: null, nombre: "", personas: "", hora: "" });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const planoBoxRef = useRef<HTMLDivElement | null>(null);
  const [planoScale, setPlanoScale] = useState(1);   // escala del plano para ajustarse a pantalla
  // Catálogo desde el store Zustand (compartido, no re-fetch al cambiar de pantalla).
  const families = useCatalogo((s) => s.families);
  const cats     = useCatalogo((s) => s.cats);
  const prods    = useCatalogo((s) => s.prods);
  const prodCats = useCatalogo((s) => s.prodCats);   // categorías por producto (m2m Fase 1)
  const setProds = useCatalogo((s) => s.setProds);
  const [menus, setMenus] = useState<MenuTPV[]>([]);   // menús/combos del tenant (Carta → Menús); [] si no hay o falla la carga

  /* ── Operario activo (quién opera; persiste hasta "Salir") ── */
  const [operario, setOperario] = useState<{ id: string; nombre: string } | null>(null);
  const [operarios, setOperarios] = useState<{ id: string; nombre: string; rol: string }[]>([]);
  const [pinUser, setPinUser] = useState<{ id: string; nombre: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  /* ── Selección de contexto ── */
  const [mesa, setMesa]   = useState<Mesa | null>(null);
  const [barra, setBarra] = useState(false);
  /* Cuenta abierta de la mesa (un pedido reutilizable por mesa) + importes por mesa */
  const [ordenAbiertaId, setOrdenAbiertaId] = useState<string | null>(null);
  const [totalesMesa, setTotalesMesa] = useState<Record<string, number>>({});

  /* ── Funciones de cuenta (columna estilo Glop) ── */
  const [cliente, setCliente] = useState<{ id: string | null; nombre: string } | null>(null);
  const [comensales, setComensales] = useState(1);
  const [alias, setAlias] = useState("");   // etiqueta libre de la cuenta (estilo Glop)
  const [tipoOperacion, setTipoOperacion] = useState<"VENTA" | "INVITACION" | "AUTOCONSUMO">("VENTA");
  const [aparcados, setAparcados] = useState<{ id: string; aparcado_como: string | null; total: number; created_at: string }[]>([]);
  // Desglose de líneas por cuenta abierta, para las tarjetas de la vista Barra.
  const [aparcadosLineas, setAparcadosLineas] = useState<Record<string, { nombre: string; cantidad: number; total: number }[]>>({});
  const [ultimoDoc, setUltimoDoc] = useState<TicketImpresion | null>(null);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalPasarMesa, setModalPasarMesa] = useState(false);
  const [modalUtilidades, setModalUtilidades] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();   // toggle claro/oscuro desde Utilidades
  const [modalAparcados, setModalAparcados] = useState(false);
  const [modalDividir, setModalDividir] = useState(false);
  const [modalInvitar, setModalInvitar] = useState(false);
  const [invitadas, setInvitadas] = useState<Record<string, boolean>>({});   // líneas invitadas (precio 0)
  const [busqCliente, setBusqCliente] = useState("");
  const [clientesEnc, setClientesEnc] = useState<{ id: string; nombre: string; telefono: string | null }[]>([]);
  const [nuevoCli, setNuevoCli] = useState({ nombre: "", telefono: "" });
  const [pedirBorrar, setPedirBorrar] = useState(false);
  const [modalNuevoProd, setModalNuevoProd] = useState(false);
  const [nuevoProd, setNuevoProd] = useState({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: "", foto_url: "" });
  const [agotarPop, setAgotarPop] = useState<Prod | null>(null);
  const formatos  = useCatalogo((s) => s.formatos);
  const [formatoPop, setFormatoPop] = useState<Prod | null>(null);
  const gruposMod = useCatalogo((s) => s.gruposMod);
  const modById   = useCatalogo((s) => s.modById);
  const biblioteca   = useCatalogo((s) => s.biblioteca);     // grupos de biblioteca (0064, Fase 2)
  const asignaciones = useCatalogo((s) => s.asignaciones);   // herencia familia→categoría→producto
  // Grupos EFECTIVOS de un producto: los suyos + los heredados de la biblioteca.
  const gruposDe = (pid: string) =>
    gruposDeProducto({ gruposMod, biblioteca, asignaciones, prods, cats, prodCats }, pid);
  // reemplazar = clave de la línea que se está re-editando ("Com. y extra"); si va,
  // guardarModificadores re-clava esa línea en vez de añadir una nueva.
  const [modProd, setModProd] = useState<{ p: Prod; fid?: string; reemplazar?: string } | null>(null);
  const [menuAbierto, setMenuAbierto] = useState<MenuTPV | null>(null);   // MenuModal abierto (compón el menú por pasos)
  const [selectorMenus, setSelectorMenus] = useState(false);              // lista para elegir menú cuando hay ≥2
  const [pesoPop, setPesoPop] = useState<Prod | null>(null);
  const [pesoInput, setPesoInput] = useState("");
  const [cfgImpresion, setCfgImpresion] = useState<ConfigImpresion | null>(null);
  const [ordenFunciones, setOrdenFunciones] = useState<string[]>([]);   // orden configurable de la columna de funciones
  // Rail vertical de acciones de CUENTA: corre a altura completa (hermano de la columna
  // de contenido) y sus botones se estiran con flex-1 → sin altura fija ni hueco.
  const [permisos, setPermisos] = useState<Record<string, boolean>>({});
  const puede = (k: string) => permisos[k] !== false;   // ausente = permitido
  // Bloqueo = VELO (overlay que conserva la cuenta), NO logout. Combinable:
  // al cerrar cuenta y/o por inactividad; el botón "Bloquear" siempre disponible.
  const [bloqueoAlCobrar, setBloqueoAlCobrar] = useState(false);
  const [bloqueoInactividad, setBloqueoInactividad] = useState(false);
  const [bloqueoSegundos, setBloqueoSegundos] = useState(120);
  const [bloqueado, setBloqueado] = useState(false);   // velo puesto (la cuenta sigue viva debajo)
  const [botonesCfg, setBotonesCfg] = useState<BotonesConfig>(BOTONES_DEFAULT);   // presentación de los tiles de producto
  const [iconosCat, setIconosCat] = useState<Record<string, string>>({});   // category.icono (0060) → nombre de icono lucide

  /* ── Vista carta ── */
  const [catSel, setCatSel]   = useState<string | null>(null);
  const [vistaProds, setVistaProds] = useState(false);

  /* ── Comanda y ticket ── */
  const [comanda, setComanda] = useState<Record<string, number>>({});
  const [descuentos, setDescuentos] = useState<Record<string, ModoDescuento>>({});
  const [preciosManuales, setPreciosManuales] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  // Atribución por línea: quién (operario activo) añadió cada clave de comanda.
  const [anadidoPor, setAnadidoPor] = useState<Record<string, { id: string; nombre: string }>>({});
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy]     = useState(false);

  /* ── Teclado ── */
  const [buffer, setBuffer]   = useState("");
  const [modo, setModo] = useState<"UND" | "PREC" | "DTO%" | "DTO€">("UND");   // modo del teclado (lo refleja la barra)
  const [editando, setEditando] = useState(false);   // edición inline de la línea sel. (Glop): pulsar modo → teclear → volver a pulsar para confirmar
  // Refs con el valor "vivo" de buffer/modo: permiten memoizar el grid de productos
  // (handlers estables) sin que el buffer quede obsoleto al añadir con unidades.
  const bufferRef = useRef(buffer); bufferRef.current = buffer;
  const modoRef = useRef(modo); modoRef.current = modo;
  // Refs "vivas" para que addProd (capturado en el grid memoizado) decida la
  // clave con el estado ACTUAL de comanda/descuentos/precios, sin closures obsoletos.
  const comandaRef = useRef(comanda); comandaRef.current = comanda;
  const descuentosRef = useRef(descuentos); descuentosRef.current = descuentos;
  const preciosManualesRef = useRef(preciosManuales); preciosManualesRef.current = preciosManuales;
  // Operario "vivo": addProd va capturado en el grid memoizado; el ref permite sellar
  // la atribución con el camarero ACTIVO tras un cambio de operario bajo el velo.
  const operarioRef = useRef(operario); operarioRef.current = operario;
  const [lineaSel, setLineaSel] = useState<string | null>(null);

  /* ── Modal cobrar (unifica efectivo + mixto) + formas de pago ── */
  const [modalCobrar, setModalCobrar] = useState(false);
  const [formasPago, setFormasPago] = useState<FormaPagoTPV[]>(FORMAS_PAGO_FALLBACK);
  const [notasPrep, setNotasPrep] = useState<{ id: string; nombre: string; descripcion?: string | null }[]>([]);   // chips de anotación rápida (nota_preparacion); descripcion = grupo
  const [busqProd, setBusqProd] = useState("");   // buscador de producto (filtra el grid; cross-categoría)

  /* ── Carga inicial ── */
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      // Operario activo desde localStorage (persiste hasta "Salir") + lista de operarios
      try { const raw = localStorage.getItem("gluuh_operario"); if (raw) setOperario(JSON.parse(raw)); } catch { /* ignore */ }
      const { data: ops } = await sb.rpc("listar_operarios");
      setOperarios((ops as { id: string; nombre: string; rol: string }[]) ?? []);
      setMarca(await leerBranding(sb));
      const { data: loc } = await sb.from("location").select("id,territorio_fiscal,nombre,razon_social,cif,direccion").limit(1).maybeSingle();
      const { data: u }   = await sb.from("app_user").select("id").eq("auth_user_id", session.user.id).maybeSingle();
      setLocationId(loc?.id ?? null);
      const { data: tn } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      setTenantId((tn as { id: string } | null)?.id ?? null);
      setTerritorio(loc?.territorio_fiscal ?? "PENINSULA_BALEARES");
      setLocInfo({ nombre: loc?.razon_social ?? loc?.nombre ?? "", cif: loc?.cif ?? "", direccion: loc?.direccion ?? "" });
      setUserId(u?.id ?? null);
      // Catálogo: del store (solo fetchea la 1ª vez; navegación posterior = instantánea).
      await useCatalogo.getState().cargar(sb);
      setCatSel(useCatalogo.getState().cats[0]?.id ?? null);
      await recargarMesas();
      const [{ data: rms }, { data: rsv }, { data: els }] = await Promise.all([
        sb.from("room").select("id,nombre,orden,suelo").order("orden"),
        sb.from("reservation").select("id,table_id,fecha_hora,comensales,estado,notas,nombre").order("fecha_hora"),
        sb.from("plano_elemento").select("id,room_id,tipo,etiqueta,icono,pos_x,pos_y,ancho,alto,rotacion"),
      ]);
      setRooms((rms as Room[]) ?? []);
      setReservas((rsv as Reserva[]) ?? []);
      setElementos((els as Elemento[]) ?? []);
      setVistaSala((rms as Room[])?.[0]?.id ?? "");
      await recargarLlevar();
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  /* ── Formas de pago (cobro) + anotaciones rápidas (chips). Best-effort. ── */
  useEffect(() => {
    sb.from("payment_method").select("id,nombre,tipo,abre_cajon,cuenta_arqueo").order("orden")
      .then(({ data, error }) => { if (!error && data?.length) setFormasPago(data as FormaPagoTPV[]); });
    sb.from("nota_preparacion").select("id,nombre,descripcion").order("descripcion").order("nombre")
      .then(({ data, error }) => { if (!error && data) setNotasPrep(data as { id: string; nombre: string; descripcion?: string | null }[]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Siempre hay una línea marcada: si no hay selección (o la marcada ya no existe)
  // y quedan líneas, marca la última añadida.
  useEffect(() => {
    const keys = Object.keys(comanda);
    if (!keys.length) return;
    if (!lineaSel || comanda[lineaSel] === undefined) setLineaSel(keys[keys.length - 1]!);
  }, [comanda, lineaSel]);

  /* ── Menús/combos del tenant (Carta → Menús) para "Comp. menú". Best-effort:
       si algo falla, se queda vacío (el botón avisa que no hay menús). ── */
  useEffect(() => {
    (async () => {
      try {
        const [{ data: mm }, { data: gg }, { data: cc }] = await Promise.all([
          sb.from("menu").select("id,nombre,precio,clase_fiscal").eq("activo", true).order("orden"),
          sb.from("menu_group").select("id,menu_id,nombre,orden").order("orden"),
          sb.from("menu_choice").select("group_id,product_id,product(nombre)"),
        ]);
        const grupos = (gg ?? []) as { id: string; menu_id: string; nombre: string; orden: number }[];
        type Choice = { group_id: string; product_id: string; product: { nombre: string } | { nombre: string }[] | null };
        const choices = (cc ?? []) as Choice[];
        const nombreDe = (pr: Choice["product"]) => (Array.isArray(pr) ? pr[0]?.nombre : pr?.nombre) ?? "Producto";
        setMenus(((mm ?? []) as { id: string; nombre: string; precio: number; clase_fiscal: string }[]).map((m) => ({
          id: m.id, nombre: m.nombre, precio: Number(m.precio), clase_fiscal: m.clase_fiscal,
          grupos: grupos.filter((g) => g.menu_id === m.id).map((g) => ({
            id: g.id, nombre: g.nombre,
            opciones: choices.filter((c) => c.group_id === g.id).map((c) => ({ id: c.product_id, nombre: nombreDe(c.product) })),
          })),
        })));
      } catch { setMenus([]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Mapa color por categoría: color propio (0066) o el de su familia ── */
  const colorCat = useMemo(() => {
    const famMap: Record<string, string> = {};
    for (const f of families) famMap[f.id] = f.color;
    const out: Record<string, string> = {};
    for (const c of cats) out[c.id] = c.color || (c.family_id ? (famMap[c.family_id] ?? "") : "");
    return out;
  }, [families, cats]);

  /* ── Menús como pseudo-productos: el TPV clavea la línea del menú por su id (menu.id).
     Se fusionan SOLO en los resolvores locales (precio/nombre/producto) — NO en el store
     del catálogo, para no filtrarlos al kiosko/KDS. En la línea de cobro, productId sale
     null (no es un product real): así order_line se persiste con product_id NULL (columna
     nullable) sin violar la FK a product. El IVA del menú se resuelve por su clase fiscal ×
     territorio (ivaAuto), igual que un producto. ── */
  const menuIds = useMemo(() => new Set(menus.map((m) => m.id)), [menus]);
  const catalogoConMenus = useMemo<Prod[]>(
    () => [
      ...prods,
      ...menus.map((m) => ({
        id: m.id, nombre: m.nombre, precio: m.precio,
        tipo_impositivo: ivaAuto(m.clase_fiscal, territorio),
        category_id: null, estacion: "COCINA", foto_url: null, agotado_hasta: null, vendido_por_peso: false,
      })),
    ],
    [prods, menus, territorio],
  );

  /* ── Formatos: la comanda se clavea por "productId" o "productId|formatId" ── */
  // clave: "productId" · "productId|formatId" · "productId|fid|mod1,mod2" (fid puede ir vacío),
  // con posible sufijo de unicidad "#n" que se ignora aquí (claveBase lo quita).
  const prodDeKey = (key: string) => catalogoConMenus.find((x) => x.id === claveBase(key).split("|")[0]);
  // campo: usa nombre_ticket / nombre_cocina (0051) como nombre base cuando existan;
  // si no, cae al nombre normal (los sufijos de formato/peso/modificadores se conservan).
  function nombreDeKey(key: string, campo?: "nombre_ticket" | "nombre_cocina"): string {
    const [pid, fid, mods] = claveBase(key).split("|");
    const p = catalogoConMenus.find((x) => x.id === pid);
    if (!p) return "";
    const base = (campo && p[campo]) || p.nombre;
    let nombre: string;
    if (fid?.startsWith("@")) nombre = `${base} (${fid.slice(1)} kg)`;   // por peso
    else {
      const fmt = fid ? (formatos[p.id] ?? []).find((f) => f.id === fid) : undefined;
      nombre = fmt ? `${base} (${fmt.nombre})` : base;
    }
    if (mods) {
      const ns = mods.split(",").map((m) => modById[m]?.nombre).filter(Boolean);
      if (ns.length) nombre += ` · ${ns.join(", ")}`;
    }
    return nombre;
  }

  /* ── Precio efectivo (peso/formato + suplemento de modificadores + desc./precio manual) ── */
  const precioEfectivo = useMemo(() => (id: string): number => {
    const [pid, fid, mods] = claveBase(id).split("|");   // el "#n" no altera producto/precio base
    const prod = catalogoConMenus.find((x) => x.id === pid);
    if (!prod) return 0;
    let calc: number;
    if (fid?.startsWith("@")) calc = prod.precio * (parseFloat(fid.slice(1)) || 0);   // €/kg × peso
    else {
      const fmt = fid ? (formatos[pid!] ?? []).find((f) => f.id === fid) : undefined;
      calc = fmt ? fmt.precio : prod.precio;
    }
    if (mods) for (const m of mods.split(",")) calc += modById[m]?.precio_extra ?? 0;
    const base = preciosManuales[id] ?? calc;
    const desc = descuentos[id];
    if (!desc) return base;
    if (desc.tipo === "PCT") return Math.max(0, base * (1 - desc.valor / 100));
    return Math.max(0, base - desc.valor);
  }, [catalogoConMenus, formatos, modById, preciosManuales, descuentos]);

  /* ── Total (las líneas invitadas suman 0) ── */
  const total = useMemo(
    () => Object.entries(comanda).reduce((s, [id, q]) => s + (invitadas[id] ? 0 : precioEfectivo(id) * q), 0),
    [comanda, precioEfectivo, invitadas],
  );
  const unidades = Object.values(comanda).reduce((s, q) => s + q, 0);
  const logoTicket = marca.logo_ticket_url || marca.logo_url || undefined;
  // Desglose base/impuesto para MOSTRAR en el modal de cobro (impuesto INCLUIDO,
  // hacia atrás por el % de cada línea). Solo display: el desglose fiscal real lo
  // calcula /api/ticket (@gluuh/core) en el cobro; aquí no se recalcula fiscalidad.
  const desgloseCobro = useMemo(() => {
    let base = 0;
    for (const [id, q] of Object.entries(comanda)) {
      if (invitadas[id]) continue;
      const t = prodDeKey(id)?.tipo_impositivo ?? 0;
      base += (precioEfectivo(id) * q) / (1 + t / 100);
    }
    base = Math.round(base * 100) / 100;
    return { base, impuesto: Math.round((total - base) * 100) / 100 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comanda, invitadas, precioEfectivo, total]);

  // Tamaño real del plano de la sala activa (para escalarlo y que quepa en pantalla).
  const planoContent = useMemo(() => {
    let w = 800, h = 520;
    mesas.filter((m) => m.room_id === vistaSala).forEach((m, i) => {
      const d = dim(mesaPorCapacidad(m.capacidad || 4));
      const x = m.pos_x ?? (40 + (i % 4) * 220);
      const y = m.pos_y ?? (40 + Math.floor(i / 4) * 230);
      w = Math.max(w, x + d.w); h = Math.max(h, y + d.h);
    });
    elementos.filter((e) => e.room_id === vistaSala).forEach((e) => {
      w = Math.max(w, e.pos_x + e.ancho); h = Math.max(h, e.pos_y + e.alto);
    });
    return { w: w + 48, h: h + 48 };
  }, [mesas, elementos, vistaSala]);

  useEffect(() => {
    const el = planoBoxRef.current;
    if (!el) return;
    const calc = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const s = Math.min(r.width / planoContent.w, r.height / planoContent.h);
      setPlanoScale(Math.max(0.25, Math.min(2, s)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [planoContent, navSala, vistaSala]);

  /* ── Reserva próxima por mesa (para pintarla en el plano) ── */
  const reservasPorMesa = useMemo(() => {
    const out: Record<string, Reserva[]> = {};
    for (const r of reservas) {
      if (!r.table_id || r.estado === "CANCELADA") continue;
      (out[r.table_id] ??= []).push(r);
    }
    for (const k of Object.keys(out)) out[k]!.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
    return out;
  }, [reservas]);
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  /* ── Lineas para cobro y cocina (precio efectivo). id = clave de comanda;
       productId = producto real (para order_line, que puede llevar formato).
       El nombre aquí es el normal (UI/BD); la IMPRESIÓN usa nombre_ticket /
       nombre_cocina (0051) vía nombreDeKey(l.id, campo). ── */
  function lineasComanda() {
    return Object.entries(comanda).map(([id, cantidad]) => {
      const p = prodDeKey(id)!;
      // Los menús no son un product real: productId=null → order_line con product_id NULL (FK-safe).
      const productId: string | null = menuIds.has(p.id) ? null : p.id;
      return { id, productId, nombre: nombreDeKey(id), cantidad, precio: precioEfectivo(id), tipo: p.tipo_impositivo, estacion: estacionDe(p.estacion) };
    });
  }

  /* ── Integración con Gluuh Desktop (visor de cliente y backup nocturno) ── */
  useEffect(() => {
    window.gluuh?.publicarTicketVisor({
      lineas: lineasComanda().map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, importe: l.precio * l.cantidad })),
      total,
      cobrado: !!ticket,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comanda, descuentos, preciosManuales, ticket, total]);

  useEffect(() => {
    return window.gluuh?.onEvento((e) => {
      if (e.tipo === "backup") void exportarBackupLocal();
    });
  }, []);

  /* ── Login por PULSERA: el lector RFID "teclea" el UID + Enter (keyboard wedge).
       Activo solo en el gate (sin operario). Un burst rápido de teclas seguido de
       Enter se valida como pulsera; el gap >300ms reinicia el buffer. ── */
  // Activo en el gate (sin operario) Y con el VELO puesto: la pulsera re-identifica y
  // quita el velo (loginOperario fija el operario sin resetear → sigue la misma cuenta).
  useEffect(() => {
    if (operario && !bloqueado) return;
    let buffer = "";
    let ultimo = 0;
    const onKey = async (e: KeyboardEvent) => {
      const ahora = Date.now();
      if (ahora - ultimo > 300) buffer = "";
      ultimo = ahora;
      if (e.key === "Enter") {
        const codigo = buffer; buffer = "";
        if (codigo.length < 4) return;
        const { data } = await sb.rpc("validar_pulsera", { p_codigo: codigo });
        const u = (data as { id: string; nombre: string }[] | null)?.[0];
        if (u) loginOperario(u);
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operario, bloqueado]);

  /* ── Configuración de impresión (diseño del ticket + impresoras + rutas) ── */
  useEffect(() => {
    getSetting<ConfigImpresion>("impresion.config")
      .then((c) => { if (c) setCfgImpresion(c); })
      .catch(() => { /* sin config: diseño por defecto, sin enrutado */ });
    getSetting<string[]>("tpv.funciones.orden")
      .then((o) => { if (Array.isArray(o)) setOrdenFunciones(o); })
      .catch(() => { /* orden por defecto */ });
  }, []);

  /* ── Permisos del operario activo (qué puede hacer en el TPV) ── */
  useEffect(() => {
    if (!operario) { setPermisos({}); return; }
    sb.from("app_user").select("permisos").eq("id", operario.id).maybeSingle()
      .then(({ data }) => setPermisos((data?.permisos as Record<string, boolean>) ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operario]);

  /* ── Config del velo de bloqueo (flags alCobrar/inactividad; compat con { modo }) ── */
  useEffect(() => {
    getSetting<{ modo?: string; alCobrar?: boolean; inactividad?: boolean; segundos?: number }>("tpv.bloqueo").then((c) => {
      if (!c) return;
      if (c.alCobrar !== undefined || c.inactividad !== undefined) {
        setBloqueoAlCobrar(!!c.alCobrar); setBloqueoInactividad(!!c.inactividad);
      } else {   // formato antiguo { modo: al_cobrar | inactividad | manual }
        setBloqueoAlCobrar(c.modo === "al_cobrar"); setBloqueoInactividad(c.modo === "inactividad");
      }
      if (c.segundos) setBloqueoSegundos(c.segundos);
    }).catch(() => { /* sin config: velo solo manual */ });
  }, []);

  /* ── Config de la botonera de productos (columnas, foto, precio, tamaño de texto) ── */
  useEffect(() => {
    getSetting<Partial<BotonesConfig>>("tpv.botones")
      .then((c) => { if (c) setBotonesCfg((d) => ({ ...d, ...c })); })
      .catch(() => { /* sin config: defaults */ });
  }, []);

  /* ── Icono por categoría (category.icono, mig. 0060). Best-effort: si la columna
       no existe todavía, el select falla y se ignora (los tiles muestran solo el nombre). ── */
  useEffect(() => {
    sb.from("category").select("id,icono").then(({ data, error }) => {
      if (error || !data) return;
      setIconosCat(Object.fromEntries((data as { id: string; icono: string | null }[]).map((r) => [r.id, r.icono ?? ""])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Auto-velo por inactividad: tras N s sin tocar nada, pone el velo (conserva la cuenta) ── */
  useEffect(() => {
    if (!operario || !bloqueoInactividad || bloqueado) return;   // con el velo ya puesto no re-arma
    let timer: ReturnType<typeof setTimeout>;
    const reiniciar = () => { clearTimeout(timer); timer = setTimeout(() => setBloqueado(true), bloqueoSegundos * 1000); };
    reiniciar();
    window.addEventListener("pointerdown", reiniciar);
    window.addEventListener("keydown", reiniciar);
    return () => { clearTimeout(timer); window.removeEventListener("pointerdown", reiniciar); window.removeEventListener("keydown", reiniciar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operario, bloqueoInactividad, bloqueoSegundos, bloqueado]);

  /* ── Barra de estado: nombre del terminal (Desktop) y si hay caja abierta ── */
  useEffect(() => { setTerminal(window.gluuh?.device?.nombre ?? "Navegador"); }, []);
  useEffect(() => {
    sb.from("cash_session").select("id").is("cerrada_en", null).limit(1).maybeSingle()
      .then(({ data }) => setCajaAbierta(!!data));
    void recargarAparcados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Construye el ticket imprimible a partir del ticket fiscal actual ── */
  function construirTicketImpresion(t: Ticket): TicketImpresion {
    return {
      local: locInfo,
      contexto: mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Barra",
      operario: operario?.nombre,
      numSerieFactura: VERIFACTU_ACTIVO ? t.numSerieFactura : undefined,
      lineas: lineasComanda().map((l) => ({ cantidad: l.cantidad, nombre: nombreDeKey(l.id, "nombre_ticket"), importe: l.precio * l.cantidad })),
      desglose: t.impuestos.desglose.map((d) => ({
        etiqueta: `${t.impuestos.impuesto} ${d.tipo}% (base ${eur(d.base)})`,
        cuota: d.cuota,
      })),
      total: t.impuestos.importeTotal,
      qrUrl: VERIFACTU_ACTIVO ? t.verifactu.qrUrl : undefined,
      leyenda: VERIFACTU_ACTIVO ? t.verifactu.leyenda : undefined,
      huella: VERIFACTU_ACTIVO ? t.verifactu.huella : undefined,
      esPrueba: !VERIFACTU_ACTIVO,
    };
  }

  /* ── Impresión: ticket fiscal si ya se cobró; si no, la CUENTA (proforma) ── */
  function imprimirRecibo() {
    const diseno = cfgImpresion?.ticket ?? {};
    const destTicket = resolverImpresora(cfgImpresion, "TICKET_CLIENTE");
    if (!ticket && !unidades) return; // nada que imprimir
    const doc: TicketImpresion = ticket
      ? construirTicketImpresion(ticket)
      : {
          local: locInfo,
          contexto: mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Barra",
          operario: operario?.nombre,
          lineas: lineasComanda().map((l) => ({ cantidad: l.cantidad, nombre: nombreDeKey(l.id, "nombre_ticket"), importe: l.precio * l.cantidad })),
          desglose: [],
          total,
          proforma: true,
        };
    // Sin forma de imprimir en papel: escritorio SIN impresora enrutada. En navegador
    // se mantiene el diálogo del sistema (window.print vía imprimirTicket). Guardamos
    // la copia .txt para que la cuenta/ticket nunca se pierda.
    // ponytail: si en Desktop hay impresora enrutada pero el envío falla, imprimirTicket
    // ya guarda copia por su cuenta; esto cubre el hueco de "sin impresora configurada".
    if (typeof window !== "undefined" && window.gluuh && !destTicket) {
      const fecha = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      guardarTicketComoFichero(formatearTicket(doc, { ...diseno, anchoMm: diseno.anchoMm ?? 80 }), `${ticket ? "ticket" : "cuenta"}-${fecha}.txt`);
      toast.info("Sin impresora configurada: copia guardada como fichero");
      return;
    }
    void imprimirTicket(doc, diseno, destTicket, { logoUrl: logoTicket });
  }

  // Comandas de cocina/barra: al MARCHAR, imprime en cada impresora (por IP) solo
  // los artículos de su partida, sin precios. Solo en Gluuh Desktop (impresoras reales).
  function imprimirComandas() {
    if (typeof window === "undefined" || !window.gluuh) return;
    const contexto = mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Barra";
    for (const [estacion, tipoDoc] of [["COCINA", "COMANDA_COCINA"], ["BARRA", "COMANDA_BARRA"]] as const) {
      const lineas = lineasComanda()
        .filter((l) => l.estacion === estacion)
        .map((l) => ({ cantidad: l.cantidad, nombre: nombreDeKey(l.id, "nombre_cocina"), nota: notas[l.id]?.trim() || undefined }));
      if (!lineas.length) continue;
      void imprimirComanda({ contexto, operario: operario?.nombre, nota: notaMesa || undefined, lineas }, estacion, resolverImpresora(cfgImpresion, tipoDoc));
    }
  }

  /* ── Operaciones de comanda ── */
  // Añade `id` a la comanda y devuelve la clave REAL usada (puede llevar "#n" si
  // hubo que separar la línea para no contagiar un descuento/precio manual).
  const addProd = (id: string): string => {
    // Lee buffer/modo por ref (valor vivo) para que el grid memoizado no use closures obsoletos.
    const m = modoRef.current;
    const qty = m === "UND" ? (Number(bufferRef.current.replace(",", ".")) || 1) : 1;
    // ponytail: comandaRef puede quedar 1 tick atrás si se dispara 2 veces en el
    // mismo render; en ese caso peor caso = fusiona en la misma #n (uds sumadas), no rompe.
    const clave = claveParaAnadir(id, comandaRef.current, (k) =>
      descuentosRef.current[k] !== undefined || preciosManualesRef.current[k] !== undefined);
    setComanda((c) => ({ ...c, [clave]: (c[clave] ?? 0) + qty }));
    // Atribución: sella la línea con el operario ACTIVO (por ref: sobrevive al cambio de camarero).
    const op = operarioRef.current;
    if (op) setAnadidoPor((a) => ({ ...a, [clave]: { id: op.id, nombre: op.nombre } }));
    if (m === "UND") { setBuffer(""); setEditando(false); }
    setLineaSel(clave);   // al añadir, la línea nueva queda marcada
    return clave;
  };

  /* ── Teclado (con MODO: Unidad/Precio/Descuento reflejado en la barra) ── */
  // Aplica el valor tecleado a una línea según el modo. Devuelve true si aplicó.
  function aplicarModo(id: string, m: "UND" | "PREC" | "DTO%" | "DTO€"): boolean {
    const val = Number(buffer.replace(",", ".")) || 0;
    if (!val) return false;
    if (m === "DTO%") { if (!puede("descuento")) return false; setDescuentos((d) => ({ ...d, [id]: { tipo: "PCT", valor: val } })); }
    else if (m === "DTO€") { if (!puede("descuento")) return false; setDescuentos((d) => ({ ...d, [id]: { tipo: "EUR", valor: val } })); }
    else if (m === "PREC") { if (!puede("modificar")) return false; setPreciosManuales((mm) => ({ ...mm, [id]: val })); }
    else { if (!puede("modificar")) return false; setComanda((c) => ({ ...c, [id]: Math.max(1, Math.round(val)) })); }
    setBuffer(""); return true;
  }
  // Tap en una línea del ticket: la marca (siempre hay una marcada); cancela edición.
  function onLineaTap(id: string) {
    setEditando(false); setModo("UND"); setBuffer("");
    setLineaSel(id);
  }
  function handleKey(k: string) {
    if (k === "CLR") { setBuffer(""); setLineaSel(null); setModo("UND"); setEditando(false); return; }
    if (k === "CAN") {
      if (!lineaSel || !puede("modificar")) return;
      setComanda((c) => { const { [lineaSel]: _, ...r } = c; return r; });
      setDescuentos((d) => { const { [lineaSel]: _, ...r } = d; return r; });
      setPreciosManuales((m) => { const { [lineaSel]: _, ...r } = m; return r; });
      setNotas((n) => { const { [lineaSel]: _, ...r } = n; return r; });
      setInvitadas((v) => { const { [lineaSel]: _, ...r } = v; return r; });
      setLineaSel(null); setBuffer(""); setEditando(false); return;
    }
    if (k === "<") { setBuffer((b) => b.slice(0, -1)); return; }   // borrar último dígito
    // Teclas de MODO (Und/Precio/DTO): ARMAN el teclado (lo habilitan y pintan el
    // botón en verde). Con una línea seleccionada, editan su valor (recuadro + mensaje).
    // 2ª pulsación del MISMO modo → confirma lo tecleado (si hay línea) y desarma.
    if (k === "UND" || k === "PREC" || k === "DTO%" || k === "DTO€") {
      if (editando && modo === k) {
        if (lineaSel && buffer) aplicarModo(lineaSel, k);
        setEditando(false); setModo("UND"); setBuffer("");
        return;
      }
      setModo(k); setEditando(true); setBuffer("");
      return;
    }
    // Dígitos y coma
    if (k === "," && buffer.includes(",")) return;
    setBuffer((b) => b + k);
  }

  /* ── Backend ── */
  // Carga la lista de mesas + el importe de la cuenta abierta de cada una.
  async function recargarMesas() {
    const cols = "id,nombre,estado,room_id,pos_x,pos_y,capacidad,rotacion";
    const conSprite = await sb.from("restaurant_table").select(`${cols},sprite`).order("nombre");
    const sinSprite = conSprite.error ? await sb.from("restaurant_table").select(cols).order("nombre") : null;   // sprite aún sin migrar
    const mData = (conSprite.error ? sinSprite?.data : conSprite.data) as Mesa[] | null;
    const { data: ords } = await sb.from("sales_order").select("table_id,total,created_at")
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .not("table_id", "is", null);
    setMesas(mData ?? []);
    const ultima: Record<string, { total: number; created_at: string }> = {};
    for (const o of (ords ?? []) as { table_id: string; total: number; created_at: string }[]) {
      const prev = ultima[o.table_id];
      if (!prev || o.created_at > prev.created_at) ultima[o.table_id] = { total: Number(o.total), created_at: o.created_at };
    }
    const tot: Record<string, number> = {};
    for (const k of Object.keys(ultima)) tot[k] = ultima[k]!.total;
    setTotalesMesa(tot);
  }

  async function recargarReservas() {
    const { data } = await sb.from("reservation").select("id,table_id,fecha_hora,comensales,estado,notas,nombre").order("fecha_hora");
    setReservas((data as Reserva[]) ?? []);
  }

  async function recargarLlevar() {
    const { data } = await sb.from("sales_order")
      .select("id,cliente_nombre,cliente_telefono,total,created_at")
      .is("table_id", null).not("cliente_nombre", "is", null)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false });
    setLlevarList((data as { id: string; cliente_nombre: string; cliente_telefono: string | null; total: number; created_at: string }[]) ?? []);
  }

  function nuevoParaLlevar() {
    if (!nuevoLlevar.nombre.trim()) return;
    setNavSala(false);
    setMesa(null); setBarra(false); setTicket(null); setOrdenAbiertaId(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({});
    setBuffer(""); setLineaSel(null); setVistaProds(false);
    setLlevar({ nombre: nuevoLlevar.nombre.trim(), telefono: nuevoLlevar.telefono.trim() });
    setNuevoLlevar({ nombre: "", telefono: "" });
  }

  async function abrirLlevar(o: { id: string; cliente_nombre: string; cliente_telefono: string | null }) {
    setNavSala(false);
    setMesa(null); setBarra(false); setTicket(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({}); setAnadidoPor({});
    setBuffer(""); setLineaSel(null); setVistaProds(false);
    setLlevar({ nombre: o.cliente_nombre, telefono: o.cliente_telefono ?? "" });
    setOrdenAbiertaId(o.id);
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas").eq("order_id", o.id);
    const cmd: Record<string, number> = {}, pr: Record<string, number> = {}, nt: Record<string, string> = {};
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number; notas: string | null }[]) {
      if (!l.product_id || !prods.some((p) => p.id === l.product_id)) continue;
      cmd[l.product_id] = (cmd[l.product_id] ?? 0) + Number(l.cantidad);
      pr[l.product_id] = Number(l.precio_unitario);
      if (l.notas) nt[l.product_id] = l.notas;
    }
    setComanda(cmd); setPreciosManuales(pr); setNotas(nt);
  }

  /* ── Reserva de mesa por pulsación larga ── */
  function onPressStart(m: Mesa) {
    if (modoTraspaso) return;   // en traspaso, un toque selecciona destino (sin reservas)
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setResForm({ id: null, nombre: "", personas: String(m.capacidad || 2), hora: "" });
      setReservaPop(m);
    }, 450);
  }
  function onPressEnd() { if (pressTimer.current) clearTimeout(pressTimer.current); }
  function onMesaClick(m: Mesa) {
    if (longPressed.current) { longPressed.current = false; return; }  // fue pulsación larga
    if (modoTraspaso) { void ejecutarTraspaso(m); return; }   // traspaso: esta es la mesa destino
    if (mesaSel?.id === m.id) { abrirMesa(m); return; }   // 2º toque → abre la mesa en el TPV
    setMesaSel(m); void cargarPreviewMesa(m);             // 1er toque → muestra su cuenta
  }

  // Carga la cuenta de una mesa para la vista previa del plano (sin entrar al TPV).
  async function cargarPreviewMesa(m: Mesa) {
    setMesaSelInfo(null);
    const { data: ord } = await sb.from("sales_order")
      .select("id,total,comensales,created_at")
      .eq("table_id", m.id).in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) { setMesaSelInfo({ apertura: "", importe: 0, comensales: null, lineas: [] }); return; }
    const o = ord as { id: string; total: number; comensales: number | null; created_at: string };
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,precio_unitario").eq("order_id", o.id);
    const nq = await sb.from("sales_order").select("notas").eq("id", o.id).maybeSingle();   // best-effort
    setMesaSelInfo({
      apertura: hhmm(o.created_at), importe: Number(o.total), comensales: o.comensales,
      nota: (nq.data as { notas?: string } | null)?.notas ?? "",
      lineas: ((lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number }[]).map((l) => ({
        nombre: prods.find((p) => p.id === l.product_id)?.nombre ?? "Producto", cantidad: Number(l.cantidad), precio: Number(l.precio_unitario),
      })),
    });
  }
  function fechaHoy(hm: string): string {
    const [h, mi] = hm.split(":").map(Number);
    const d = new Date(); d.setHours(h ?? 0, mi ?? 0, 0, 0);
    return d.toISOString();
  }
  function editarReserva(r: Reserva) {
    setResForm({ id: r.id, nombre: r.nombre ?? "", personas: String(r.comensales), hora: hhmm(r.fecha_hora) });
  }
  async function guardarReserva(m: Mesa) {
    if (!resForm.hora) return;
    const datos = {
      fecha_hora: fechaHoy(resForm.hora),
      comensales: Number(resForm.personas) || (m.capacidad || 2),
      nombre: resForm.nombre.trim() || null,
    };
    if (resForm.id) await sb.from("reservation").update(datos).eq("id", resForm.id);
    else await sb.from("reservation").insert({ location_id: locationId, table_id: m.id, estado: "CONFIRMADA", ...datos });
    setResForm({ id: null, nombre: "", personas: String(m.capacidad || 2), hora: "" });
    await recargarReservas();
  }
  async function quitarReserva(r: Reserva) {
    await sb.from("reservation").delete().eq("id", r.id);
    setResForm({ id: null, nombre: "", personas: "", hora: "" });
    await recargarReservas();
  }

  // Crea o REUTILIZA la cuenta abierta de la mesa (un único pedido por mesa).
  async function crearOrden(estado: string, estadoPrep: string) {
    const lineas = lineasComanda().map((l) => ({
      product_id: l.productId, nombre: l.nombre,
      cantidad: l.cantidad,
      precio_unitario: invitadas[l.id] ? 0 : l.precio,   // invitada = 0 (queda registrada)
      tipo_impositivo: l.tipo,
      notas: [invitadas[l.id] ? "Invitación" : null, notas[l.id]?.trim() || null].filter(Boolean).join(" · ") || null,
      estacion: l.estacion,
      user_id: anadidoPor[l.id]?.id ?? operario?.id ?? userId,   // atribución por línea (col. user_id, mig. 0059)
    }));
    const totalRedondeado = Math.round(total * 100) / 100;

    // Campos de cuenta comunes (cliente, comensales, tipo de operación).
    const camposCuenta = {
      tipo_operacion: tipoOperacion,
      motivo_no_venta: tipoOperacion === "INVITACION" ? "Invitación" : tipoOperacion === "AUTOCONSUMO" ? "Consumo propio" : null,
      comensales: comensales || null,
      customer_id: cliente?.id ?? null,
      cliente_nombre: llevar?.nombre ?? cliente?.nombre ?? null,
      cliente_telefono: llevar?.telefono ?? null,
    };

    let orderId = ordenAbiertaId;
    if (orderId) {
      await sb.from("sales_order").update({ estado, estado_preparacion: estadoPrep, total: totalRedondeado, ...camposCuenta }).eq("id", orderId);
      await sb.from("order_line").delete().eq("order_id", orderId);
    } else {
      const { data: order } = await sb.from("sales_order").insert({
        location_id: locationId, table_id: mesa?.id ?? null, user_id: operario?.id ?? userId,
        canal: "TPV", estado, estado_preparacion: estadoPrep,
        total: totalRedondeado, client_id: crypto.randomUUID(), ...camposCuenta,
      }).select("id").single();
      if (!order) return null;
      orderId = (order as { id: string }).id;
      setOrdenAbiertaId(orderId);
    }
    if (lineas.length) {
      const filas = lineas.map((l) => ({ order_id: orderId, ...l }));
      const { error } = await sb.from("order_line").insert(filas);
      // Degradación: la columna user_id (mig. 0059) puede no existir aún. Si el insert
      // falla por eso, reintenta SIN user_id para no romper el guardado de la comanda.
      if (error) await sb.from("order_line").insert(filas.map(({ user_id, ...r }) => r));
    }
    return orderId;
  }

  // Carga la cuenta de una mesa en el estado (comanda, precios, notas, pedido).
  // Devuelve true si la mesa tenía cuenta abierta. NO cambia de pantalla.
  async function cargarCuentaMesa(m: Mesa): Promise<boolean> {
    setMesa(m); setBarra(false); setLlevar(null); setTicket(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({}); setAnadidoPor({});
    setLineaSel(null); setVistaProds(false); setOrdenAbiertaId(null);

    const { data: ord } = await sb.from("sales_order")
      .select("id").eq("table_id", m.id)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) { setNotaMesa(""); return false; }
    const oid = (ord as { id: string }).id;
    setOrdenAbiertaId(oid);
    const nq = await sb.from("sales_order").select("notas").eq("id", oid).maybeSingle();   // best-effort
    setNotaMesa((nq.data as { notas?: string } | null)?.notas ?? "");

    // Cada order_line = su propia línea de comanda (clave única base#n), preservando el
    // precio exacto (dto por línea), la nota y la atribución. user_id puede no existir (0059).
    const conUser = await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas,user_id").eq("order_id", oid);
    const lns = conUser.error
      ? (await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas").eq("order_id", oid)).data
      : conUser.data;
    const comandaCargada: Record<string, number> = {};
    const precios: Record<string, number> = {};
    const notasCargadas: Record<string, string> = {};
    const autores: Record<string, { id: string; nombre: string }> = {};
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number; notas: string | null; user_id?: string | null }[]) {
      if (!l.product_id || !prods.some((p) => p.id === l.product_id)) continue;
      // clave única por order_line: fuerza #n cuando el producto ya está (una línea por fila).
      const clave = claveParaAnadir(l.product_id, comandaCargada, () => true);
      comandaCargada[clave] = Number(l.cantidad);
      precios[clave] = Number(l.precio_unitario);   // preserva precio/dto exacto de la línea
      if (l.notas) notasCargadas[clave] = l.notas;
      if (l.user_id) autores[clave] = { id: l.user_id, nombre: operarios.find((o) => o.id === l.user_id)?.nombre ?? "" };
    }
    setComanda(comandaCargada);
    setPreciosManuales(precios);
    setNotas(notasCargadas);
    setAnadidoPor(autores);
    return true;
  }

  // Abre una mesa en el TPV (carga su cuenta y va a la pantalla de venta).
  async function abrirMesa(m: Mesa) {
    setNavSala(false); setMesaSel(null); setMesaSelInfo(null); setBuffer("");
    await cargarCuentaMesa(m);
  }

  // Impr. cuenta directa desde el plano: proforma de la mesa sin entrar al TPV.
  async function imprimirCuentaMesa(m: Mesa) {
    const { data: ord } = await sb.from("sales_order").select("id,total")
      .eq("table_id", m.id).in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) return;
    const o = ord as { id: string; total: number };
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,precio_unitario").eq("order_id", o.id);
    const lineas = ((lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number }[])
      .map((l) => ({ cantidad: Number(l.cantidad), nombre: prods.find((p) => p.id === l.product_id)?.nombre ?? "Producto", importe: Number(l.cantidad) * Number(l.precio_unitario) }));
    void imprimirTicket({ local: locInfo, contexto: m.nombre, operario: operario?.nombre, lineas, desglose: [], total: Number(o.total), proforma: true }, cfgImpresion?.ticket ?? {}, resolverImpresora(cfgImpresion, "TICKET_CLIENTE"), { logoUrl: logoTicket });
  }

  // Re. cocina directa desde el plano: reimprime la comanda de la mesa por partida.
  async function reimprimirCocinaMesa(m: Mesa) {
    if (typeof window === "undefined" || !window.gluuh) return;
    const { data: ord } = await sb.from("sales_order").select("id")
      .eq("table_id", m.id).in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) return;
    const oid = (ord as { id: string }).id;
    const nq = await sb.from("sales_order").select("notas").eq("id", oid).maybeSingle();   // best-effort
    const notaM = (nq.data as { notas?: string } | null)?.notas || undefined;
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,notas").eq("order_id", oid);
    const filas = ((lns ?? []) as { product_id: string | null; cantidad: number; notas: string | null }[]);
    for (const [estacion, tipoDoc] of [["COCINA", "COMANDA_COCINA"], ["BARRA", "COMANDA_BARRA"]] as const) {
      const lineas = filas
        .filter((l) => (prods.find((p) => p.id === l.product_id)?.estacion ?? "COCINA") === estacion)
        .map((l) => ({ cantidad: Number(l.cantidad), nombre: prods.find((p) => p.id === l.product_id)?.nombre ?? "Producto", nota: l.notas?.trim() || undefined }));
      if (!lineas.length) continue;
      void imprimirComanda({ contexto: m.nombre, operario: operario?.nombre, nota: notaM, lineas }, estacion, resolverImpresora(cfgImpresion, tipoDoc));
    }
  }

  // Dividir / traspasar la cuenta de una mesa directamente desde el plano:
  // cargan la cuenta y abren el modal correspondiente (sin ir al TPV).
  async function dividirMesa(m: Mesa) {
    if (!puede("cobrar") || !(await cargarCuentaMesa(m))) return;
    setModalDividir(true);
  }
  async function traspMesa(m: Mesa) {
    if (await cargarCuentaMesa(m)) setModalPasarMesa(true);
  }

  /* ── Traspaso entre mesas (estilo Glop) ── */
  const ESTADOS_ABIERTOS = ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"];
  async function recomputarTotal(orderId: string) {
    const { data } = await sb.from("order_line").select("cantidad,precio_unitario").eq("order_id", orderId);
    const t = ((data ?? []) as { cantidad: number; precio_unitario: number }[]).reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_unitario), 0);
    await sb.from("sales_order").update({ total: Math.round(t * 100) / 100 }).eq("id", orderId);
  }
  // Carga la cuenta de origen y entra en modo traspaso; luego se toca el destino.
  async function iniciarTraspaso(m: Mesa, modo: "MESA" | "LINEAS") {
    if (!(await cargarCuentaMesa(m))) return;   // mesa libre: nada que pasar
    setTraspLineas({}); setModoTraspaso(modo);
  }
  function cancelarTraspaso() { setModoTraspaso(null); setTraspLineas({}); reset(); }
  async function ejecutarTraspaso(destino: Mesa) {
    const origenId = ordenAbiertaId, modo = modoTraspaso;
    if (!origenId || !modo || destino.id === mesa?.id) { cancelarTraspaso(); return; }
    setBusy(true);
    try {
      // Pedido destino: reutiliza el abierto o crea uno nuevo.
      const dq = await sb.from("sales_order").select("id").eq("table_id", destino.id).in("estado", ESTADOS_ABIERTOS).order("created_at", { ascending: false }).limit(1).maybeSingle();
      let destId = (dq.data as { id: string } | null)?.id;
      if (!destId) {
        const { data } = await sb.from("sales_order").insert({ location_id: locationId, table_id: destino.id, user_id: operario?.id ?? userId, canal: "TPV", estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: 0, client_id: crypto.randomUUID() }).select("id").single();
        destId = (data as { id: string } | null)?.id;
      }
      if (!destId) { cancelarTraspaso(); return; }
      // Mueve líneas (enteras o las unidades elegidas).
      const { data: srcLns } = await sb.from("order_line").select("id,product_id,nombre,cantidad,precio_unitario,tipo_impositivo,notas,estacion").eq("order_id", origenId);
      for (const l of (srcLns ?? []) as { id: string; product_id: string | null; nombre: string; cantidad: number; precio_unitario: number; tipo_impositivo: string; notas: string | null; estacion: string }[]) {
        const mover = modo === "LINEAS" ? Math.min(Number(l.cantidad), traspLineas[l.product_id ?? ""] ?? 0) : Number(l.cantidad);
        if (mover <= 0) continue;
        await sb.from("order_line").insert({ order_id: destId, product_id: l.product_id, nombre: l.nombre, cantidad: mover, precio_unitario: l.precio_unitario, tipo_impositivo: l.tipo_impositivo, notas: l.notas, estacion: l.estacion });
        if (mover >= Number(l.cantidad)) await sb.from("order_line").delete().eq("id", l.id);
        else await sb.from("order_line").update({ cantidad: Number(l.cantidad) - mover }).eq("id", l.id);
      }
      await recomputarTotal(destId);
      await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", destino.id);
      // Si el origen se queda vacío, se anula y se libera la mesa.
      const { data: resto } = await sb.from("order_line").select("id").eq("order_id", origenId).limit(1);
      if (!resto?.length) {
        await sb.from("sales_order").update({ estado: "ANULADA", total: 0 }).eq("id", origenId);
        if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      } else {
        await recomputarTotal(origenId);
      }
      setModoTraspaso(null); setTraspLineas({});
      await recargarMesas();
      reset();
    } finally { setBusy(false); }
  }
  async function cobrarMesa(m: Mesa) {
    if (!puede("cobrar") || !(await cargarCuentaMesa(m))) return;
    setModalCobrar(true);
  }
  // Nota de la mesa: sobre el pedido abierto (best-effort; la columna puede faltar).
  async function abrirNotaMesa(m: Mesa) {
    const { data: ord } = await sb.from("sales_order").select("id").eq("table_id", m.id)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const oid = (ord as { id: string } | null)?.id;
    if (!oid) return;   // mesa libre: sin cuenta donde anotar
    setNotaOrderId(oid);
    const nq = await sb.from("sales_order").select("notas").eq("id", oid).maybeSingle();
    setNotaTexto((nq.data as { notas?: string } | null)?.notas ?? "");
    setModalNota(true);
  }
  async function guardarNota() {
    if (notaOrderId) await sb.from("sales_order").update({ notas: notaTexto }).eq("id", notaOrderId);
    setModalNota(false);
  }

  async function enviarCocina(estadoPrep: string) {
    if (!unidades) { toast.warning("No hay nada que enviar"); return; }
    setBusy(true);
    try {
      await crearOrden("ENVIADA_COCINA", estadoPrep);
      if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      const marchar = estadoPrep === "EN_PREPARACION";
      if (marchar) imprimirComandas();   // solo imprime en Gluuh Desktop; el pedido va al KDS igualmente
      await recargarMesas();
      reset();
      // Feedback: aunque no haya impresora, el pedido ya está en la pantalla de cocina (KDS).
      if (!marchar) toast.success("Enviado a cocina");
      else if (typeof window !== "undefined" && window.gluuh) toast.success("Marchado a cocina/barra");
      else toast.success("Sin impresora: enviado a la pantalla de cocina");
    } finally { setBusy(false); }
  }

  // Guarda la cuenta abierta y limpia la pantalla. Mesa/llevar se auto-marchan;
  // un Ticket directo con líneas se aparca como cuenta de barra para no perderlo.
  async function guardarActual() {
    if (unidades > 0) {
      setBusy(true);
      try {
        const orderId = await crearOrden("ENVIADA_COCINA", "EN_PREPARACION");
        if (mesa || llevar) {
          // Auto-marchar: al salir sin marchar, se envía a cocina/barra.
          if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
          imprimirComandas();
        } else if (orderId) {
          // Ticket directo → cuenta abierta de barra (aparcada), recuperable desde «Barra».
          const etiqueta = alias.trim() || cliente?.nombre || `Barra ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
          await sb.from("sales_order").update({ aparcado_como: etiqueta, table_id: null }).eq("id", orderId);
        }
        await Promise.all([recargarMesas(), recargarLlevar(), recargarAparcados()]);
      } finally { setBusy(false); }
    }
    reset();
  }

  async function volver() { await guardarActual(); setNavSala(false); }

  // Rail lateral estilo Glop. "ticket" = venta actual; el resto navega guardando
  // la cuenta en curso y mostrando el plano/tarjetas de ese destino.
  function irASala(destino: { tipo: "ticket" } | { tipo: "barra" } | { tipo: "llevar" } | { tipo: "room"; id: string }) {
    setMesaSel(null); setMesaSelInfo(null); setEditandoPlano(false); setPosOverride({});
    if (destino.tipo === "ticket") {
      if (!mesa && !llevar) setBarra(true);   // Ticket vacío = venta directa
      setNavSala(false);
      return;
    }
    // Cambia de vista AL INSTANTE (sin esperar); la cuenta en curso se aparca en 2º plano.
    setNavSala(true);
    if (destino.tipo === "barra") setVistaSala("BARRA");
    else if (destino.tipo === "llevar") setVistaSala("LLEVAR");
    else setVistaSala(destino.id);
    void guardarActual();
  }

  // Cobro real: /api/ticket (desglose) → crearOrden COBRADA → payment por línea →
  // (VERIFACTU si activo) → ticket imprimible. `filas` = pagos ya resueltos
  // (metodo del esquema + importe + propina). NO recalcula fiscalidad.
  async function cobrar(
    filas: { metodo: string; importe: number; propina: number }[],
    opts: { abrirCajon?: boolean; imprimir?: boolean } = {},
  ) {
    if (!unidades) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          territorio: TERR[territorio] ?? "PENINSULA_BALEARES",
          lineas: lineasComanda().map((l) => ({ precio: l.precio, tipo: l.tipo, cantidad: l.cantidad })),
        }),
      });
      const t = await res.json();
      const orderId = await crearOrden("COBRADA", "ENTREGADO");
      // Invitación y consumo propio se REGISTRAN (crearOrden aplica tipo_operacion)
      // pero no generan cobro ni factura: no se inserta payment ni se factura.
      if (orderId && tipoOperacion === "VENTA") {
        const pagos = filas
          .map((p) => ({ metodo: p.metodo, importe: Math.round(p.importe * 100) / 100, propina: Math.round((p.propina || 0) * 100) / 100 }))
          .filter((p) => p.importe > 0 || p.propina > 0);
        const finales = pagos.length ? pagos : [{ metodo: "EFECTIVO", importe: Math.round(total * 100) / 100, propina: 0 }];
        const { error: payErr } = await sb.from("payment").insert(
          finales.map((p) => ({ order_id: orderId, ...p, client_id: crypto.randomUUID() })),
        );
        if (payErr) console.error("No se registró el pago:", payErr.message);
        // Cajón: abre si alguna forma usada lo pide (abre_cajon); si no, por efectivo.
        if (opts.abrirCajon ?? finales.some((p) => p.metodo === "EFECTIVO")) void window.gluuh?.abrirCajon();
      }
      if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      setOrdenAbiertaId(null);
      await recargarMesas();
      await recargarLlevar();

      // ── Persistencia VERIFACTU: DESACTIVADA hasta el final (pagos en prueba) ──
      if (VERIFACTU_ACTIVO && tipoOperacion === "VENTA") {
        try {
          const tok = (await sb.auth.getSession()).data.session?.access_token;
          const fr = await fetch("/api/factura", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
            },
            body: JSON.stringify({
              orderId,
              lineas: lineasComanda().map((l) => ({ precio: l.precio, tipo: l.tipo, cantidad: l.cantidad })),
            }),
          });
          const fj = await fr.json();
          if (fj?.ok) {
            t.numSerieFactura = fj.numSerieFactura ?? t.numSerieFactura;
            if (fj.qrDataUrl) t.verifactu.qrDataUrl = fj.qrDataUrl;
            // qrUrl es el que imprime la térmica (ESC/POS); sin esto el QR del
            // ticket físico llevaría el número provisional de /api/ticket.
            if (fj.qrUrl) t.verifactu.qrUrl = fj.qrUrl;
            if (fj.huella) t.verifactu.huella = fj.huella;
          }
        } catch {
          // best-effort: si /api/factura falla, el ticket sigue con /api/ticket
        }
      }

      setTicket(t);
      setUltimoDoc(construirTicketImpresion(t));
      // F11 (Cobrar+Imprimir): imprime el recibo con el logo de tickets.
      if (opts.imprimir) void imprimirTicket(construirTicketImpresion(t), cfgImpresion?.ticket ?? {}, resolverImpresora(cfgImpresion, "TICKET_CLIENTE"), { logoUrl: logoTicket });
    } finally { setBusy(false); }
  }

  // Cobro desde CobrarModal: mapea las líneas de pago (payment_method) al esquema
  // de `payment`, reparte propina/descuento y decide el cajón por abre_cajon.
  function cobrarDesdeModal(pagos: LineaPago[], opts: CobrarOpciones) {
    setModalCobrar(false);
    const due = Math.max(0, Math.round((total + (opts.propina || 0) - (opts.descuento || 0)) * 100) / 100);
    const prop = Math.round((opts.propina || 0) * 100) / 100;
    // Reparte los importes hasta cubrir el debido (el exceso = cambio, no se registra).
    let restante = due;
    const filas: { metodo: string; importe: number; propina: number }[] = [];
    for (const p of pagos) {
      const imp = Math.min(Math.round(p.importe * 100) / 100, restante);
      if (imp <= 0) continue;
      const forma = formasPago.find((f) => f.id === p.formaPagoId);
      filas.push({ metodo: metodoPago(forma?.tipo), importe: imp, propina: 0 });
      restante = Math.round((restante - imp) * 100) / 100;
    }
    // La propina va aparte: se descuenta del primer importe para no doble-contarla.
    const primera = filas[0];
    if (prop > 0 && primera) { primera.propina = prop; primera.importe = Math.max(0, Math.round((primera.importe - prop) * 100) / 100); }
    // ponytail: un descuento global de cobro se refleja en los importes cobrados
    // (due = total − descuento) pero NO se prorratea en el desglose fiscal (que sigue
    // saliendo íntegro de /api/ticket). Prorratear por línea antes de activar VERIFACTU.
    const abrirCajon = pagos.some((p) => formasPago.find((f) => f.id === p.formaPagoId)?.abre_cajon) || undefined;
    void cobrar(filas, { abrirCajon, imprimir: opts.imprimir });
  }

  // Dividir cuenta (DividirCuentaModal): un sales_order por documento. El doc 1 se
  // queda en el pedido/mesa original; el resto se abren como cuentas de barra
  // aparcadas ("Mesa X (2)"…), cobrables por separado desde «Barra» (guía 12 §6).
  async function dividirAceptar(docs: { lineas: { id: string; uds: number }[] }[]) {
    setModalDividir(false);
    const clean = docs.filter((d) => d.lineas.length);
    if (clean.length <= 1) { reset(); return; }   // sin reparto real: no se divide
    setBusy(true);
    try {
      const meta: Record<string, ReturnType<typeof lineasComanda>[number]> = {};
      for (const l of lineasComanda()) meta[l.id] = l;
      const camposCuenta = {
        tipo_operacion: tipoOperacion,
        motivo_no_venta: tipoOperacion === "INVITACION" ? "Invitación" : tipoOperacion === "AUTOCONSUMO" ? "Consumo propio" : null,
        comensales: comensales || null,
        customer_id: cliente?.id ?? null,
        cliente_nombre: llevar?.nombre ?? cliente?.nombre ?? null,
        cliente_telefono: llevar?.telefono ?? null,
      };
      const totalDe = (asign: { id: string; uds: number }[]) =>
        Math.round(asign.reduce((s, a) => s + (invitadas[a.id] ? 0 : (meta[a.id]?.precio ?? 0)) * a.uds, 0) * 100) / 100;
      const filasDe = (asign: { id: string; uds: number }[]) => {
        const out: { product_id: string | null; nombre: string; cantidad: number; precio_unitario: number; tipo_impositivo: number; notas: string | null; estacion: string }[] = [];
        for (const a of asign) {
          const m = meta[a.id]; if (!m) continue;
          out.push({ product_id: m.productId, nombre: m.nombre, cantidad: a.uds, precio_unitario: invitadas[a.id] ? 0 : m.precio, tipo_impositivo: m.tipo, notas: notas[a.id]?.trim() || null, estacion: m.estacion });
        }
        return out;
      };

      // Doc 1 → pedido original (reutiliza el abierto o crea uno con SOLO sus líneas).
      const doc0 = clean[0]!;
      let baseId = ordenAbiertaId;
      if (baseId) {
        await sb.from("sales_order").update({ estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: totalDe(doc0.lineas), ...camposCuenta }).eq("id", baseId);
        await sb.from("order_line").delete().eq("order_id", baseId);
      } else {
        const { data } = await sb.from("sales_order").insert({ location_id: locationId, table_id: mesa?.id ?? null, user_id: operario?.id ?? userId, canal: "TPV", estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: totalDe(doc0.lineas), client_id: crypto.randomUUID(), ...camposCuenta }).select("id").single();
        baseId = (data as { id: string } | null)?.id ?? null;
      }
      if (baseId) { const f0 = filasDe(doc0.lineas); if (f0.length) await sb.from("order_line").insert(f0.map((l) => ({ order_id: baseId, ...l }))); }

      // Docs 2.. → nuevas cuentas de barra aparcadas (cobrables por separado).
      for (let i = 1; i < clean.length; i++) {
        const etiqueta = `${mesa?.nombre ?? llevar?.nombre ?? "Ticket"} (${i + 1})`;
        const { data } = await sb.from("sales_order").insert({ location_id: locationId, table_id: null, user_id: operario?.id ?? userId, canal: "TPV", estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: totalDe(clean[i]!.lineas), client_id: crypto.randomUUID(), aparcado_como: etiqueta, ...camposCuenta }).select("id").single();
        const nid = (data as { id: string } | null)?.id;
        if (nid) { const fl = filasDe(clean[i]!.lineas); if (fl.length) await sb.from("order_line").insert(fl.map((l) => ({ order_id: nid, ...l }))); }
      }
      if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      await Promise.all([recargarMesas(), recargarLlevar(), recargarAparcados()]);
      reset();
    } finally { setBusy(false); }
  }

  /* ── Funciones de cuenta (columna estilo Glop) ── */

  // Carga las líneas de un pedido existente en la comanda de pantalla.
  async function cargarLineas(orderId: string) {
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas").eq("order_id", orderId);
    const cmd: Record<string, number> = {}, pr: Record<string, number> = {}, nt: Record<string, string> = {};
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number; notas: string | null }[]) {
      if (!l.product_id || !prods.some((p) => p.id === l.product_id)) continue;
      cmd[l.product_id] = (cmd[l.product_id] ?? 0) + Number(l.cantidad);
      pr[l.product_id] = Number(l.precio_unitario);
      if (l.notas) nt[l.product_id] = l.notas;
    }
    setComanda(cmd); setPreciosManuales(pr); setNotas(nt);
  }

  // Cuentas abiertas de barra: pedidos sin mesa y sin cliente (los de "para llevar"
  // llevan cliente_nombre). Incluye aparcados y los que están en cocina, para que en
  // «Barra» se vea todo lo comandado, no solo lo aparcado a mano.
  async function recargarAparcados() {
    const { data } = await sb.from("sales_order").select("id,aparcado_como,total,created_at")
      .is("table_id", null).is("cliente_nombre", null)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false });
    const lista = (data as { id: string; aparcado_como: string | null; total: number; created_at: string }[]) ?? [];
    setAparcados(lista);
    const ids = lista.map((o) => o.id);
    if (ids.length === 0) { setAparcadosLineas({}); return; }
    const { data: lns } = await sb.from("order_line")
      .select("order_id,product_id,cantidad,precio_unitario").in("order_id", ids);
    const map: Record<string, { nombre: string; cantidad: number; total: number }[]> = {};
    for (const l of (lns ?? []) as { order_id: string; product_id: string | null; cantidad: number; precio_unitario: number }[]) {
      (map[l.order_id] ??= []).push({
        nombre: prods.find((p) => p.id === l.product_id)?.nombre ?? "Producto",
        cantidad: Number(l.cantidad), total: Number(l.cantidad) * Number(l.precio_unitario),
      });
    }
    setAparcadosLineas(map);
  }

  // Aparcar: guarda la cuenta con una etiqueta y dispara la comanda (como Glop).
  async function aparcar() {
    if (!unidades) return;
    setBusy(true);
    try {
      const etiqueta = alias.trim() || cliente?.nombre || new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      const orderId = await crearOrden("ENVIADA_COCINA", "EN_PREPARACION");
      if (orderId) await sb.from("sales_order").update({ aparcado_como: etiqueta, table_id: null }).eq("id", orderId);
      if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      await Promise.all([recargarMesas(), recargarAparcados()]);
      reset();
    } finally { setBusy(false); }
  }

  // Llevar a barra: mueve la cuenta ACTUAL (mesa, llevar o ticket directo) a una
  // cuenta de barra aparcada (aparcado_como + table_id:null), como guardarActual
  // hace con los tickets directos. Recuperable desde la pestaña «Barra».
  async function llevarABarra() {
    if (!unidades && !ordenAbiertaId) return;
    setBusy(true);
    try {
      const etiqueta = alias.trim() || cliente?.nombre || `Barra ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
      const orderId = await crearOrden("ENVIADA_COCINA", "EN_PREPARACION");
      if (orderId) await sb.from("sales_order").update({ aparcado_como: etiqueta, table_id: null }).eq("id", orderId);
      if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      await Promise.all([recargarMesas(), recargarLlevar(), recargarAparcados()]);
      reset();
      toast.success(`Cuenta llevada a barra · ${etiqueta}`);
    } finally { setBusy(false); }
  }

  async function recuperarAparcado(o: { id: string }) {
    setModalAparcados(false);
    reset();
    setNavSala(false); setBarra(true);   // vuelve a la pantalla Ticket con la cuenta cargada
    await sb.from("sales_order").update({ aparcado_como: null }).eq("id", o.id);
    setOrdenAbiertaId(o.id);
    await cargarLineas(o.id);
    await recargarAparcados();
  }

  // Pasar la cuenta actual a una mesa (crea/mueve el pedido y ocupa la mesa).
  async function pasarAMesa(destino: Mesa) {
    setModalPasarMesa(false);
    if (!unidades && !ordenAbiertaId) return;
    setBusy(true);
    try {
      const orderId = await crearOrden("ENVIADA_COCINA", "EN_PREPARACION");
      if (orderId) {
        await sb.from("sales_order").update({ table_id: destino.id, aparcado_como: null }).eq("id", orderId);
        await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", destino.id);
      }
      if (mesa && mesa.id !== destino.id) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      await recargarMesas();
      reset();
    } finally { setBusy(false); }
  }

  // Buscar cliente por nombre o teléfono (saneado para el filtro .or de PostgREST).
  async function buscarClientes(q: string) {
    setBusqCliente(q);
    const limpio = q.replace(/[,()%]/g, "").trim();
    if (limpio.length < 2) { setClientesEnc([]); return; }
    const { data } = await sb.from("customer").select("id,nombre,telefono")
      .or(`nombre.ilike.%${limpio}%,telefono.ilike.%${limpio}%`).limit(8);
    setClientesEnc((data as { id: string; nombre: string; telefono: string | null }[]) ?? []);
  }
  function asignarCliente(c: { id: string; nombre: string }) {
    setCliente({ id: c.id, nombre: c.nombre });
    setModalCliente(false); setBusqCliente(""); setClientesEnc([]);
  }
  async function crearClienteRapido() {
    if (!nuevoCli.nombre.trim()) return;
    const { data } = await sb.from("customer")
      .insert({ nombre: nuevoCli.nombre.trim(), telefono: nuevoCli.telefono.trim() || null })
      .select("id,nombre").single();
    if (data) asignarCliente(data as { id: string; nombre: string });
    setNuevoCli({ nombre: "", telefono: "" });
  }

  function reprimirUltimo() {
    setModalUtilidades(false);
    if (ultimoDoc) void imprimirTicket(ultimoDoc, cfgImpresion?.ticket ?? {}, resolverImpresora(cfgImpresion, "TICKET_CLIENTE"), { logoUrl: logoTicket });
  }

  // Borrar cuenta: anula el pedido abierto (queda en informes) y libera la mesa.
  async function borrarCuenta() {
    setPedirBorrar(false);
    if (!unidades && !ordenAbiertaId) return;
    setBusy(true);
    try {
      if (ordenAbiertaId) {
        await sb.from("sales_order").update({ estado: "ANULADA" }).eq("id", ordenAbiertaId);
        if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
        await Promise.all([recargarMesas(), recargarLlevar()]);
      }
      reset();
    } finally { setBusy(false); }
  }

  // Bloquear: pone el VELO. NO hace logout ni resetea: la cuenta en curso se conserva
  // debajo y se sigue con solo re-identificarse (pulsera o PIN).
  function bloquear() { setModalUtilidades(false); setBloqueado(true); }

  async function recargarProductos() {
    const { data: p } = await sb.from("product")
      .select("id,nombre,precio,tipo_impositivo,category_id,estacion,foto_url,agotado_hasta,vendido_por_peso")
      .eq("disponible", true).order("nombre");
    setProds((p as Prod[]) ?? []);
  }

  /* ── Agotado ("86"): pulsación larga sobre el producto ── */
  const estaAgotado = (p: Prod) => !!p.agotado_hasta && new Date(p.agotado_hasta) > new Date();
  function onProdPressStart(p: Prod) {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => { longPressed.current = true; setAgotarPop(p); }, 450);
  }
  function onProdClick(p: Prod) {
    if (longPressed.current) { longPressed.current = false; return; }
    if (estaAgotado(p)) return;
    if (p.vendido_por_peso) { setPesoInput(""); setPesoPop(p); return; }       // por peso
    if ((formatos[p.id] ?? []).length) { setFormatoPop(p); return; }          // 1º: formato
    if ((gruposMod[p.id] ?? []).length) { abrirModificadores(p); return; }    // 2º: modificadores
    addProd(p.id);
  }
  function abrirModificadores(p: Prod, fid?: string) {
    setModProd({ p, fid });
  }
  // Construye la clave compuesta de la línea, la añade a la comanda y devuelve la
  // clave REAL usada (addProd puede añadir "#n" para no fusionar con líneas con dto).
  function finalizarLinea(p: Prod, fid: string | undefined, modIds: string[]): string {
    return addProd(claveDeLinea(p.id, fid, modIds));
  }
  // Guarda la selección del ModificadoresModal: extras (con precio, repetidos por
  // uds) + comentarios van a la clave de comanda; los NOMBRES de comentarios y el
  // comentario manual van a las notas de la línea (se imprimen en cocina).
  function guardarModificadores(sel: SeleccionModificadores) {
    if (!modProd) return;
    const grupos = gruposDe(modProd.p.id);
    // Backstop de obligatoriedad (min_sel): comentarios por id elegido, extras por
    // unidades > 0. El aviso ya lo da el modal (deshabilita Guardar en grupos de
    // comentario); esto cubre además grupos de extras obligatorios. Si falta, no guarda.
    for (const g of grupos) {
      if (g.min_sel <= 0) continue;
      const elegidas = g.opciones.filter((o) =>
        o.precio_extra === 0 ? sel.comentarios.includes(o.id) : sel.extras.some((e) => e.id === o.id && e.uds > 0),
      ).length;
      if (elegidas < g.min_sel) return;
    }
    const modIds = [
      ...sel.comentarios,
      ...sel.extras.flatMap((e) => Array.from({ length: e.uds }, () => e.id)),   // uds → precio × uds
    ];
    const texto = [
      ...sel.comentarios.map((id) => modById[id]?.nombre).filter(Boolean),
      sel.comentarioManual.trim(),
    ].filter(Boolean).join(" · ");

    // "Com. y extra": re-clava la línea seleccionada conservando su cantidad,
    // descuento/precio/invitación. Al ser una línea NUEVA, la nota se ASIGNA
    // (no se acumula: evita "sin cebolla · sin cebolla").
    const viejo = modProd.reemplazar;
    if (viejo) {
      const clave = claveDeLinea(modProd.p.id, modProd.fid, modIds);
      // "unidades" del modal fija la cantidad; si no se tocó, conserva la de la línea previa.
      const qty = sel.unidades && sel.unidades >= 1 ? sel.unidades : (comanda[viejo] ?? 1);
      const desc = descuentos[viejo];
      const pm = preciosManuales[viejo];
      const inv = !!invitadas[viejo];
      setComanda((c) => { const { [viejo]: _, ...r } = c; return { ...r, [clave]: (r[clave] ?? 0) + qty }; });
      setDescuentos((d) => { const { [viejo]: _, ...r } = d; return desc ? { ...r, [clave]: desc } : r; });
      setPreciosManuales((m) => { const { [viejo]: _, ...r } = m; return pm !== undefined ? { ...r, [clave]: pm } : r; });
      setInvitadas((v) => { const { [viejo]: _, ...r } = v; return inv ? { ...r, [clave]: true } : r; });
      setNotas((n) => { const { [viejo]: _, ...r } = n; return { ...r, [clave]: texto }; });
      setAnadidoPor((a) => { const { [viejo]: prev, ...r } = a; return prev ? { ...r, [clave]: prev } : r; });   // traslada la atribución
      setLineaSel(clave);
      setModProd(null);
      return;
    }

    // Alta normal desde la carta: añade la línea y ASIGNA su nota.
    const key = finalizarLinea(modProd.p, modProd.fid, modIds);
    if (texto) setNotas((n) => ({ ...n, [key]: texto }));
    // "unidades" del modal FIJA la cantidad de la línea (el stepper arranca en unidadesInicial
    // = uds del teclado, así fijar el mismo valor no altera lo que ya sumó finalizarLinea).
    // ponytail: SET, no acumula; re-configurar la misma línea desde el modal reemplaza sus uds.
    if (sel.unidades && sel.unidades >= 1) setComanda((c) => ({ ...c, [key]: sel.unidades! }));
    setModProd(null);
  }

  /* ── "Comp. menú": abre el selector de menús, o el único directo, o avisa si no hay ── */
  function abrirCompMenu() {
    if (menus.length === 0) { toast("No hay menús configurados (créalos en Carta → Menús)"); return; }
    if (menus.length === 1) { setMenuAbierto(menus[0]!); return; }
    setSelectorMenus(true);
  }
  // Añade UNA línea de menú a la comanda: clave = menu.id (pseudo-producto), precio del menú,
  // y los platos elegidos como nota ("Bebida: Caña · Primero: …"). Usa addProd (respeta el
  // teclado de unidades). ponytail: dos menús idénticos fusionan (la última selección pisa la
  // nota); separar por selección si se pide.
  function anadirMenu(m: MenuTPV, seleccion: { grupoNombre: string; opcionNombre: string }[]) {
    const key = addProd(m.id);
    const texto = seleccion.map((s) => `${s.grupoNombre}: ${s.opcionNombre}`).join(" · ");
    if (texto) setNotas((n) => ({ ...n, [key]: texto }));
    setMenuAbierto(null);
  }
  async function toggleAgotado(p: Prod, agotar: boolean) {
    let hasta: string | null = null;
    if (agotar) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); hasta = d.toISOString(); }
    await sb.from("product").update({ agotado_hasta: hasta }).eq("id", p.id);
    setAgotarPop(null);
    await recargarProductos();
  }

  // Alta rápida de producto desde el TPV: nombre + precio + clase fiscal; la
  // categoría es la abierta y el IVA se calcula por clase × territorio (ivaAuto).
  async function onFotoRapida(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tenantId) return;
    try { const url = await subirMedia(sb, tenantId, file, "productos"); setNuevoProd((s) => ({ ...s, foto_url: url })); }
    catch (err) { console.error(err); }
  }
  async function crearProductoRapido(anadir: boolean) {
    const precio = Number(nuevoProd.precio.replace(",", "."));
    const categoria = nuevoProd.categoryId || catSel;
    if (!nuevoProd.nombre.trim() || !precio || !categoria) return;
    setBusy(true);
    try {
      const { data, error } = await sb.from("product").insert({
        nombre: nuevoProd.nombre.trim(), precio,
        clase_fiscal: nuevoProd.clase, tipo_impositivo: ivaAuto(nuevoProd.clase, territorio),
        category_id: categoria, foto_url: nuevoProd.foto_url || null, disponible: true, estacion: "COCINA",
      }).select("id").single();
      if (error) { console.error(error.message); return; }
      await recargarProductos();
      if (anadir && data) addProd((data as { id: string }).id);
      setModalNuevoProd(false);
      setNuevoProd({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: "", foto_url: "" });
    } finally { setBusy(false); }
  }

  function reset() {
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({}); setAnadidoPor({});
    setMesa(null); setBarra(false); setTicket(null);
    setBuffer(""); setModo("UND"); setLineaSel(null); setVistaProds(false); setEditando(false);
    setOrdenAbiertaId(null); setLlevar(null);
    setCliente(null); setComensales(1); setTipoOperacion("VENTA");
    setMesaSel(null); setMesaSelInfo(null); setNotaMesa(""); setAlias("");
  }

  function salirOperario() {
    try { localStorage.removeItem("gluuh_operario"); } catch { /* ignore */ }
    setOperario(null); setPinUser(null); setPin(""); setPinError("");
    reset();
  }

  // Inicia sesión de operario (compartido por gate, PIN y pulsera) y lo persiste.
  // Fija el operario ACTIVO sin resetear la comanda y QUITA el velo: sirve tanto para
  // el gate como para re-identificarse bajo el velo (mismo camarero u otro → misma cuenta).
  function loginOperario(u: { id: string; nombre: string }) {
    const op = { id: u.id, nombre: u.nombre };
    try { localStorage.setItem("gluuh_operario", JSON.stringify(op)); } catch { /* ignore */ }
    setOperario(op); setPinUser(null); setPin(""); setBloqueado(false);
  }

  async function validarPin() {
    setPinError("");
    const { data, error } = await sb.rpc("validar_pin", { p_pin: pin });
    const u = (data as { id: string; nombre: string }[] | null)?.[0];
    if (error || !u || (pinUser && u.id !== pinUser.id)) { setPinError("PIN incorrecto"); setPin(""); return; }
    loginOperario(u);
  }

  /* ─────────────────────────────── RENDERS ─────────────────────────────── */

  // Derivados de la carta + grids memoizados: ANTES de cualquier return (regla de hooks).
  const catSelEf     = catSel ?? cats[0]?.id ?? null;
  const scrollBox = (ref: React.RefObject<HTMLDivElement | null>, dir: -1 | 1) => {
    const el = ref.current; if (el) el.scrollBy({ top: dir * el.clientHeight * 0.8, behavior: "smooth" });
  };
  // Productos de la categoría activa por la m2m (product_category); si un producto aún
  // no tiene filas m2m, cae a su category_id (categoría principal). Degrada sin la tabla.
  const productosCat = useMemo(
    () => prods.filter((p) => {
      if (!catSelEf) return false;
      const cs = prodCats[p.id];
      return cs && cs.length ? cs.includes(catSelEf) : p.category_id === catSelEf;
    }),
    [prods, catSelEf, prodCats],
  );
  // Vista del grid: con búsqueda activa filtra TODOS los productos por nombre
  // (sin acentos), ignorando la categoría; sin búsqueda, los de la categoría.
  const productosVista = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = norm(busqProd.trim());
    if (!q) return productosCat;
    return prods.filter((p) => norm(p.nombre).includes(q));
  }, [busqProd, productosCat, prods]);
  const buscando = busqProd.trim().length > 0;
  const catActual    = cats.find((c) => c.id === catSelEf);
  const colorActual  = catActual ? (colorCat[catActual.id] ?? "") : "";
  // Solo categorías marcadas "mostrar en venta" (Fase 1 Glop). Antes de la migración,
  // mostrar_venta es undefined → se muestran todas.
  const catsVisibles = useMemo(() => cats.filter((c) => c.mostrar_venta !== false), [cats]);
  // Gr. Cocina = partida a la que va el pedido, según la estación de sus productos:
  // solo bebidas → "Barra", con comida → "Cocina", mezclado → "Cocina y Barra".
  const grCocina = useMemo(() => {
    const ests = new Set<string>();
    for (const key of Object.keys(comanda)) {
      const p = prodDeKey(key);
      if (!p) continue;
      const e = estacionDe(p.estacion);
      if (e !== "NINGUNA") ests.add(e);
    }
    if (ests.size === 0) return "—";
    return [...ests].map((e) => ESTACION_LABEL[e as keyof typeof ESTACION_LABEL]).join(" y ");
  }, [comanda, prods]);

  // Grid de productos memoizado: NO se re-renderiza al teclear/seleccionar (los handlers
  // leen buffer/modo por ref). Solo recalcula si cambian productos, color o categoría.
  const gridProductos = useMemo(() => {
    // Config de la botonera (tpv.botones): columnas fijas o auto-responsive, foto,
    // precio y tamaño de texto del nombre. Solo afecta la PRESENTACIÓN del tile.
    const { columnas, mostrarFoto, mostrarPrecio, tamanoTexto } = botonesCfg;
    const colsClase = columnas === "auto" ? "grid-cols-[repeat(auto-fill,minmax(118px,1fr))]" : "";
    const colsStyle = columnas === "auto" ? undefined : { gridTemplateColumns: `repeat(${columnas}, minmax(0,1fr))` };
    const txtClase = tamanoTexto === "S" ? "text-[10px]" : tamanoTexto === "L" ? "text-sm" : "text-xs";
    return (
    <div className={`grid auto-rows-min content-start gap-2 ${colsClase}`} style={colsStyle}>
      {productosVista.map((p, i) => {
        const agotado = estaAgotado(p);
        // ponytail: imagen de muestra en el 1er producto sin foto (para previsualizar el estilo).
        const foto = mostrarFoto ? (p.foto_url ?? (i === 0 ? "/demo-plato.svg" : undefined)) : undefined;
        return (
          <TileProducto
            key={p.id}
            nombre={p.texto_boton || p.nombre}
            precio={p.precio}
            agotado={agotado}
            foto={foto ?? undefined}
            color={(p.category_id ? colorCat[p.category_id] : undefined) ?? colorActual}
            mostrarPrecio={mostrarPrecio}
            txtClase={txtClase}
            eur={eur}
            onClick={() => onProdClick(p)}
            onPressStart={() => onProdPressStart(p)}
            onPressEnd={onPressEnd}
          />
        );
      })}
      {/* Alta rápida: crear un producto sin salir del TPV (oculta al buscar) */}
      {!buscando && (
        <button type="button"
          onClick={() => { setNuevoProd({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: catSelEf ?? "", foto_url: "" }); setModalNuevoProd(true); }}
          className="flex min-h-[78px] flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border text-[9px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Plus size={14} strokeWidth={1.5} />
          <span className="text-xs font-medium">Nuevo</span>
        </button>
      )}
      {productosVista.length === 0 && (
        <p className="col-span-full text-muted-foreground text-sm">
          {buscando ? `Sin resultados para «${busqProd.trim()}».` : "Sin productos. Pulsa «Nuevo» para crear el primero."}
        </p>
      )}
    </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosVista, buscando, busqProd, colorCat, colorActual, catSelEf, botonesCfg]);

  // Grid de categorías memoizado: solo las visibles (mostrar_venta), sin nivel de familia.
  const gridCategorias = useMemo(() => (
    <div ref={catScrollRef} className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(104px,1fr))] content-start gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {catsVisibles.map((c, i) => {
        const color = colorCat[c.id] || "#64748b";
        const sel = catSelEf === c.id;
        // Icono lucide por nombre (category.icono). Si no hay o no está en el mapa, cae a foto/texto.
        const IconoCat = ICONOS_CAT[iconosCat[c.id] ?? ""];
        // ponytail: imagen de muestra en la 1ª categoría sin icono ni foto, para previsualizar.
        const catFoto = !IconoCat ? (c.foto_url ?? (i === 0 ? "/demo-plato.svg" : undefined)) : undefined;
        return (
          <TileCategoria
            key={c.id}
            nombre={c.texto_boton || c.nombre}
            color={color}
            seleccionada={sel}
            Icono={IconoCat}
            foto={catFoto ?? undefined}
            onClick={() => setCatSel(c.id)}
          />
        );
      })}
      {catsVisibles.length === 0 && (
        <p className="col-span-full text-muted-foreground text-sm">Sin categorías. Añade carta en el panel.</p>
      )}
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [catsVisibles, catSelEf, colorCat, iconosCat]);

  if (loading) return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>
  );

  /* ── Panel de identificación (rejilla de operarios + teclado PIN). Reutilizado por el
       gate inicial y por el VELO de bloqueo: mismos estados (pinUser/pin/pinError) y
       validarPin/loginOperario, así no se duplica lógica. ── */
  function panelIdentificacion(titulo: string, subtitulo: string) {
    return (
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-xl font-semibold">{titulo}</h1>
        {!pinUser && <p className="mb-6 text-center text-sm text-muted-foreground">{subtitulo}</p>}
        {!pinUser ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {operarios.map((o) => (
              <button type="button"
                key={o.id}
                onClick={() => { setPinUser({ id: o.id, nombre: o.nombre }); setPin(""); setPinError(""); }}
                className="grid h-28 place-items-center rounded-lg border-2 border-border bg-card font-semibold hover:border-brand"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/15 text-lg text-brand">{o.nombre.charAt(0).toUpperCase()}</span>
                <span className="mt-1">{o.nombre}</span>
                <span className="text-xs font-normal text-muted-foreground">{o.rol}</span>
              </button>
            ))}
            {operarios.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground">No hay usuarios con PIN. Créalos en <b>Empleados</b>.</p>
            )}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-xs">
            <p className="mb-2 text-center text-sm">PIN de <b>{pinUser.nombre}</b></p>
            <div className="mb-3 h-10 rounded-md border border-border bg-muted text-center text-2xl leading-10 tracking-[0.4em]">
              {pin.length ? "•".repeat(pin.length) : <span className="text-muted-foreground">····</span>}
            </div>
            {pinError && <p className="mb-2 text-center text-sm text-destructive">{pinError}</p>}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"].map((k) => (
                <button type="button"
                  key={k}
                  onClick={() => {
                    if (k === "←") return setPin((p) => p.slice(0, -1));
                    if (k === "OK") return void validarPin();
                    if (pin.length < 8) setPin((p) => p + k);
                  }}
                  className={`h-14 rounded-md border border-border text-lg font-medium ${k === "OK" ? "bg-brand text-brand-foreground" : "bg-card hover:bg-accent"}`}
                >
                  {k}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setPinUser(null); setPin(""); setPinError(""); }} className="btn-ghost mt-3 w-full">← Cambiar usuario</button>
          </div>
        )}
      </div>
    );
  }

  // VELO de bloqueo: overlay ENCIMA del TPV (fixed, no lo desmonta → la cuenta sigue viva
  // debajo). Solo con velo puesto y operario. Re-identificación por pulsera (burst activo)
  // o por PIN (rejilla + teclado del panel); loginOperario quita el velo y fija el operario.
  function renderVelo() {
    if (!bloqueado || !operario) return null;
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-6 text-foreground backdrop-blur">
        <div className="w-full max-w-md">
          <p className="mb-4 text-center text-3xl font-bold">🔒 TPV bloqueado</p>
          {panelIdentificacion("Identifícate para continuar", "Acerca tu pulsera, o toca tu nombre y teclea el PIN.")}
        </div>
      </div>
    );
  }

  /* ── Gate: seleccionar operario (usuario + PIN) ── */
  if (!operario) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        {panelIdentificacion("Selecciona usuario", "Toca tu nombre y teclea el PIN, o acerca tu pulsera.")}
      </div>
    );
  }

  /* ── Dibuja un elemento del plano; en edición es arrastrable y editable ── */
  function ElementoPlano(e: Elemento) {
    const ov = posOverride[e.id];
    const px = ov?.x ?? e.pos_x, py = ov?.y ?? e.pos_y;
    const st = { left: px, top: py, width: e.ancho, height: e.alto, transform: e.rotacion ? `rotate(${e.rotacion}deg)` : undefined };
    // Contenido visual (rellena el contenedor); el posicionado va en el wrapper.
    let inner: React.ReactNode;
    const a = e.icono?.startsWith("suelo:") ? null : assetPorId(e.icono);
    if (e.icono?.startsWith("suelo:")) {
      inner = <div className="h-full w-full rounded-md border border-foreground/10" style={{ backgroundImage: `url(/plano/${e.icono.slice(6)}.svg)`, backgroundRepeat: "repeat" }} />;
    } else if (a) {
      // eslint-disable-next-line @next/next/no-img-element
      inner = <img src={`/plano/${a.file}`} alt="" draggable={false} className="h-full w-full select-none" />;
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
      <button type="button" key={e.id} style={st} className="absolute cursor-move touch-none ring-2 ring-blue-400/60"
        onPointerDown={(ev) => { (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId); dragRef.current = { id: e.id, sx: ev.clientX, sy: ev.clientY, ox: px, oy: py, moved: false }; setArrastrando(true); }}
        onPointerMove={(ev) => {
          const dr = dragRef.current;
          if (dr?.id !== e.id) return;
          const dx = ev.clientX - dr.sx, dy = ev.clientY - dr.sy;
          if (!dr.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
          dr.moved = true;
          setSobrePapel(ptEnPapelera(ev.clientX, ev.clientY));
          const snap = (v: number) => Math.max(0, Math.round(v / 20) * 20);
          setPosOverride((p) => ({ ...p, [e.id]: { x: snap(dr.ox + dx), y: snap(dr.oy + dy) } }));
        }}
        onPointerUp={(ev) => {
          const dr = dragRef.current; dragRef.current = null;
          setArrastrando(false); setSobrePapel(false);
          if (dr?.moved && ptEnPapelera(ev.clientX, ev.clientY)) { void borrarElemId(e.id); return; }
          const p = posOverride[e.id];
          if (dr?.moved && p) void guardarPosElem(e.id, p);
          else if (dr && !dr.moved) setElemEdit(e);
        }}
      >{inner}</button>
    );
  }

  // Guarda la posición de una mesa tras arrastrarla en modo edición.
  async function guardarPosMesa(id: string, pos: { x: number; y: number }) {
    await sb.from("restaurant_table").update({ pos_x: pos.x, pos_y: pos.y }).eq("id", id);
  }
  // ¿El puntero está sobre la papelera? (para borrar arrastrando)
  function ptEnPapelera(x: number, y: number) {
    const el = papeleraRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  async function borrarMesaId(id: string) { await sb.from("restaurant_table").delete().eq("id", id); await recargarMesas(); }
  async function borrarElemId(id: string) { await sb.from("plano_elemento").delete().eq("id", id); await recargarElementos(); }

  // ── Editor de mesa (modo edición): número, comensales/forma, girar, borrar ──
  function abrirEditorMesa(m: Mesa) {
    setMesaEdit(m);
    setNumMesa(m.nombre.match(/\d+/)?.[0] ?? "");
    setCapMesa(m.capacidad || 4);
  }
  function siguienteNumMesa(): number {
    const nums = mesas.filter((m) => m.room_id === vistaSala)
      .map((m) => parseInt(m.nombre.replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
    let n = 1; while (nums.includes(n)) n++; return n;
  }
  async function anadirMesaConForma(seats: number, sprite: string | null) {
    const n = siguienteNumMesa();
    const c = mesas.filter((m) => m.room_id === vistaSala).length;
    const base = { room_id: vistaSala, nombre: seats <= 1 ? `B${n}` : `Mesa ${n}`, estado: "LIBRE", pos_x: 80 + (c % 6) * 40, pos_y: 80 + Math.floor(c / 6) * 40, capacidad: seats };
    const cols = "id,nombre,estado,room_id,pos_x,pos_y,capacidad,rotacion";
    const r1 = await sb.from("restaurant_table").insert({ ...base, sprite }).select(`${cols},sprite`).single();
    const r2 = r1.error ? await sb.from("restaurant_table").insert(base).select(cols).single() : null;   // sprite aún sin migrar
    const created = (r1.error ? r2?.data : r1.data) as Mesa | null;
    await recargarMesas();
    if (created) abrirEditorMesa(created);
  }
  // Cambia la forma (sprite + comensales) de una mesa desde el editor.
  async function setFormaMesa(f: { sprite: string | null; seats: number }) {
    if (!mesaEdit) return;
    setMesaEdit({ ...mesaEdit, sprite: f.sprite, capacidad: f.seats });
    setCapMesa(f.seats);
    setMesas((ms) => ms.map((z) => (z.id === mesaEdit.id ? { ...z, sprite: f.sprite, capacidad: f.seats } : z)));
    const res = await sb.from("restaurant_table").update({ sprite: f.sprite, capacidad: f.seats }).eq("id", mesaEdit.id);
    if (res.error) await sb.from("restaurant_table").update({ capacidad: f.seats }).eq("id", mesaEdit.id);
  }

  // ── Objetos del plano (barra, plantas, sombrilla, puertas…) ──
  async function recargarElementos() {
    const { data } = await sb.from("plano_elemento").select("id,room_id,tipo,etiqueta,icono,pos_x,pos_y,ancho,alto,rotacion");
    setElementos((data as Elemento[]) ?? []);
  }
  async function guardarPosElem(id: string, pos: { x: number; y: number }) {
    await sb.from("plano_elemento").update({ pos_x: pos.x, pos_y: pos.y }).eq("id", id);
  }
  async function anadirElemento(a: PlanoAsset) {
    const d = dim(a);
    const tipo = a.tipo === "barra" ? "BARRA" : a.tipo === "separador" ? "PARED" : a.tipo === "abertura" ? "PUERTA" : "PLANTA";
    await sb.from("plano_elemento").insert({ room_id: vistaSala, tipo, etiqueta: a.nombre, icono: a.id, pos_x: 100, pos_y: 100, ancho: d.w, alto: d.h });
    await recargarElementos();
  }
  async function rotarElemEdit() {
    if (!elemEdit) return;
    const rot = ((elemEdit.rotacion || 0) + 45) % 360;
    setElemEdit({ ...elemEdit, rotacion: rot });
    setElementos((es) => es.map((z) => (z.id === elemEdit.id ? { ...z, rotacion: rot } : z)));
    await sb.from("plano_elemento").update({ rotacion: rot }).eq("id", elemEdit.id);
  }
  // Redimensiona el objeto (p. ej. estirar una línea divisoria sin duplicarla).
  async function setTamElem(dw: number, dh: number) {
    if (!elemEdit) return;
    const ancho = Math.max(20, elemEdit.ancho + dw);
    const alto = Math.max(8, elemEdit.alto + dh);
    setElemEdit({ ...elemEdit, ancho, alto });
    setElementos((es) => es.map((z) => (z.id === elemEdit.id ? { ...z, ancho, alto } : z)));
    await sb.from("plano_elemento").update({ ancho, alto }).eq("id", elemEdit.id);
  }
  async function eliminarElemEdit() {
    if (!elemEdit) return;
    await sb.from("plano_elemento").delete().eq("id", elemEdit.id);
    setElemEdit(null); await recargarElementos();
  }
  async function duplicarElem() {
    if (!elemEdit) return;
    const e = elemEdit;
    await sb.from("plano_elemento").insert({ room_id: e.room_id, tipo: e.tipo, etiqueta: e.etiqueta, icono: e.icono, pos_x: e.pos_x + 24, pos_y: e.pos_y + 24, ancho: e.ancho, alto: e.alto, rotacion: e.rotacion });
    setElemEdit(null); await recargarElementos();
  }
  async function rotarMesaEdit() {
    if (!mesaEdit) return;
    const rot = ((mesaEdit.rotacion || 0) + 45) % 360;
    setMesaEdit({ ...mesaEdit, rotacion: rot });
    setMesas((ms) => ms.map((z) => (z.id === mesaEdit.id ? { ...z, rotacion: rot } : z)));
    await sb.from("restaurant_table").update({ rotacion: rot }).eq("id", mesaEdit.id);
  }
  // El número solo se cambia si la mesa está LIBRE (sin cuenta), para no romper
  // ninguna cuenta abierta. Capacidad/forma/giro sí se pueden tocar siempre.
  function mesaLibreEdit(m: Mesa) { return (totalesMesa[m.id] ?? 0) === 0 && m.estado === "LIBRE"; }
  async function guardarMesaEdit() {
    if (!mesaEdit) return;
    const cap = Math.max(1, Math.min(12, capMesa));
    const update: Record<string, unknown> = { capacidad: cap };
    const n = parseInt(numMesa, 10);
    if (mesaLibreEdit(mesaEdit) && n) {
      const dupe = mesas.some((m) => m.room_id === vistaSala && m.id !== mesaEdit.id && parseInt(m.nombre.replace(/\D/g, ""), 10) === n);
      if (dupe) return;
      update.nombre = cap <= 1 ? `B${n}` : `Mesa ${n}`;
    }
    await sb.from("restaurant_table").update(update).eq("id", mesaEdit.id);
    setMesaEdit(null); await recargarMesas();
  }
  async function eliminarMesaEdit() {
    if (!mesaEdit || !mesaLibreEdit(mesaEdit)) return;
    await sb.from("restaurant_table").delete().eq("id", mesaEdit.id);
    setMesaEdit(null); await recargarMesas();
  }

  /* ── Dibuja una mesa; el color va en el propio SVG según su estado ── */
  function MesaPlano(m: Mesa, i: number) {
    const cuenta = totalesMesa[m.id] ?? 0;
    const ocupada = cuenta > 0 || m.estado !== "LIBRE";
    const resvs = reservasPorMesa[m.id] ?? [];
    const reservada = resvs.length > 0;
    const a = (m.sprite ? assetPorId(m.sprite) : null) ?? mesaPorCapacidad(m.capacidad || 4);
    const d = dim(a);
    const ov = posOverride[m.id];
    const x = ov?.x ?? m.pos_x ?? (40 + (i % 4) * 220);
    const y = ov?.y ?? m.pos_y ?? (40 + Math.floor(i / 4) * 230);
    const seleccionada = mesaSel?.id === m.id;
    // Color aplicado al relieve del SVG (var --mesa-fill), no una capa encima.
    // En reposo (libre) la mesa se ve marrón.
    const fill = editandoPlano ? "#93c5fd" : seleccionada ? "#22c55e" : ocupada ? "#f59e0b" : reservada ? "#38bdf8" : "#8a5a2b";
    return (
      <button type="button"
        key={m.id}
        onClick={() => { if (!editandoPlano) onMesaClick(m); }}
        onPointerDown={(e) => {
          if (!editandoPlano) { onPressStart(m); return; }
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { id: m.id, sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
          setArrastrando(true);
        }}
        onPointerMove={(e) => {
          const dr = dragRef.current;
          if (!editandoPlano || dr?.id !== m.id) return;
          const dx = e.clientX - dr.sx, dy = e.clientY - dr.sy;
          if (!dr.moved && Math.abs(dx) + Math.abs(dy) < 8) return;   // ignora micro-temblor del toque
          dr.moved = true;
          setSobrePapel(ptEnPapelera(e.clientX, e.clientY));
          const snap = (v: number) => Math.max(0, Math.round(v / 20) * 20);   // rejilla de 20px para alinear
          setPosOverride((p) => ({ ...p, [m.id]: { x: snap(dr.ox + dx), y: snap(dr.oy + dy) } }));
        }}
        onPointerUp={(e) => {
          if (!editandoPlano) { onPressEnd(); return; }
          const dr = dragRef.current; dragRef.current = null;
          setArrastrando(false); setSobrePapel(false);
          if (dr?.moved && ptEnPapelera(e.clientX, e.clientY)) {   // soltar en papelera → borrar
            if (mesaLibreEdit(m)) { void borrarMesaId(m.id); return; }
          }
          const p = posOverride[m.id];
          if (dr?.moved && p) void guardarPosMesa(m.id, p);
          else if (dr && !dr.moved) abrirEditorMesa(m);   // toque sin arrastrar → editar
        }}
        onPointerLeave={() => { if (!editandoPlano) onPressEnd(); }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ left: x, top: y, width: d.w, height: d.h }}
        className={`absolute select-none ${editandoPlano ? "cursor-move touch-none" : "transition-transform hover:scale-[1.04]"} ${seleccionada && !editandoPlano ? "z-10" : ""}`}
      >
        <PlanoSvg file={a.file} style={{ transform: m.rotacion ? `rotate(${m.rotacion}deg)` : undefined, "--mesa-fill": fill } as React.CSSProperties} className="pointer-events-none block h-full w-full" />
        <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5">
          <span className="text-[11px] font-bold leading-none text-white">{m.nombre.replace("Mesa ", "")}</span>
          {ocupada && cuenta > 0 && <span className="text-[9px] font-semibold leading-none text-white">{eur(cuenta)}</span>}
        </span>
        {reservada && !editandoPlano && (
          <span className="absolute left-1/2 top-full z-10 mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white shadow">
            🕑 {resvs[0]!.nombre || "Reserva"} · {hhmm(resvs[0]!.fecha_hora)}{resvs.length > 1 ? ` +${resvs.length - 1}` : ""}
          </span>
        )}
      </button>
    );
  }

  // Rail lateral fijo (estilo Glop): Ticket · Barra · [salas] · Para llevar · Reservas.
  // Es el "layout" constante; cambia el área central. `activo` = pestaña resaltada.
  function railSalas(activo: string) {
    // Icono por sala: por nombre (las salas son configurables) con reserva genérica.
    const iconoSala = (nombre: string): LucideIcon => {
      const n = nombre.toLowerCase();
      if (n.includes("terraza")) return Sun;
      if (n.includes("barra")) return Store;
      if (n.includes("llevar")) return ShoppingBag;
      return Armchair;   // salón y demás salas
    };
    const tabs: RailTab[] = [
      { id: "TICKET", label: "Ticket", icon: Receipt, onClick: () => irASala({ tipo: "ticket" }) },
      { id: "BARRA", label: "Barra", icon: Store, badge: aparcados.length || undefined, onClick: () => irASala({ tipo: "barra" }) },
      ...rooms.map((rm) => ({
        id: rm.id, label: rm.nombre, icon: iconoSala(rm.nombre),
        badge: mesas.filter((m) => m.room_id === rm.id && (totalesMesa[m.id] ?? 0) > 0).length || undefined,
        onClick: () => irASala({ tipo: "room", id: rm.id }),
      })),
      { id: "LLEVAR", label: "Para llevar", icon: ShoppingBag, badge: llevarList.length || undefined, onClick: () => irASala({ tipo: "llevar" }) },
      { id: "RESERVAS", label: "Reservas", icon: CalendarCheck, badge: reservas.length || undefined, onClick: async () => { await guardarActual(); setNavSala(true); setVistaSala("RESERVAS"); } },
    ];
    return (
      <RailSalas tabs={tabs} activo={activo} busy={busy} onConfig={() => setModalUtilidades(true)} />
    );
  }



  /* ── Navegación de salas (estilo Glop): plano / barra / llevar / reservas ── */
  if (navSala) {
    const mesasSala = mesas.filter((m) => m.room_id === vistaSala);
    const roomActiva = rooms.find((r) => r.id === vistaSala);
    const planoBg = roomActiva?.suelo
      ? { backgroundImage: `url(/plano/${roomActiva.suelo}.svg)`, backgroundRepeat: "repeat" as const }
      : { backgroundImage: "radial-gradient(rgba(120,120,120,0.10) 1px, transparent 1px)", backgroundSize: "26px 26px" };
    const lienzoStyle = {
      width: planoContent.w, height: planoContent.h,
      transform: `scale(${editandoPlano ? 1 : planoScale})`, transformOrigin: "center",
      "--mesa-fill": marca.mesa_color, "--silla-fill": marca.silla_color,
    } as unknown as React.CSSProperties;
    const enPlano = !["BARRA", "LLEVAR", "RESERVAS"].includes(vistaSala);
    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        {renderVelo()}
        <header className="flex flex-none items-center justify-between border-b border-border bg-card px-4 py-2.5">
          <strong className="font-semibold">TPV · {operario.nombre}</strong>
          {editandoPlano && <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">Editando salón · arrastra las mesas</span>}
        </header>
        <div className="flex min-h-0 flex-1">
          {/* Menú lateral "Añadir" (mesas / objetos), desplegable a la izquierda */}
          {editandoPlano && (paletaAbierta ? (
            <aside className="flex w-52 flex-none flex-col border-r border-border bg-card">
              <div className="flex items-center border-b border-border">
                {(["MESAS", "OBJETOS"] as const).map((t) => (
                  <button type="button" key={t} onClick={() => setPaletaTab(t)}
                    className={`flex-1 py-2 text-sm font-medium ${paletaTab === t ? "border-b-2 border-brand text-brand" : "text-muted-foreground hover:text-foreground"}`}>
                    {t === "MESAS" ? "Mesas" : "Objetos"}
                  </button>
                ))}
                <button type="button" onClick={() => setPaletaAbierta(false)} className="px-2 text-muted-foreground hover:text-foreground" title="Ocultar">‹</button>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-2">
                {paletaTab === "MESAS"
                  ? FORMAS_MESA.map((f) => (
                      <button type="button" key={f.file} onClick={() => anadirMesaConForma(f.seats, f.sprite)}
                        className="flex flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-center hover:bg-accent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/plano/${f.file}`} alt="" className="h-12 w-12 object-contain" />
                        <span className="text-[10px] font-medium leading-tight">{f.nombre}</span>
                      </button>
                    ))
                  : ASSETS.filter((a) => (a.tipo === "barra" || a.tipo === "planta" || a.tipo === "separador" || a.tipo === "abertura") && !ASSETS_LEGACY.has(a.id)).map((a) => (
                      <button type="button" key={a.id} onClick={() => anadirElemento(a)}
                        className="flex flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-center hover:bg-accent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/plano/${a.file}`} alt="" className="h-12 w-12 object-contain" />
                        <span className="text-[10px] font-medium leading-tight">{a.nombre}</span>
                      </button>
                    ))}
              </div>
            </aside>
          ) : (
            <button type="button" onClick={() => setPaletaAbierta(true)} className="flex w-9 flex-none items-center justify-center border-r border-border bg-card text-muted-foreground hover:text-foreground" title="Añadir">›</button>
          ))}

          {/* Plano / contenido (el rail de salas va a la derecha, estilo Glop) */}
          <main className="relative min-w-0 flex-1 overflow-auto bg-muted/20">
            {vistaSala === "BARRA" ? (
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Cuentas abiertas en barra</h3>
                  <button type="button" onClick={() => irASala({ tipo: "ticket" })} className="btn-primary text-sm">+ Nueva venta</button>
                </div>
                {aparcados.length === 0 ? (
                  <div className="card text-center text-muted-foreground">No hay cuentas abiertas. Pulsa «Nueva venta» para empezar una.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {aparcados.map((o) => {
                      const lineas = aparcadosLineas[o.id] ?? [];
                      return (
                        <button type="button" key={o.id} onClick={() => recuperarAparcado(o)}
                          className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-transform active:scale-95">
                          <div className="truncate bg-brand px-2 py-1 text-center text-xs font-semibold text-brand-foreground">{o.aparcado_como || `Barra ${hhmm(o.created_at)}`}</div>
                          <div className="flex-1 p-2">
                            <div className="mb-1 flex gap-1 border-b border-border pb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                              <span className="flex-1">Artículo</span><span className="w-8 text-right">Uds</span><span className="w-12 text-right">Total</span>
                            </div>
                            <ul className="space-y-0.5 text-xs">
                              {lineas.slice(0, 6).map((l, i) => (
                                <li key={`${o.id}-${i}`} className="flex gap-1">
                                  <span className="flex-1 truncate">{l.nombre}</span>
                                  <span className="w-8 text-right tabular-nums">{l.cantidad}</span>
                                  <span className="w-12 text-right tabular-nums">{eur(l.total)}</span>
                                </li>
                              ))}
                              {lineas.length > 6 && <li className="text-[10px] text-muted-foreground">+{lineas.length - 6} más…</li>}
                              {lineas.length === 0 && <li className="text-[10px] text-muted-foreground">Sin líneas</li>}
                            </ul>
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-border p-2">
                            <span className="rounded bg-[#c46a2a] px-2 py-1 text-[11px] font-semibold text-white">Abrir cuenta</span>
                            <span className="text-base font-bold tabular-nums">{eur(Number(o.total))}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : vistaSala === "LLEVAR" ? (
              <div className="mx-auto max-w-2xl space-y-4 p-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-2 font-semibold">Nuevo pedido para llevar</h3>
                  <div className="flex flex-wrap gap-2">
                    <input value={nuevoLlevar.nombre} onChange={(e) => setNuevoLlevar((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nombre del cliente" className="min-w-40 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                    <input value={nuevoLlevar.telefono} onChange={(e) => setNuevoLlevar((s) => ({ ...s, telefono: e.target.value }))} placeholder="Teléfono" inputMode="tel" className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                    <button type="button" onClick={nuevoParaLlevar} disabled={!nuevoLlevar.nombre.trim()} className="btn-primary disabled:opacity-50">Crear</button>
                  </div>
                </div>
                {llevarList.length === 0 && <div className="card text-center text-muted-foreground">Sin pedidos para llevar abiertos.</div>}
                {llevarList.map((o) => (
                  <button type="button" key={o.id} onClick={() => abrirLlevar(o)} className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-accent">
                    <div className="min-w-0">
                      <div className="font-medium">🛍 {o.cliente_nombre}</div>
                      {o.cliente_telefono && <div className="text-xs text-muted-foreground">{o.cliente_telefono}</div>}
                    </div>
                    <span className="font-semibold tabular-nums">{eur(Number(o.total))}</span>
                  </button>
                ))}
              </div>
            ) : vistaSala === "RESERVAS" ? (
              <div className="mx-auto max-w-2xl space-y-2 p-4">
                {reservas.length === 0 && <div className="card text-center text-muted-foreground">Sin reservas.</div>}
                {reservas.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {new Date(r.fecha_hora).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {r.nombre && <span className="ml-2">· {r.nombre}</span>}
                        <span className="ml-2 text-muted-foreground">· {r.comensales} pax</span>
                        {r.table_id && <span className="ml-2 text-muted-foreground">· {mesas.find((mm) => mm.id === r.table_id)?.nombre ?? "mesa"}</span>}
                      </div>
                      {r.notas && <div className="truncate text-xs text-muted-foreground">{r.notas}</div>}
                    </div>
                    <span className="ml-3 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{r.estado}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div ref={planoBoxRef} style={planoBg as React.CSSProperties} className={`relative h-full w-full p-2 ${editandoPlano ? "overflow-auto" : "grid place-items-center overflow-hidden"}`}>
                {/* Cabecera flotante: nombre de sala + ocupación + leyenda (sin escalar) */}
                <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-background px-3 py-1 text-sm font-semibold">
                    {roomActiva?.nombre ?? "Sala"}
                    <span className="ml-2 font-normal text-muted-foreground">{mesasSala.filter((m) => (totalesMesa[m.id] ?? 0) > 0).length}/{mesasSala.length} ocupadas</span>
                  </span>
                  <span className="flex items-center gap-3 rounded-full bg-background px-3 py-1 text-[11px]">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />Libre</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Ocupada</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" />Reservada</span>
                  </span>
                </div>
                {/* Lienzo del plano, escalado para caber en la pantalla */}
                <div className="relative flex-none rounded-2xl" style={lienzoStyle}>
                  {/* Paredes (marco de la sala) */}
                  <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-foreground/15" />
                  {/* Elementos detrás de las mesas; zonas de suelo primero (al fondo) */}
                  {elementos.filter((e) => e.room_id === vistaSala)
                    .sort((a, b) => (b.icono?.startsWith("suelo:") ? 1 : 0) - (a.icono?.startsWith("suelo:") ? 1 : 0))
                    .map((e) => ElementoPlano(e))}
                  {mesasSala.map((m, i) => MesaPlano(m, i))}
                  {mesasSala.length === 0 && (
                    <p className="absolute inset-0 grid place-items-center text-muted-foreground">Sin mesas en esta sala.</p>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* Panel de traspaso por líneas: elige unidades y luego toca el destino */}
          {enPlano && modoTraspaso === "LINEAS" && (
            <aside className="flex w-72 flex-none flex-col border-l border-border bg-card">
              <div className="border-b border-border p-3 text-sm font-semibold">Pasar de {mesa?.nombre}: elige qué</div>
              <div className="flex-1 overflow-y-auto p-2">
                {Object.entries(comanda).length === 0 && <p className="mt-6 text-center text-xs text-muted-foreground">Sin líneas.</p>}
                {Object.entries(comanda).map(([pid, qty]) => {
                  const nombre = prods.find((p) => p.id === pid)?.nombre ?? "Producto";
                  const mv = traspLineas[pid] ?? 0;
                  return (
                    <div key={pid} className="flex items-center gap-1 py-1 text-sm">
                      <span className="min-w-0 flex-1 truncate">{nombre}</span>
                      <button type="button" onClick={() => setTraspLineas((t) => ({ ...t, [pid]: Math.max(0, (t[pid] ?? 0) - 1) }))} className="h-7 w-7 flex-none rounded border border-border">−</button>
                      <span className="w-10 text-center text-xs tabular-nums">{mv}/{qty}</span>
                      <button type="button" onClick={() => setTraspLineas((t) => ({ ...t, [pid]: Math.min(qty, (t[pid] ?? 0) + 1) }))} className="h-7 w-7 flex-none rounded border border-border">+</button>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-2 text-center text-xs text-muted-foreground">Ahora toca la mesa destino</div>
            </aside>
          )}

          {/* Panel de cuenta de la mesa seleccionada (1er toque); estilo Glop */}
          {enPlano && !editandoPlano && !modoTraspaso && (
            <aside className="flex w-72 flex-none flex-col border-l border-border bg-card">
              <div className="border-b border-border p-3 text-sm">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Mesa</span><span className="font-semibold">{mesaSel?.nombre ?? "—"}</span>
                  <span className="text-muted-foreground">Apertura</span><span className="tabular-nums">{mesaSelInfo?.apertura || "—"}</span>
                  <span className="text-muted-foreground">Comensales</span><span>{mesaSelInfo?.comensales ?? "—"}</span>
                  <span className="text-muted-foreground">Importe</span><span className="font-semibold tabular-nums">{eur(mesaSelInfo?.importe ?? 0)}</span>
                </div>
                {mesaSelInfo?.nota && <div className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">📝 {mesaSelInfo.nota}</div>}
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {!mesaSel ? (
                  <p className="mt-8 px-2 text-center text-xs text-muted-foreground">Toca una mesa para ver su cuenta.<br />Toca de nuevo para abrirla.</p>
                ) : (mesaSelInfo?.lineas.length ?? 0) === 0 ? (
                  <p className="mt-8 px-2 text-center text-xs text-muted-foreground">Mesa libre · sin cuenta abierta.</p>
                ) : (
                  <>
                    <div className="mb-1 flex gap-1 border-b border-border pb-1 text-[11px] font-semibold text-muted-foreground">
                      <span className="flex-1">Descripción</span><span className="w-8 text-right">Und</span><span className="w-14 text-right">Precio</span>
                    </div>
                    <ul className="space-y-0.5 text-sm">
                      {mesaSelInfo!.lineas.map((l, i) => (
                        <li key={`${mesaSel.id}-${i}`} className="flex gap-1">
                          <span className="flex-1 truncate">{l.nombre}</span>
                          <span className="w-8 text-right tabular-nums">{l.cantidad}</span>
                          <span className="w-14 text-right tabular-nums">{eur(l.precio)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              {mesaSel && (
                <div className="border-t border-border p-2">
                  <button type="button" onClick={() => abrirMesa(mesaSel)} className="btn-primary w-full">Abrir {mesaSel.nombre} →</button>
                </div>
              )}
            </aside>
          )}
          {railSalas(vistaSala)}
        </div>

        {/* Traspaso: aviso parpadeante mientras esperas que toques la mesa destino */}
        {modoTraspaso && (
          <div className="fixed left-1/2 top-16 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg dark:bg-amber-900/50 dark:text-amber-100">
            <span className="animate-pulse">Traspaso de {mesa?.nombre ?? "mesa"}{modoTraspaso === "LINEAS" ? " (por líneas)" : ""} → toca la mesa destino</span>
            <button type="button" onClick={cancelarTraspaso} className="rounded-full bg-amber-800 px-2 py-0.5 text-xs text-white">Cancelar</button>
          </div>
        )}

        {/* Papelera: aparece al arrastrar; soltar encima borra el elemento */}
        {editandoPlano && arrastrando && (
          <div ref={papeleraRef}
            className={`pointer-events-none fixed bottom-24 left-1/2 z-50 flex h-24 w-24 -translate-x-1/2 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed shadow-lg transition-all ${sobrePapel ? "scale-110 border-rose-600 bg-rose-600 text-white" : "border-rose-400 bg-card text-rose-500"}`}>
            <Trash2 size={28} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">Soltar para borrar</span>
          </div>
        )}

        {/* Footer de salón (estilo Glop): acciones sobre la mesa seleccionada */}
        {enPlano && (editandoPlano ? (
          <footer className="flex-none border-t border-border bg-blue-500/10 px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPaletaAbierta((v) => !v)} className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">☰ Añadir</button>
              <span className="text-sm text-muted-foreground">Arrastra para mover · toca una mesa u objeto para editar/girar.</span>
              <button type="button" onClick={() => { setEditandoPlano(false); setPosOverride({}); void recargarMesas(); void recargarElementos(); }} className="ml-auto rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white">✓ Hecho</button>
            </div>
          </footer>
        ) : (
          <footer className="flex-none border-t border-border bg-surface px-2 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => { setMesaSel(null); setMesaSelInfo(null); setEditandoPlano(true); setPaletaAbierta(true); }} className="btn-ghost">Editar salón</button>
              <button type="button" onClick={() => void window.gluuh?.abrirCajon()} className="btn-ghost">Abrir cajón</button>
              <button type="button" onClick={() => mesaSel && abrirNotaMesa(mesaSel)} disabled={!mesaSel} className="btn-ghost disabled:opacity-40">Notas mesa</button>
              <button type="button" onClick={() => mesaSel && dividirMesa(mesaSel)} disabled={!mesaSel} className="btn-ghost disabled:opacity-40">Dividir pagos</button>
              <button type="button" onClick={() => mesaSel && iniciarTraspaso(mesaSel, "LINEAS")} disabled={!mesaSel} className="btn-ghost disabled:opacity-40">Trasp. líneas</button>
              <button type="button" onClick={() => mesaSel && iniciarTraspaso(mesaSel, "MESA")} disabled={!mesaSel} className="btn-ghost disabled:opacity-40">Trasp. mesa</button>
              <button type="button" onClick={() => mesaSel && reimprimirCocinaMesa(mesaSel)} disabled={!mesaSel} className="btn-ghost disabled:opacity-40">Re. cocina</button>
              <button type="button" onClick={reprimirUltimo} disabled={!ultimoDoc} className="btn-ghost disabled:opacity-40">Último doc.</button>
              <button type="button" onClick={() => mesaSel && imprimirCuentaMesa(mesaSel)} disabled={!mesaSel} className="btn-ghost disabled:opacity-40">Imp. cuenta</button>
              <button type="button" onClick={() => mesaSel && abrirMesa(mesaSel)} disabled={!mesaSel} className="btn-primary disabled:opacity-40">Abrir Mesa</button>
              <button type="button" onClick={() => mesaSel && cobrarMesa(mesaSel)} disabled={!mesaSel || !puede("cobrar")} className="ml-auto rounded-md bg-[#c46a2a] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Cobrar</button>
            </div>
            {/* ponytail: "Notas mesa" y "Trasp. líneas" abren la cuenta en el TPV (falta editor de nota por pedido y selector de líneas). */}
          </footer>
        ))}

        {/* Editor de mesa (modo edición): número, comensales/forma, girar, borrar */}
        {mesaEdit && (() => {
          const libre = mesaLibreEdit(mesaEdit);
          const n = parseInt(numMesa, 10);
          const dupe = !!n && mesas.some((m) => m.room_id === vistaSala && m.id !== mesaEdit.id && parseInt(m.nombre.replace(/\D/g, ""), 10) === n);
          return (
            <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setMesaEdit(null)}>
              <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-3 font-semibold">Editar {mesaEdit.nombre}</h3>

                <label className="mb-1 block text-sm font-medium" htmlFor="num-mesa">Número de mesa</label>
                <input id="num-mesa" value={numMesa} onChange={(e) => setNumMesa(e.target.value.replace(/\D/g, ""))} inputMode="numeric" disabled={!libre}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg tabular-nums outline-none focus:border-brand disabled:opacity-50" />
                {!libre && <p className="mt-1 text-xs text-amber-600">No se puede cambiar el número: la mesa tiene cuenta abierta.</p>}
                {libre && dupe && <p className="mt-1 text-xs text-rose-600">Ya existe la mesa {n} en esta sala.</p>}

                <div className="mb-1 mt-3 block text-sm font-medium">Forma / comensales</div>
                <div className="grid grid-cols-4 gap-1">
                  {FORMAS_MESA.map((f) => {
                    const activa = (mesaEdit.sprite ?? null) === f.sprite && mesaEdit.capacidad === f.seats;
                    return (
                      <button type="button" key={f.file} onClick={() => setFormaMesa(f)}
                        className={`flex flex-col items-center gap-0.5 rounded-md border p-1 ${activa ? "border-brand bg-brand/10" : "border-border hover:bg-accent"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/plano/${f.file}`} alt="" className="h-8 w-8 object-contain" />
                        <span className="text-[8px] leading-none">{f.nombre}</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={rotarMesaEdit} className="mt-2 w-full rounded-md border border-border py-2 text-sm hover:bg-accent">↻ Girar 45°</button>

                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={eliminarMesaEdit} disabled={!libre} title={libre ? "" : "No se puede borrar con cuenta abierta"} className="rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:hover:bg-rose-950">Eliminar</button>
                  <button type="button" onClick={() => setMesaEdit(null)} className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-accent">Cancelar</button>
                  <button type="button" onClick={guardarMesaEdit} disabled={libre && dupe} className="flex-1 rounded-md bg-brand py-2 text-sm font-semibold text-brand-foreground disabled:opacity-40">Guardar</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Editor de objeto (barra, planta, sombrilla, puerta…): tamaño/girar/duplicar/eliminar */}
        {elemEdit && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setElemEdit(null)}>
            <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 font-semibold">{elemEdit.etiqueta || "Objeto"}</h3>
              {/* Tamaño: estira sin duplicar (p. ej. una línea divisoria larga) */}
              <div className="mb-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-muted-foreground">Ancho</span>
                  <button type="button" onClick={() => setTamElem(-40, 0)} className="h-8 w-8 rounded-md border border-border text-lg leading-none">−</button>
                  <span className="w-12 text-center tabular-nums">{elemEdit.ancho}</span>
                  <button type="button" onClick={() => setTamElem(40, 0)} className="h-8 w-8 rounded-md border border-border text-lg leading-none">+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-muted-foreground">Alto</span>
                  <button type="button" onClick={() => setTamElem(0, -20)} className="h-8 w-8 rounded-md border border-border text-lg leading-none">−</button>
                  <span className="w-12 text-center tabular-nums">{elemEdit.alto}</span>
                  <button type="button" onClick={() => setTamElem(0, 20)} className="h-8 w-8 rounded-md border border-border text-lg leading-none">+</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={rotarElemEdit} className="rounded-md border border-border py-2 text-sm hover:bg-accent">↻ Girar</button>
                <button type="button" onClick={duplicarElem} className="rounded-md border border-border py-2 text-sm hover:bg-accent">⧉ Duplicar</button>
                <button type="button" onClick={eliminarElemEdit} className="rounded-md border border-rose-300 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950">Eliminar</button>
              </div>
              <button type="button" onClick={() => setElemEdit(null)} className="mt-3 w-full text-sm text-muted-foreground hover:underline">Cerrar</button>
            </div>
          </div>
        )}

        {/* Nota de la mesa (alergias, avisos…) */}
        {modalNota && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setModalNota(false)}>
            <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 font-semibold">Nota de la mesa</h3>
              <textarea value={notaTexto} onChange={(e) => setNotaTexto(e.target.value)} rows={4}
                placeholder="Ej.: alergia a frutos secos · cumpleaños · sin gluten…"
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setModalNota(false)} className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-accent">Cancelar</button>
                <button type="button" onClick={guardarNota} className="flex-1 rounded-md bg-brand py-2 text-sm font-semibold text-brand-foreground">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Ajustes / Utilidades (gear del rail) */}
        {modalUtilidades && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setModalUtilidades(false)}>
            <div className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 font-semibold">Ajustes</h3>
              <div className="space-y-1.5">
                {typeof window !== "undefined" && window.gluuh && (
                  <button type="button" onClick={() => { setModalUtilidades(false); void window.gluuh?.abrirCajon(); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">Abrir cajón</button>
                )}
                <button type="button" onClick={reprimirUltimo} disabled={!ultimoDoc} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-40">Reimprimir último ticket</button>
                <button type="button" onClick={() => { setModalUtilidades(false); router.push("/modulos"); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">Módulos y pantallas</button>
              <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">{resolvedTheme === "dark" ? "Modo claro ☀️" : "Modo oscuro 🌙"}</button>
                <button type="button" onClick={() => { setModalUtilidades(false); salirOperario(); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-accent">Salir del operario</button>
              </div>
              <button type="button" onClick={() => setModalUtilidades(false)} className="btn-ghost mt-3 w-full">Cerrar</button>
            </div>
          </div>
        )}

        {/* Popover de reservas de mesa (pulsación larga sobre la mesa) */}
        {reservaPop && (() => {
          const m = reservaPop;
          const list = reservasPorMesa[m.id] ?? [];
          return (
            <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setReservaPop(null)}>
              <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-3 font-semibold">{m.nombre} · Reservas</h3>

                {list.length > 0 && (
                  <div className="mb-4 space-y-1">
                    {list.map((r) => (
                      <div key={r.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${resForm.id === r.id ? "border-brand bg-brand/10" : "border-border"}`}>
                        <button type="button" onClick={() => editarReserva(r)} className="min-w-0 flex-1 truncate text-left">
                          <b className="tabular-nums">{hhmm(r.fecha_hora)}</b> · {r.nombre || "Sin nombre"} <span className="text-muted-foreground">· {r.comensales} pax</span>
                        </button>
                        <button type="button" onClick={() => quitarReserva(r)} className="ml-2 flex-none text-rose-600 hover:underline">Quitar</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{resForm.id ? "Editar reserva" : "Nueva reserva"}</div>
                  <input value={resForm.nombre} onChange={(e) => setResForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre de la reserva" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                  <div className="flex gap-2">
                    <input type="time" aria-label="Hora de la reserva" value={resForm.hora} onChange={(e) => setResForm((f) => ({ ...f, hora: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                    <input type="number" min={1} aria-label="Comensales de la reserva" value={resForm.personas} onChange={(e) => setResForm((f) => ({ ...f, personas: e.target.value }))} placeholder="pax" className="w-20 flex-none rounded-md border border-border bg-background px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-brand" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => guardarReserva(m)} disabled={!resForm.hora} className="btn-primary flex-1 disabled:opacity-50">{resForm.id ? "Guardar" : "Añadir reserva"}</button>
                    {resForm.id && <button type="button" onClick={() => setResForm({ id: null, nombre: "", personas: String(m.capacidad || 2), hora: "" })} className="btn-ghost">Nueva</button>}
                  </div>
                </div>

                <button type="button" onClick={() => setReservaPop(null)} className="btn-ghost mt-3 w-full">Cerrar</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  /* ── Pantalla venta (layout Ágora) ── */
  // Categoría efectiva: la elegida o la primera (así siempre se ven productos debajo).


  // Props del rail vertical de acciones de CUENTA (el orden es configurable).
  const hayInvitadas = Object.values(invitadas).some(Boolean);
  const accionesRapidasProps = {
    hayLineas: unidades > 0,
    hayCuenta: unidades > 0 || !!ordenAbiertaId,
    tipoOperacion,
    nAparcados: aparcados.length,
    hayUltimoDoc: !!ultimoDoc,
    orden: ordenFunciones,
    favoritos: ["aparcar", "marchar"],
    onAparcar: aparcar,
    onAparcados: () => setModalAparcados(true),
    onLlevarBarra: () => { void llevarABarra(); },
    onPasarMesa: () => setModalPasarMesa(true),
    onConsumoPropio: () => { if (puede("invitar")) setTipoOperacion((t) => (t === "AUTOCONSUMO" ? "VENTA" : "AUTOCONSUMO")); },
    onDividir: () => setModalDividir(true),
    onBorrarCuenta: () => { if (puede("borrar")) setPedirBorrar(true); },
    onUltimoDoc: reprimirUltimo,
    onCliente: () => setModalCliente(true),
    // ponytail: pendiente de definir → abre Utilidades como casa temporal.
    onCamarero: () => setModalUtilidades(true),
    onPreparar: () => enviarCocina("PENDIENTE"),
    onMarchar: () => enviarCocina("EN_PREPARACION"),
    // Utilidades ancladas al fondo del rail (movidas desde el teclado).
    onAbrirCajon: () => void window.gluuh?.abrirCajon(),
    onUtilidades: () => setModalUtilidades(true),
    onImprimir: imprimirRecibo,
    imprimirDisabled: !ticket && !unidades,
    onBloquear: bloquear,
  } as const;
  // Anular la línea seleccionada (misma lógica que "Eliminar" del editor de línea).
  const anularLineaSel = () => {
    if (!lineaSel) return;
    const sel = lineaSel;
    setComanda((c) => { const { [sel]: _, ...r } = c; return r; });
    setDescuentos((d) => { const { [sel]: _, ...r } = d; return r; });
    setPreciosManuales((m) => { const { [sel]: _, ...r } = m; return r; });
    setNotas((n) => { const { [sel]: _, ...r } = n; return r; });
    setInvitadas((v) => { const { [sel]: _, ...r } = v; return r; });
    setLineaSel(null);
  };
  // Com. y extra: modificadores/comentarios de la línea seleccionada (re-clava al guardar).
  const comExtraSel = () => {
    if (!lineaSel) return;
    const p = prodDeKey(lineaSel);
    if (!p) return;
    const fid = claveBase(lineaSel).split("|")[1] || undefined;
    setModProd({ p, fid, reemplazar: lineaSel });
  };
  // Atribución visible solo si hay MÁS de un camarero en la cuenta (marca sutil por línea).
  const multiCamarero = new Set(Object.keys(comanda).map((k) => anadidoPor[k]?.id).filter(Boolean)).size > 1;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {renderVelo()}

      {/* ── Cuerpo: ticket+teclado | categorías+productos (sin cabecera de ancho
          completo: el título va dentro de la columna de cuenta, como el mockup) ── */}
      <div className="flex min-h-0 flex-1">

        {/* ─── Columna izquierda: [ticket + teclado] · rail (a altura completa) ─── */}
        <div className="flex w-[532px] flex-none border-r border-border bg-card">

          {/* Columna de contenido: ticket (crece) + teclado apilados. El border-r la separa
              del rail a lo alto (ticket + teclado), de arriba abajo. */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
          {/* Parte superior: cabecera + líneas + totales (crece para empujar el teclado al fondo). */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

          {/* Cabecera de cuenta (estilo Glop): alias · mesa · comensales · grupo cocina.
              El cliente se asigna desde el botón "Cliente" del rail; su nombre sale arriba. */}
          <CabeceraCuenta
            titulo={mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Ticket"}
            alias={alias}
            onAlias={setAlias}
            cliente={cliente?.nombre ?? null}
            tipoOperacion={tipoOperacion}
            notaMesa={notaMesa}
            mesaNombre={mesa?.nombre ?? null}
            esLlevar={!!llevar}
            comensales={comensales}
            onComensalesMenos={() => setComensales((n) => Math.max(1, n - 1))}
            onComensalesMas={() => setComensales((n) => n + 1)}
            grCocina={grCocina}
          />

          {/* Modo BARRA (sin mesa ni llevar): pista sutil de que puede cobrar directo
              o pasar la cuenta a una mesa / a barra para dejarla abierta. No bloquea nada. */}
          {!mesa && !llevar && unidades > 0 && (
            <div className="flex-none border-b border-border bg-brand/5 px-2.5 py-1.5 text-[11px] leading-tight text-muted-foreground">
              Cuenta de barra: <b className="text-foreground">cobra directo</b>, o usa <b className="text-foreground">Pasar mesa</b> / <b className="text-foreground">Aparcar</b> para dejarla abierta.
            </div>
          )}

          {/* Líneas del ticket (scroll táctil, sin barra de scroll visible) */}
          <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => { if (e.target === e.currentTarget) setLineaSel(null); }}>
            {unidades === 0 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">Añade productos</p>
            )}
            {/* Cabecera columnas */}
            {unidades > 0 && (
              <div className="sticky top-0 z-10 mb-1 flex items-center gap-1 border-b border-border bg-card px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex-1">Producto</span>
                <span className="w-[2.4rem] text-right">Uds</span>
                <span className="w-[4.2rem] text-right">Precio</span>
                <span className="w-[4.8rem] text-right">Total</span>
              </div>
            )}
            {Object.entries(comanda).map(([id, q]) => {
              const p    = prodDeKey(id);
              if (!p) return null;
              const pe   = precioEfectivo(id);
              const sel  = lineaSel === id;
              const desc = descuentos[id];
              const pm   = preciosManuales[id];
              const inv  = !!invitadas[id];
              const autor = anadidoPor[id];
              return (
                <button type="button"
                  key={id}
                  onClick={() => onLineaTap(id)}
                  className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    sel ? "bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_#0e8fa2]" : "hover:bg-accent"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate">{nombreDeKey(id)}</span>
                      {multiCamarero && autor && <span title={autor.nombre} className={`flex-none rounded px-1 text-[9px] font-semibold bg-muted text-muted-foreground`}>{iniciales(autor.nombre)}</span>}
                      {inv && <span className="inline-flex flex-none items-center gap-0.5 rounded bg-emerald-500/15 px-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400"><IconGift size={11} /> INVITADO</span>}
                      {(desc || pm) && (
                        <span className={`flex-none rounded px-1 text-[10px] font-medium tabular-nums bg-muted text-muted-foreground`}>
                          {pm ? `P:${eur(pm)}` : ""}
                          {desc ? (desc.tipo === "PCT" ? ` -${desc.valor}%` : ` -${eur(desc.valor)}`) : ""}
                        </span>
                      )}
                    </span>
                    {notas[id] && (
                      <span className="mt-0.5 block truncate text-[10px] text-amber-600 dark:text-amber-400">✎ {notas[id]}</span>
                    )}
                  </span>
                  <span className="w-[2.4rem] text-right font-medium tabular-nums">
                    {sel && editando && modo === "UND"
                      ? <span className="inline-block rounded-md bg-brand px-1.5 text-brand-foreground">{buffer || q}</span>
                      : q}
                  </span>
                  <span className="w-[4.2rem] text-right tabular-nums">
                    {sel && editando && modo !== "UND"
                      ? <span className="inline-block rounded-md bg-brand px-1.5 text-brand-foreground">{buffer || "0"}</span>
                      : eur(pe)}
                  </span>
                  <span className={`w-[4.8rem] text-right font-semibold tabular-nums ${inv ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{inv ? "Inv." : eur(pe * q)}</span>
                </button>
              );
            })}
          </div>

          {/* (Editor de línea retirado: la cantidad se cambia con el teclado (Und.),
              eliminar = "Anular línea" y la nota = "Com. y extra" en la fila de acciones.) */}

          {/* Banda de totales (UDS · PRECIO/DTO · ARTÍCULOS · TOTAL) + hint "toca la línea". */}
          <BarraTotales
            modo={modo}
            editando={editando}
            buffer={buffer}
            hayLinea={!!lineaSel}
            udsLinea={lineaSel ? (comanda[lineaSel] ?? 0) : 0}
            precioLinea={lineaSel ? precioEfectivo(lineaSel) : 0}
            unidades={unidades}
            total={total}
            eur={eur}
            edicion={editando && lineaSel ? {
              tipo: modo === "UND" ? "unidades" : modo === "PREC" ? "precio" : modo === "DTO%" ? "descuento %" : "descuento €",
              nombre: nombreDeKey(lineaSel),
              label: modo === "UND" ? "Und." : modo === "PREC" ? "Precio" : modo === "DTO%" ? "DTO%" : "DTO€",
            } : null}
          />
          {/* Fila de acciones de LÍNEA/extra (bajo los totales): Anular · Comp. menú · Com. y extra · Invitar. */}
          <FilaAccionesLinea
            haySeleccion={!!lineaSel}
            hayInvitadas={hayInvitadas}
            hayUnidades={!!unidades}
            onAnular={anularLineaSel}
            onCompMenu={abrirCompMenu}
            onComExtra={comExtraSel}
            onInvitar={() => { if (puede("invitar")) setModalInvitar(true); }}
          />
          </div>{/* fin parte superior */}

          {/* Teclado numérico bajo el ticket, dentro de la columna de contenido.
              El buffer (lo que se teclea) ya se ve en la barra de totales, en verde. */}
          <TecladoTPV
            modo={modo}
            editando={editando}
            onKey={handleKey}
            onModo={handleKey}
            onCobrar={() => setModalCobrar(true)}
            cobrarDisabled={!unidades || busy || !puede("cobrar")}
          />{/* fin teclado */}
          </div>{/* fin columna de contenido */}

          {/* Rail vertical de acciones de CUENTA a altura completa (ticket + teclado) */}
          <ColumnaFunciones {...accionesRapidasProps} />
        </div>

        {/* ─── Columna derecha: buscador + categorías arriba (fijas) + productos ─── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Buscador de producto (filtra el grid cross-categoría, como el mockup) */}
          <div className="flex flex-none items-center gap-2 px-[.7rem] pb-[.3rem] pt-[.55rem]">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5f6b7a]" />
              <input
                value={busqProd}
                onChange={(e) => setBusqProd(e.target.value)}
                placeholder="Buscar producto…"
                aria-label="Buscar producto"
                className="w-full rounded-md border border-border bg-surface-2 py-[.4rem] pl-9 pr-8 text-[13px] text-foreground outline-none placeholder:text-[#5f6b7a] focus:border-transparent focus:outline focus:outline-2 focus:outline-brand"
              />
              {buscando && (
                <button type="button" onClick={() => setBusqProd("")} aria-label="Limpiar búsqueda"
                  className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-base leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">×</button>
              )}
            </div>
            {/* Flechas de scroll de categorías, al lado del buscador */}
            <button type="button" onClick={() => scrollBox(catScrollRef, -1)} className="grid h-8 w-8 flex-none place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent" aria-label="Subir categorías"><ChevronUp size={16} /></button>
            <button type="button" onClick={() => scrollBox(catScrollRef, 1)} className="grid h-8 w-8 flex-none place-items-center rounded-md border border-border bg-card text-muted-foreground hover:bg-accent" aria-label="Bajar categorías"><ChevronDown size={16} /></button>
          </div>
          {/* Categorías (todas), a color. Sin familias, label ni fila de flechas (van junto al buscador). */}
          <div className="flex h-2/5 flex-none flex-col border-b border-border px-2 pb-2 pt-1">
            {gridCategorias}
          </div>
          {/* Productos de la categoría seleccionada, debajo */}
          <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-1.5" style={{ borderLeftWidth: 4, borderLeftColor: colorActual || "transparent" }}>
                <span className="mr-auto truncate text-sm font-semibold">{buscando ? `Resultados · «${busqProd.trim()}»` : (catActual?.nombre ?? "Productos")}</span>
                <button type="button" onClick={() => scrollBox(prodScrollRef, -1)} className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card hover:bg-accent" aria-label="Subir productos"><ChevronUp size={16} /></button>
                <button type="button" onClick={() => scrollBox(prodScrollRef, 1)} className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card hover:bg-accent" aria-label="Bajar productos"><ChevronDown size={16} /></button>
              </div>
              <div ref={prodScrollRef} className="flex-1 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {gridProductos}
              </div>
          </div>
        </div>

        {/* ─── Rail de salas (layout fijo estilo Glop): Ticket es la pestaña activa en venta ─── */}
        {railSalas("TICKET")}
      </div>

      {/* ── Barra de estado inferior (estilo Glop) ── */}
      <BarraEstado
        operario={operario?.nombre}
        terminal={terminal}
        contexto={mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Ticket"}
        cajaAbierta={cajaAbierta}
      />

      {/* ── Modal: Cliente y comensales ── */}
      {modalCliente && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalCliente(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Cliente y comensales</h3>
            {cliente && (
              <div className="mb-3 flex items-center justify-between rounded-md border border-brand bg-brand/10 px-3 py-2 text-sm">
                <span>Asignado: <b>{cliente.nombre}</b></span>
                <button type="button" onClick={() => setCliente(null)} className="text-rose-600 hover:underline">Quitar</button>
              </div>
            )}
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Comensales</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setComensales((n) => Math.max(0, n - 1))} className="h-8 w-8 rounded-md border border-border">−</button>
                <span className="w-8 text-center tabular-nums font-semibold">{comensales}</span>
                <button type="button" onClick={() => setComensales((n) => n + 1)} className="h-8 w-8 rounded-md border border-border">+</button>
              </div>
            </div>
            <input
              aria-label="Buscar cliente"
              value={busqCliente}
              onChange={(e) => buscarClientes(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            {clientesEnc.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {clientesEnc.map((c) => (
                  <button type="button" key={c.id} onClick={() => asignarCliente(c)} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent">
                    <span>{c.nombre}</span>
                    <span className="text-xs text-muted-foreground">{c.telefono ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente nuevo</div>
              <div className="flex gap-2">
                <input aria-label="Nombre del cliente" value={nuevoCli.nombre} onChange={(e) => setNuevoCli((c) => ({ ...c, nombre: e.target.value }))} placeholder="Nombre" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                <input aria-label="Teléfono del cliente" value={nuevoCli.telefono} onChange={(e) => setNuevoCli((c) => ({ ...c, telefono: e.target.value }))} placeholder="Teléfono" className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
                <button type="button" onClick={crearClienteRapido} disabled={!nuevoCli.nombre.trim()} className="btn-primary disabled:opacity-50">Crear</button>
              </div>
            </div>
            <button type="button" onClick={() => setModalCliente(false)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Pasar a mesa ── */}
      {modalPasarMesa && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalPasarMesa(false)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Pasar la cuenta a…</h3>
            <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
              {mesas.filter((m) => !mesa || m.id !== mesa.id).map((m) => (
                <button type="button" key={m.id} onClick={() => pasarAMesa(m)} disabled={busy}
                  className={`flex h-16 flex-col items-center justify-center rounded-md border text-sm disabled:opacity-50 ${m.estado === "OCUPADA" ? "border-amber-500 bg-amber-500/10" : "border-border hover:bg-accent"}`}>
                  <span className="font-semibold">{m.nombre}</span>
                  <span className="text-[10px] text-muted-foreground">{m.estado === "OCUPADA" ? "Ocupada" : "Libre"}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setModalPasarMesa(false)} className="btn-ghost mt-3 w-full">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Cuentas aparcadas ── */}
      {modalAparcados && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalAparcados(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Cuentas aparcadas</h3>
            <div className="space-y-1">
              {aparcados.map((o) => (
                <button type="button" key={o.id} onClick={() => recuperarAparcado(o)} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent">
                  <span className="font-medium">{o.aparcado_como || `Barra ${hhmm(o.created_at)}`}</span>
                  <span className="tabular-nums text-muted-foreground">{eur(Number(o.total))}</span>
                </button>
              ))}
              {aparcados.length === 0 && <p className="text-sm text-muted-foreground">No hay cuentas aparcadas.</p>}
            </div>
            <button type="button" onClick={() => setModalAparcados(false)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Dividir cuenta (DividirCuentaModal): reparte líneas en documentos ── */}
      {modalDividir && (
        <DividirCuentaModal
          lineas={lineasComanda().map((l) => ({ id: l.id, nombre: l.nombre, uds: l.cantidad, precio: l.precio }))}
          total={total}
          comensales={comensales}
          onAceptar={dividirAceptar}
          onCobrarTodos={() => { setModalDividir(false); setModalCobrar(true); }}
          onCancelar={() => setModalDividir(false)}
          onAbrirCajon={() => void window.gluuh?.abrirCajon()}
        />
      )}

      {/* ── Modal: confirmar borrar cuenta ── */}
      {pedirBorrar && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setPedirBorrar(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold">¿Borrar la cuenta?</h3>
            <p className="mb-4 text-sm text-muted-foreground">Se anulará el pedido (queda registrado) y se liberará la mesa.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPedirBorrar(false)} className="btn-ghost flex-1">Cancelar</button>
              <button type="button" onClick={borrarCuenta} disabled={busy} className="btn-primary flex-1 bg-rose-600 disabled:opacity-50">Borrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Popover: venta por peso (kg) ── */}
      {pesoPop && (() => {
        const kg = Number(pesoInput.replace(",", ".")) || 0;
        return (
          <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setPesoPop(null)}>
            <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center shadow-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-1 font-semibold">{pesoPop.nombre}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{eur(pesoPop.precio)} / kg</p>
              <input aria-label="Peso en kg" autoFocus inputMode="decimal" value={pesoInput}
                onChange={(e) => setPesoInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && kg > 0) { addProd(`${pesoPop.id}|@${kg}`); setPesoPop(null); } }}
                placeholder="0,000" className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-2xl tabular-nums outline-none focus:border-brand" />
              <div className="mt-1 text-xs text-muted-foreground">kg</div>
              <div className="mt-3 rounded-md bg-muted/50 py-2 text-2xl font-bold tabular-nums">{eur(pesoPop.precio * kg)}</div>
              <button type="button" onClick={() => { if (kg > 0) { addProd(`${pesoPop.id}|@${kg}`); setPesoPop(null); } }} disabled={kg <= 0} className="btn-primary mt-4 w-full disabled:opacity-50">Añadir</button>
              <button type="button" onClick={() => setPesoPop(null)} className="btn-ghost mt-2 w-full">Cancelar</button>
            </div>
          </div>
        );
      })()}

      {/* ── Modal: Invitaciones en ticket (marca qué líneas invitar) ── */}
      {modalInvitar && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalInvitar(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 font-semibold"><IconGift size={18} className="text-emerald-600 dark:text-emerald-400" /> Invitaciones en ticket</h3>
              <span className="text-xs text-muted-foreground">Marca lo que invitas</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {unidades === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No hay líneas en el ticket.</p>}
              {Object.entries(comanda).map(([id, q]) => {
                const p = prodDeKey(id); if (!p) return null;
                const inv = !!invitadas[id];
                return (
                  <button type="button" key={id} onClick={() => setInvitadas((v) => ({ ...v, [id]: !v[id] }))}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${inv ? "bg-emerald-500/10" : "hover:bg-accent"}`}>
                    <span className={`grid h-5 w-5 flex-none place-items-center rounded border text-xs leading-none ${inv ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"}`}>{inv ? "✓" : ""}</span>
                    <span className="min-w-0 flex-1 truncate">{nombreDeKey(id)}</span>
                    <span className="w-7 text-right tabular-nums text-muted-foreground">{q}</span>
                    <span className={`w-16 text-right tabular-nums ${inv ? "text-emerald-600 line-through opacity-70" : ""}`}>{eur(precioEfectivo(id) * q)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">Invitado:{" "}
                <b className="text-emerald-600 dark:text-emerald-400">{eur(Object.entries(comanda).reduce((s, [id, q]) => s + (invitadas[id] ? precioEfectivo(id) * q : 0), 0))}</b>
              </span>
              <button type="button" onClick={() => setInvitadas(Object.fromEntries(Object.keys(comanda).map((k) => [k, true])))} className="btn-ghost ml-auto text-xs">Invitar todo</button>
              <button type="button" onClick={() => setInvitadas({})} className="btn-ghost text-xs">Quitar</button>
              <button type="button" onClick={() => setModalInvitar(false)} className="btn-primary text-sm">Hecho</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modificadores (ModificadoresModal): comentarios + extras + nota ── */}
      {modProd && (() => {
        const grupos = gruposDe(modProd.p.id);
        const fmt = modProd.fid ? (formatos[modProd.p.id] ?? []).find((f) => f.id === modProd.fid) : undefined;
        const precioBase = fmt ? fmt.precio : modProd.p.precio;
        // Grupos "comentario": por tipo (0064) o, si aún no hay tipo, todas sus
        // opciones sin precio (punto de la carne…).
        const gruposComentario = grupos
          .filter((g) => g.opciones.length > 0 && (g.tipo ? g.tipo === "COMENTARIO" : g.opciones.every((o) => o.precio_extra === 0)))
          // unica: los grupos obligatorios de una opción (min_sel≥1, p. ej. "Punto de la carne")
          // salen como selección única (radio) en el modal.
          .map((g) => ({ nombre: g.nombre, min: g.min_sel, unica: g.min_sel >= 1, opciones: g.opciones.map((o) => ({ id: o.id, nombre: o.nombre })) }));
        // Extras = opciones con precio (suman al total y a la clave de comanda).
        const extras = grupos.flatMap((g) => g.opciones).filter((o) => o.precio_extra > 0)
          .map((o) => ({ id: o.id, nombre: o.nombre, precioExtra: o.precio_extra }));
        // Al re-editar ("Com. y extra"): precarga los mods desde la clave y el
        // comentario manual desde la nota (quitando los nombres de comentario ya listados).
        let seleccionInicial: SeleccionModificadores | undefined;
        if (modProd.reemplazar) {
          const ids = (claveBase(modProd.reemplazar).split("|")[2] || "").split(",").filter(Boolean);
          const comentarios = ids.filter((id) => (modById[id]?.precio_extra ?? 0) === 0);
          const extrasUds: Record<string, number> = {};
          for (const id of ids) if ((modById[id]?.precio_extra ?? 0) > 0) extrasUds[id] = (extrasUds[id] ?? 0) + 1;
          const nombresComentario = new Set(comentarios.map((id) => modById[id]?.nombre).filter(Boolean));
          const comentarioManual = (notas[modProd.reemplazar] ?? "")
            .split("·").map((s) => s.trim()).filter((s) => s && !nombresComentario.has(s)).join(" · ");
          seleccionInicial = { comentarios, extras: Object.entries(extrasUds).map(([id, uds]) => ({ id, uds })), comentarioManual };
        }
        // Unidades de partida del stepper: al re-editar, las de la línea; si no, las del teclado (Und).
        const bufferUds = modo === "UND" ? (Number(buffer.replace(",", ".")) || 1) : 1;
        const unidadesInicial = modProd.reemplazar ? (comanda[modProd.reemplazar] ?? 1) : bufferUds;
        // Anotaciones rápidas del tenant agrupadas por su `descripcion` (Punto de la
        // carne · Cuajado · Preparación · Alergias…). Orden = el de la consulta.
        const anotacionesAgrupadas: { grupo: string; opciones: string[] }[] = [];
        for (const n of notasPrep) {
          const g = (n.descripcion ?? "").trim() || "Anotaciones";
          const ult = anotacionesAgrupadas[anotacionesAgrupadas.length - 1];
          if (ult && ult.grupo === g) ult.opciones.push(n.nombre);
          else anotacionesAgrupadas.push({ grupo: g, opciones: [n.nombre] });
        }
        return (
          <ModificadoresModal
            producto={{ nombre: modProd.p.nombre, precio: precioBase }}
            gruposComentario={gruposComentario}
            extras={extras}
            anotaciones={anotacionesAgrupadas}
            seleccionInicial={seleccionInicial}
            unidadesInicial={unidadesInicial}
            onGuardar={guardarModificadores}
            onCancelar={() => setModProd(null)}
          />
        );
      })()}

      {/* ── Menú por pasos (MenuModal): "Comp. menú". Un menú → añade UNA línea de comanda ── */}
      {menuAbierto && (
        <MenuModal
          menu={menuAbierto}
          onAceptar={(seleccion) => anadirMenu(menuAbierto, seleccion)}
          onCancelar={() => setMenuAbierto(null)}
        />
      )}
      {/* Selector de menú cuando hay ≥2 (con uno solo, "Comp. menú" abre el MenuModal directo) */}
      {selectorMenus && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setSelectorMenus(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Elige un menú</h3>
            <div className="space-y-1.5">
              {menus.map((m) => (
                <button type="button" key={m.id}
                  onClick={() => { setSelectorMenus(false); setMenuAbierto(m); }}
                  className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">
                  <span className="font-medium">{m.nombre}</span>
                  <span className="tabular-nums">{eur(m.precio)}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSelectorMenus(false)} className="btn-ghost mt-3 w-full">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Popover: elegir formato de venta (caña/copa/botella…) ── */}
      {formatoPop && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setFormatoPop(null)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">{formatoPop.nombre}</h3>
            <div className="space-y-1.5">
              {(formatos[formatoPop.id] ?? []).map((f) => (
                <button type="button" key={f.id}
                  onClick={() => {
                    const p = formatoPop;
                    setFormatoPop(null);
                    if ((gruposMod[p.id] ?? []).length) abrirModificadores(p, f.id);
                    else finalizarLinea(p, f.id, []);
                  }}
                  className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">
                  <span className="font-medium">{f.nombre}</span>
                  <span className="tabular-nums">{eur(f.precio)}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setFormatoPop(null)} className="btn-ghost mt-3 w-full">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Popover: Agotar / reactivar producto (pulsación larga) ── */}
      {agotarPop && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setAgotarPop(null)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold">{agotarPop.nombre}</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {estaAgotado(agotarPop) ? "Marcado como agotado." : "Disponible."}
            </p>
            {estaAgotado(agotarPop) ? (
              <button type="button" onClick={() => toggleAgotado(agotarPop, false)} className="btn-primary w-full">Reactivar</button>
            ) : (
              <button type="button" onClick={() => toggleAgotado(agotarPop, true)} className="btn-primary w-full">Agotar hoy</button>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">«Agotar hoy» se reactiva solo mañana.</p>
            <button type="button" onClick={() => setAgotarPop(null)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Nuevo producto (alta rápida) ── */}
      {modalNuevoProd && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalNuevoProd(false)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold">Nuevo producto</h3>
            <p className="mb-3 text-sm text-muted-foreground">Rellena lo básico; el resto lo completas luego en la carta.</p>
            <div className="space-y-2">
              <input aria-label="Nombre del producto" autoFocus value={nuevoProd.nombre}
                onChange={(e) => setNuevoProd((s) => ({ ...s, nombre: e.target.value }))}
                placeholder="Nombre" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
              <div className="flex gap-2">
                <input aria-label="Precio" inputMode="decimal" value={nuevoProd.precio}
                  onChange={(e) => setNuevoProd((s) => ({ ...s, precio: e.target.value }))}
                  placeholder="Precio €" className="w-28 rounded-md border border-border bg-background px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-brand" />
                <select aria-label="Clase fiscal" value={nuevoProd.clase}
                  onChange={(e) => setNuevoProd((s) => ({ ...s, clase: e.target.value }))}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-2 text-sm">
                  {CLASES_FISCALES.map((c) => <option key={c.v} value={c.v}>{c.t} · {ivaAuto(c.v, territorio)}%</option>)}
                </select>
              </div>
              <select aria-label="Familia / categoría" value={nuevoProd.categoryId}
                onChange={(e) => setNuevoProd((s) => ({ ...s, categoryId: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
                {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                  📷 Foto<input type="file" accept="image/*" className="hidden" onChange={onFotoRapida} />
                </label>
                {nuevoProd.foto_url && <img src={nuevoProd.foto_url} alt="" className="h-9 w-9 rounded object-cover" />}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => crearProductoRapido(false)} disabled={!nuevoProd.nombre.trim() || !nuevoProd.precio || busy} className="btn-ghost flex-1 disabled:opacity-50">Crear</button>
              <button type="button" onClick={() => crearProductoRapido(true)} disabled={!nuevoProd.nombre.trim() || !nuevoProd.precio || busy} className="btn-primary flex-1 disabled:opacity-50">Crear y añadir</button>
            </div>
            <button type="button" onClick={() => setModalNuevoProd(false)} className="btn-ghost mt-2 w-full">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Utilidades ── */}
      {modalUtilidades && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalUtilidades(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Utilidades</h3>
            <div className="space-y-1.5">
              {window.gluuh && (
                <button type="button" onClick={() => { setModalUtilidades(false); void window.gluuh?.abrirCajon(); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">Abrir cajón</button>
              )}
              <button type="button" onClick={reprimirUltimo} disabled={!ultimoDoc} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-40">Reimprimir último ticket</button>
              <button type="button" onClick={() => { setModalUtilidades(false); router.push("/modulos"); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">Módulos y pantallas</button>
              <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">{resolvedTheme === "dark" ? "Modo claro ☀️" : "Modo oscuro 🌙"}</button>
              <button type="button" onClick={() => { setModalUtilidades(false); salirOperario(); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-accent">Salir del operario</button>
            </div>
            <button type="button" onClick={() => setModalUtilidades(false)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Cobrar (CobrarModal): pago mixto, propina, descuento, F10/F11/F12 ── */}
      {modalCobrar && (
        <CobrarModal
          total={total}
          baseImponible={desgloseCobro.base}
          impuesto={desgloseCobro.impuesto}
          cliente={cliente?.nombre}
          empleado={operario?.nombre}
          terminal={terminal}
          formasPago={formasPago}
          onCobrar={cobrarDesdeModal}
          onImprimirCuenta={imprimirRecibo}
          onCancelar={() => setModalCobrar(false)}
        />
      )}

      {/* ── Modal ticket (resumen en pantalla) ── */}
      {ticket && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={reset}>
          <div
            className="w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center font-mono text-sm shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-base font-semibold">Ticket cobrado</div>
            {ticket.impuestos.desglose.map((d) => (
              <div key={d.tipo} className="flex justify-between">
                <span>{ticket.impuestos.impuesto} {d.tipo}%</span>
                <span className="tabular-nums">{eur(d.cuota)}</span>
              </div>
            ))}
            <div className="my-1 flex justify-between border-t border-border pt-1 font-semibold tabular-nums">
              <span>TOTAL</span><span>{eur(ticket.impuestos.importeTotal)}</span>
            </div>
            {VERIFACTU_ACTIVO ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket.verifactu.qrDataUrl} alt="QR VERIFACTU" className="mx-auto my-2 h-32 w-32" />
                <div className="font-semibold">{ticket.verifactu.leyenda}</div>
                <div className="text-xs text-muted-foreground">{ticket.numSerieFactura}</div>
              </>
            ) : (
              <div className="my-2 rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                TICKET DE PRUEBA · sin validez fiscal
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={imprimirRecibo} className="btn-ghost flex-1">Imprimir</button>
              <button type="button" onClick={() => { reset(); if (bloqueoAlCobrar) setBloqueado(true); }} className="btn-primary flex-1">Nueva venta</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
