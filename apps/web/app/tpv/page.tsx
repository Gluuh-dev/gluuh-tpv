"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { estacionDe, ESTACION_LABEL } from "../lib/estaciones";
import { leerBranding, BRANDING_DEFAULT, subirMedia, type Branding } from "../lib/branding";
import { imprimirTicket, imprimirComanda, resolverImpresora, formatearTicket, guardarTicketComoFichero, type TicketImpresion, type ConfigImpresion } from "../lib/impresion";
import { encolarComandas } from "../lib/print-routing";
import { claveBase, claveDeLinea, claveParaAnadir } from "./clave-linea";
import { precioEfectivo as precioEfectivoPuro } from "./precio";
import { toast } from "@/app/lib/toast";
import { escucharCambios } from "../lib/cambios";
import { getSetting } from "../lib/settings";
import { exportarBackupLocal } from "../lib/backup-local";
import { useTpvStore } from "./hooks/useTpvStore";
import { useTPVKeyboard } from "./hooks/useTPVKeyboard";
import { PlanoSalas } from "./components/PlanoSalas";
import { BarraEstado } from "./components/BarraEstado";
import { ColumnaFunciones } from "./components/ColumnaFunciones";
import dynamic from "next/dynamic";
import type { SeleccionModificadores } from "./components/ModificadoresModal";
import type { CobrarOpciones, LineaPago } from "./components/CobrarModal";
import { CabeceraCuenta } from "./components/CabeceraCuenta";
import { BarraTotales } from "./components/BarraTotales";
import { FilaAccionesLinea } from "./components/FilaAccionesLinea";
import { TileProducto } from "./components/TileProducto";
import { TileCategoria } from "./components/TileCategoria";
import { TecladoTPV } from "./components/TecladoTPV";
import { RailSalas, type RailTab } from "./components/RailSalas";
import { useCatalogo, gruposDeProducto, categoriaDisponible, type Prod } from "../lib/catalogo-store";
import { CLASES_FISCALES, ivaAuto } from "@/lib/fiscal-clases";
import { Plus, ChevronUp, ChevronDown, Search,
  Receipt, Store, Armchair, Sun, ShoppingBag, CalendarCheck,
  Beer, Coffee, CupSoda, Wine, Beef, Sandwich, Pizza, UtensilsCrossed, Croissant, CakeSlice, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSurfaceTheme } from "@/app/lib/surface-theme";
import { IconGift } from "@tabler/icons-react";
import { eur } from "@/app/lib/money";
import { urlFoto } from "@/app/lib/urlFoto";

/* ─── Tipos ─── */
interface Mesa   { id: string; nombre: string; estado: string; room_id: string | null; pos_x: number | null; pos_y: number | null; capacidad: number; rotacion: number; sprite?: string | null; color?: string | null }
interface Room   { id: string; nombre: string; orden: number; suelo: string | null }
interface Reserva { id: string; table_id: string | null; fecha_hora: string; comensales: number; estado: string; notas: string | null; nombre: string | null }
interface Elemento { id: string; room_id: string; tipo: string; etiqueta: string | null; icono: string | null; pos_x: number; pos_y: number; ancho: number; alto: number; rotacion: number; color?: string | null }
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
// Iniciales del camarero para la marca sutil de atribución por línea.
const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
const TERR: Record<string, string> = {
  PENINSULA_BALEARES: "PENINSULA_BALEARES", CANARIAS: "CANARIAS",
  CEUTA_MELILLA: "CEUTA_MELILLA", FORAL_PV: "PENINSULA_BALEARES", FORAL_NAVARRA: "PENINSULA_BALEARES",
};

// VERIFACTU DESACTIVADO: no se persiste ni encadena ninguna factura todavía.
// Pagos en modo PRUEBA (ficticios). DECISIÓN (06-07-2026): se queda así durante
// TODO el desarrollo; activar la fiscalidad real será lo ÚLTIMO antes de vender.
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

/* ─── Modales PESADOS fuera del chunk inicial (~1.400 líneas entre los cuatro).
   Así el TPV hidrata antes al arrancar. NO se trocea PlanoSalas: es la pantalla
   de ENTRADA (navSala arranca en true) y diferirla retrasaría el primer pintado.
   Se precargan en segundo plano tras arrancar (ver el efecto de precarga), para
   que el primer "Cobrar" no tenga que esperar a la red. ─── */
const ModificadoresModal = dynamic(() => import("./components/ModificadoresModal").then((m) => m.ModificadoresModal), { ssr: false });
const MenuModal = dynamic(() => import("./components/MenuModal").then((m) => m.MenuModal), { ssr: false });
const DividirCuentaModal = dynamic(() => import("./components/DividirCuentaModal").then((m) => m.DividirCuentaModal), { ssr: false });
const CobrarModal = dynamic(() => import("./components/CobrarModal").then((m) => m.CobrarModal), { ssr: false });

/* ─── Recuadro verde con lo tecleado, dentro de la línea seleccionada ───
   Se suscribe ÉL SOLO al buffer/modo/editando: teclear re-renderiza este span,
   no la página entera (plan 011). tipo UND = columna de unidades; PRECIO = la
   de precio (activo cuando el modo NO es UND). */
function BufferEnLinea({ tipo, fallback }: { tipo: "UND" | "PRECIO"; fallback: React.ReactNode }) {
  const buffer = useTpvStore((s) => s.buffer);
  const modo = useTpvStore((s) => s.modo);
  const editando = useTpvStore((s) => s.editando);
  const activo = editando && (tipo === "UND" ? modo === "UND" : modo !== "UND");
  if (!activo) return <>{fallback}</>;
  return <span className="inline-block rounded-md bg-brand px-1.5 text-brand-foreground">{buffer || (tipo === "UND" ? fallback : "0")}</span>;
}

/* ─── Callback de identidad ESTABLE que siempre invoca la última versión (patrón
   useEvent): permite memoizar hijos (ColumnaFunciones, RailSalas) sin closures
   obsoletos en sus handlers. ─── */
function useEventCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}


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
  const [navSala, setNavSala] = useState(true);
  const [lineasGuardadas, setLineasGuardadas] = useState<Set<string>>(new Set());
  // Mesa preseleccionada en el plano: 1er toque = ver cuenta; 2º toque = abrir en TPV.
  const [mesaSel, setMesaSel] = useState<Mesa | null>(null);
  const [mesaSelInfo, setMesaSelInfo] = useState<{ apertura: string; importe: number; comensales: number | null; nota?: string; lineas: { nombre: string; cantidad: number; precio: number }[] } | null>(null);
  const catScrollRef = useRef<HTMLDivElement | null>(null);   // scroll de categorías
  const prodScrollRef = useRef<HTMLDivElement | null>(null);  // scroll de productos
  // Traspaso entre mesas (estilo Glop): elige origen → botón → toca destino.
  const [modoTraspaso, setModoTraspaso] = useState<null | "MESA" | "LINEAS">(null);
  const [traspLineas, setTraspLineas] = useState<Record<string, number>>({});
  const [notaMesa, setNotaMesa] = useState("");   // nota de la cuenta abierta en el TPV
  /* Para llevar (cuenta sin mesa, con nombre + teléfono) */
  const llevar = useTpvStore((s) => s.llevar);
  const setLlevar = useTpvStore((s) => s.setLlevar);
  const [llevarList, setLlevarList] = useState<{ id: string; cliente_nombre: string; cliente_telefono: string | null; total: number }[]>([]);
  // Catálogo desde el store Zustand (compartido, no re-fetch al cambiar de pantalla).
  const families = useCatalogo((s) => s.families);
  const cats     = useCatalogo((s) => s.cats);
  const prods    = useCatalogo((s) => s.prods);
  const prodCats = useCatalogo((s) => s.prodCats);   // categorías por producto (m2m Fase 1)
  const setProds = useCatalogo((s) => s.setProds);
  const [menus, setMenus] = useState<MenuTPV[]>([]);   // menús/combos del tenant (Carta → Menús); [] si no hay o falla la carga
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  /* ── Operario activo (quién opera; persiste hasta "Salir") ── */
  const [operario, setOperario] = useState<{ id: string; nombre: string } | null>(null);
  const [operarios, setOperarios] = useState<{ id: string; nombre: string; rol: string; codigo: string | null }[]>([]);
  const [pinUser, setPinUser] = useState<{ id: string; nombre: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  /* ── Selección de contexto ── */
  const mesa = useTpvStore((s) => s.mesa);
  const setMesa = useTpvStore((s) => s.setMesa);
  const [barra, setBarra] = useState(false);
  /* Cuenta abierta de la mesa (un pedido reutilizable por mesa) + importes por mesa */
  const ordenAbiertaId = useTpvStore((s) => s.ordenAbiertaId);
  const setOrdenAbiertaId = useTpvStore((s) => s.setOrdenAbiertaId);
  const [totalesMesa, setTotalesMesa] = useState<Record<string, number>>({});

  /* ── Funciones de cuenta (columna estilo Glop) ── */
  const cliente = useTpvStore((s) => s.cliente);
  const setCliente = useTpvStore((s) => s.setCliente);
  const comensales = useTpvStore((s) => s.comensales);
  const setComensales = useTpvStore((s) => s.setComensales);
  const alias = useTpvStore((s) => s.alias);
  const setAlias = useTpvStore((s) => s.setAlias);
  const tipoOperacion = useTpvStore((s) => s.tipoOperacion);
  const setTipoOperacion = useTpvStore((s) => s.setTipoOperacion);
  const [aparcados, setAparcados] = useState<{ id: string; aparcado_como: string | null; total: number; created_at: string }[]>([]);
  // Desglose de líneas por cuenta abierta, para las tarjetas de la vista Barra.
  const [aparcadosLineas, setAparcadosLineas] = useState<Record<string, { nombre: string; cantidad: number; total: number }[]>>({});
  const [ultimoDoc, setUltimoDoc] = useState<TicketImpresion | null>(null);
  const [modalActivo, setModalActivo] = useState<'CLIENTE' | 'PASAR_MESA' | 'UTILIDADES' | 'APARCADOS' | 'DIVIDIR' | 'INVITAR' | 'NUEVO_PROD' | 'COBRAR' | null>(null);
  const { resolvedTheme } = useTheme();
  const { setSurfaceTheme } = useSurfaceTheme("tpv");   // tema propio del TPV (independiente del panel)
  const invitadas = useTpvStore((s) => s.invitadas);
  const setInvitadas = useTpvStore((s) => s.setInvitadas);
  const [busqCliente, setBusqCliente] = useState("");
  const [clientesEnc, setClientesEnc] = useState<{ id: string; nombre: string; telefono: string | null; nif: string | null }[]>([]);
  const [nuevoCli, setNuevoCli] = useState({ nombre: "", telefono: "", nif: "" });
  const [pedirBorrar, setPedirBorrar] = useState(false);
  const [nuevoProd, setNuevoProd] = useState({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: "", foto_url: "" });
  const [agotarPop, setAgotarPop] = useState<Prod | null>(null);
  const formatos  = useCatalogo((s) => s.formatos);
  const [formatoPop, setFormatoPop] = useState<Prod | null>(null);
  const gruposMod = useCatalogo((s) => s.gruposMod);
  const modById   = useCatalogo((s) => s.modById);
  const biblioteca   = useCatalogo((s) => s.biblioteca);     // grupos de biblioteca (0064, Fase 2)
  const asignaciones = useCatalogo((s) => s.asignaciones);   // herencia familia→categoría→producto
  const horariosCat  = useCatalogo((s) => s.horariosCat);    // franjas por categoría (0067)
  // Re-evalúa la disponibilidad por horario cada minuto (sin refetch). Sin
  // franjas configuradas no se arma el intervalo (evita un re-render/minuto).
  const [tickHorario, setTickHorario] = useState(0);
  useEffect(() => {
    if (!Object.keys(horariosCat).length) return;
    const t = setInterval(() => setTickHorario((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, [horariosCat]);
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
  // Ref "viva" de permisos: handleKey es estable (useCallback []) y necesita el valor actual.
  const permisosRef = useRef(permisos); permisosRef.current = permisos;
  const puede = (k: string) => permisos[k] !== false;   // ausente = permitido
  // Igual que puede() pero avisa si está bloqueado; para gatear acciones con feedback.
  const exige = (k: string) => { if (permisos[k] === false) { toast.warning("Tu perfil no permite esta acción."); return false; } return true; };
  const abrirCajonManual = () => { if (exige("abrir_cajon")) void window.gluuh?.abrirCajon(); };
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
  const modoZurdo = useTpvStore((s) => s.modoZurdo);
  const setModoZurdo = useTpvStore((s) => s.setModoZurdo);
  const pases = useTpvStore((s) => s.pases);
  const setPases = useTpvStore((s) => s.setPases);
  const comanda = useTpvStore((s) => s.comanda);
  const setComanda = useTpvStore((s) => s.setComanda);
  const descuentos = useTpvStore((s) => s.descuentos);
  const setDescuentos = useTpvStore((s) => s.setDescuentos);
  const preciosManuales = useTpvStore((s) => s.preciosManuales);
  const setPreciosManuales = useTpvStore((s) => s.setPreciosManuales);
  const notas = useTpvStore((s) => s.notas);
  const setNotas = useTpvStore((s) => s.setNotas);
  // Atribución por línea: quién (operario activo) añadió cada clave de comanda.
  const anadidoPor = useTpvStore((s) => s.anadidoPor);
  const setAnadidoPor = useTpvStore((s) => s.setAnadidoPor);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy]     = useState(false);
  // Guard SÍNCRONO de reentrada del cobro: `busy` (estado) tarda un render en
  // reflejarse y un doble toque rápido colaría dos cobros (dos filas payment).
  const cobrandoRef = useRef(false);

  /* ── Teclado ── La raíz NO se suscribe a buffer/modo/editando (plan 011):
     teclear solo re-renderiza BarraTotales, TecladoTPV y BufferEnLinea (se
     suscriben ellos); los handlers leen el valor vivo con getState(). Los
     setters sí se toman aquí (identidad estable, nunca re-renderizan). ── */
  const setBuffer = useTpvStore((s) => s.setBuffer);
  const setModo = useTpvStore((s) => s.setModo);
  const setEditando = useTpvStore((s) => s.setEditando);
  // Refs "vivas" para que addProd (capturado en el grid memoizado) decida la
  // clave con el estado ACTUAL de comanda/descuentos/precios, sin closures obsoletos.
  const comandaRef = useRef(comanda); comandaRef.current = comanda;
  const descuentosRef = useRef(descuentos); descuentosRef.current = descuentos;
  const preciosManualesRef = useRef(preciosManuales); preciosManualesRef.current = preciosManuales;
  const lineasGuardadasRef = useRef(lineasGuardadas); lineasGuardadasRef.current = lineasGuardadas;
  // Operario "vivo": addProd va capturado en el grid memoizado; el ref permite sellar
  // la atribución con el camarero ACTIVO tras un cambio de operario bajo el velo.
  const operarioRef = useRef(operario); operarioRef.current = operario;
  const lineaSel = useTpvStore((s) => s.lineaSel);
  const setLineaSel = useTpvStore((s) => s.setLineaSel);

  /* ── Modal cobrar (unifica efectivo + mixto) + formas de pago ── */
  const [formasPago, setFormasPago] = useState<FormaPagoTPV[]>(FORMAS_PAGO_FALLBACK);
  const [notasPrep, setNotasPrep] = useState<{ id: string; nombre: string; descripcion?: string | null }[]>([]);   // chips de anotación rápida (nota_preparacion); descripcion = grupo
  const [busqProd, setBusqProd] = useState("");   // buscador de producto (filtra el grid; cross-categoría)

  /* ── Carga inicial ── El gate de sesión va primero; TODO lo demás es
     independiente y sale en UNA ronda paralela (antes ~11 peticiones en
     escalera = varios segundos de "Cargando…"). Pase lo que pase, el velo de
     carga se quita (finally): el TPV no puede quedarse parado en "Cargando…". ── */
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      // Cuenta de empresa recién entregada: primero crea su contraseña.
      if (session.user.user_metadata?.debe_cambiar_password) { router.replace("/cambiar-password"); return; }
      // Operario activo desde localStorage (persiste hasta "Salir") + lista de operarios
      try { const raw = localStorage.getItem("gluuh_operario"); if (raw) setOperario(JSON.parse(raw)); } catch { /* ignore */ }
      try {
        const [ops, marcaV, loc, u, tn, , rms, rsv] = await Promise.all([
          sb.rpc("listar_operarios").then((r) => r.data),
          leerBranding(sb),
          sb.from("location").select("id,territorio_fiscal,nombre,razon_social,cif,direccion").limit(1).maybeSingle().then((r) => r.data),
          sb.from("app_user").select("id").eq("auth_user_id", session.user.id).maybeSingle().then((r) => r.data),
          sb.from("tenant").select("id").limit(1).maybeSingle().then((r) => r.data),
          useCatalogo.getState().cargar(sb),   // catálogo del store (cache + revalidación)
          sb.from("room").select("id,nombre,orden,suelo").order("orden").then((r) => r.data),
          sb.from("reservation").select("id,table_id,fecha_hora,comensales,estado,notas,nombre").order("fecha_hora").then((r) => r.data),
        ]);
        setOperarios((ops as { id: string; nombre: string; rol: string; codigo: string | null }[]) ?? []);
        setMarca(marcaV);
        setLocationId(loc?.id ?? null);
        setTenantId((tn as { id: string } | null)?.id ?? null);
        setTerritorio(loc?.territorio_fiscal ?? "PENINSULA_BALEARES");
        setLocInfo({ nombre: loc?.razon_social ?? loc?.nombre ?? "", cif: loc?.cif ?? "", direccion: loc?.direccion ?? "" });
        setUserId(u?.id ?? null);
        setCatSel(useCatalogo.getState().cats[0]?.id ?? null);
        setRooms((rms as Room[]) ?? []);
        setReservas((rsv as Reserva[]) ?? []);
        setVistaSala((rms as Room[])?.[0]?.id ?? "");
        // Mesas + elementos pintan el plano (primera pantalla): en paralelo entre sí.
        await Promise.all([recargarMesas(), recargarElementos()]);
      } catch (e) {
        console.error("Carga inicial del TPV incompleta", e);
        toast.error("No se pudo cargar todo el TPV. Comprueba la conexión.");
      } finally {
        setLoading(false);
      }
      void recargarLlevar();   // pestaña secundaria: no bloquea el primer pintado
    })();
    /* eslint-disable-next-line */
  }, []);

  /* ── Refresco automático del catálogo (D3) ── Si desde el backoffice o desde
       casa cambian productos/categorías/familias (p. ej. marcar un agotado), el
       TPV se actualiza solo en segundos, sin recargar. Debounce 800 ms para
       agrupar ráfagas. Si realtime no está en la publicación, no dispara (ok). */
  useEffect(() => escucharCambios(sb, {
    nombre: "tpv_catalogo",
    tablas: ["product", "category", "family"],
    debounceMs: 800,
    onCambio: () => { void useCatalogo.getState().cargar(sb, { force: true }); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  /* ── PLANO DE MESAS EN VIVO (0097) ── El comandero abre una mesa → aparece en
       TODOS los TPV al instante. Antes NO pasaba: el TPV solo escuchaba el catálogo,
       así que el plano solo se refrescaba tras una operación PROPIA o al recargar la
       página → el camarero podía estar mirando un plano mentiroso.
       (`restaurant_table` tampoco estaba publicada en realtime: lo arregla la 0097.)
       Estable por useEventCallback: recargarAparcados lee prodPorId y con deps [] se
       habría quedado con el catálogo VACÍO del primer render. ── */
  const refrescarSalas = useEventCallback(() => {
    void recargarMesas();
    void recargarAparcados();
    void recargarLlevar();
  });
  useEffect(() => escucharCambios(sb, {
    nombre: "tpv_salas",
    tablas: ["sales_order", "restaurant_table"],
    debounceMs: 400,   // se siente instantáneo y agrupa la ráfaga de una comanda
    onCambio: refrescarSalas,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  /* ── Precarga de los modales pesados (que van en chunks aparte, ver dynamic()
       arriba). Se traen cuando el TPV ya arrancó: el primer "Cobrar" no puede
       quedarse esperando a la red. ── */
  useEffect(() => {
    const t = setTimeout(() => {
      void import("./components/CobrarModal");
      void import("./components/DividirCuentaModal");
      void import("./components/ModificadoresModal");
      void import("./components/MenuModal");
    }, 1500);
    return () => clearTimeout(t);
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

  // Índice O(1) del catálogo: las derivadas de la comanda (prodDeKey, precioEfectivo,
  // nombres) se llaman por línea y por render; con .find() eran O(catálogo) cada una.
  const prodPorId = useMemo(() => {
    const m = new Map<string, Prod>();
    for (const p of catalogoConMenus) m.set(p.id, p);
    return m;
  }, [catalogoConMenus]);

  /* ── Formatos: la comanda se clavea por "productId" o "productId|formatId" ── */
  // clave: "productId" · "productId|formatId" · "productId|fid|mod1,mod2" (fid puede ir vacío),
  // con posible sufijo de unicidad "#n" que se ignora aquí (claveBase lo quita).
  const prodDeKey = (key: string) => prodPorId.get(claveBase(key).split("|")[0]!);
  // campo: usa nombre_ticket / nombre_cocina (0051) como nombre base cuando existan;
  // si no, cae al nombre normal (los sufijos de formato/peso/modificadores se conservan).
  function nombreDeKey(key: string, campo?: "nombre_ticket" | "nombre_cocina"): string {
    const [pid, fid, mods] = claveBase(key).split("|");
    const p = pid ? prodPorId.get(pid) : undefined;
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

  function nombreBaseDeKey(key: string, campo?: "nombre_ticket" | "nombre_cocina"): string {
    const [pid, fid] = claveBase(key).split("|");
    const p = pid ? prodPorId.get(pid) : undefined;
    if (!p) return "";
    const base = (campo && p[campo]) || p.nombre;
    if (fid?.startsWith("@")) return `${base} (${fid.slice(1)} kg)`;
    const fmt = fid ? (formatos[p.id] ?? []).find((f) => f.id === fid) : undefined;
    return fmt ? `${base} (${fmt.nombre})` : base;
  }

  interface ExtraDetalle {
    nombre: string;
    precio: number;
    uds: number;
  }

  function extraIngredientesDetallados(key: string): ExtraDetalle[] {
    const [, , mods] = claveBase(key).split("|");
    if (!mods) return [];
    const counts: Record<string, number> = {};
    for (const m of mods.split(",")) {
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return Object.entries(counts).map(([mId, uds]) => {
      const mod = modById[mId];
      return {
        nombre: mod?.nombre ?? mId,
        precio: mod?.precio_extra ?? 0,
        uds,
      };
    });
  }

  function obtenerBaseManualSiDifiere(baseKey: string, precioUnitario: number): number | undefined {
    const [pid, fid, mods] = baseKey.split("|");
    // Solo products reales (las líneas de menú llegan con product_id NULL y no pasan por aquí).
    const prod = pid ? prodPorId.get(pid) : undefined;
    if (!prod) return undefined;
    let calcBase = prod.precio;
    if (fid && !fid.startsWith("@")) {
      const fmt = (formatos[pid!] ?? []).find((f) => f.id === fid);
      if (fmt) calcBase = fmt.precio;
    }
    let calcTotal = calcBase;
    if (mods) {
      for (const m of mods.split(",")) {
        calcTotal += modById[m]?.precio_extra ?? 0;
      }
    }
    if (Math.abs(precioUnitario - calcTotal) > 0.01) {
      const extrasCost = calcTotal - calcBase;
      return Math.max(0, precioUnitario - extrasCost);
    }
    return undefined;
  }

  /* ── Precio efectivo (peso/formato + suplemento de modificadores + desc./precio manual).
     El cálculo vive en ./precio.ts (puro, con tests); aquí solo se le da el contexto. ── */
  const precioEfectivo = useMemo(() => {
    const ctx = { prodPorId, formatos, modById, preciosManuales, descuentos };
    return (id: string): number => precioEfectivoPuro(ctx, id);
  }, [prodPorId, formatos, modById, preciosManuales, descuentos]);

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
  const lineasComandaMemo = useMemo(
    () => Object.entries(comanda).map(([id, cantidad]) => {
      const p = prodDeKey(id)!;
      // Los menús no son un product real: productId=null → order_line con product_id NULL (FK-safe).
      const productId: string | null = menuIds.has(p.id) ? null : p.id;
      return { id, productId, nombre: nombreDeKey(id), cantidad, precio: precioEfectivo(id), tipo: p.tipo_impositivo, estacion: estacionDe(p.estacion) };
    }),
    // prodDeKey/nombreDeKey leen de prodPorId/formatos/modById (funciones del render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comanda, prodPorId, menuIds, precioEfectivo, formatos, modById],
  );
  const lineasComanda = () => lineasComandaMemo;

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

  /* ── Hook de Teclado y Pulsera ── */
  useTPVKeyboard({
    sb,
    operario,
    bloqueado,
    loginOperario,
  });

  /* ── Configuración de impresión (diseño del ticket + impresoras + rutas) ── */
  useEffect(() => {
    getSetting<ConfigImpresion>("impresion.config")
      .then((c) => { if (c) setCfgImpresion(c); })
      .catch(() => { /* sin config: diseño por defecto, sin enrutado */ });
    getSetting<string[]>("tpv.funciones.orden")
      .then((o) => { if (Array.isArray(o)) setOrdenFunciones(o); })
      .catch(() => { /* orden por defecto */ });
  }, []);

  /* ── Permisos del operario activo (qué puede hacer en el TPV) ──
     En vivo (como Ágora): si el operario tiene perfil, mandan los permisos del
     perfil; si no, los suyos propios (compat). Editar el perfil se refleja aquí. */
  useEffect(() => {
    if (!operario) { setPermisos({}); return; }
    // Con REINTENTO y rama de error: antes un fallo de red dejaba `permisos = {}`
    // en silencio y, como "ausente = permitido", el operario se quedaba con TODOS
    // los permisos sin que nadie se enterara. Ahora el fallo es VISIBLE.
    // ponytail: se mantiene el fail-open a propósito (denegar todo por un corte de
    // red dejaría al bar sin poder vender). El cierre real son límites en
    // SERVIDOR (RPC) — deuda anotada en plans/README.md; en cliente esto no se
    // puede asegurar contra alguien que manipule el estado.
    const cargarPermisos = async (reintento = false): Promise<void> => {
      const { data, error } = await sb.from("app_user").select("perfil(permisos)").eq("id", operario.id).maybeSingle();
      if (error) {
        if (!reintento) return cargarPermisos(true);
        console.error("No se pudieron cargar los permisos del operario:", error.message);
        toast.warning("No se pudieron cargar los permisos. Avisa al responsable.");
        return;   // conserva los permisos que hubiera; no los resetea a "todo permitido"
      }
      const d = data as { perfil?: { permisos?: Record<string, boolean> } | null } | null;
      setPermisos(d?.perfil?.permisos ?? {});
    };
    void cargarPermisos();
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
      lineas: lineasComanda().map((l) => ({
        cantidad: l.cantidad,
        nombre: nombreBaseDeKey(l.id, "nombre_ticket"),
        importe: l.precio * l.cantidad,
        extras: extraIngredientesDetallados(l.id).map((ext) => ({
          nombre: ext.nombre,
          cantidad: ext.uds,
          precioExtra: ext.precio,
        })),
      })),
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

    // Si se imprime la proforma (cuenta) de una mesa, actualizar estado a POR_COBRAR
    if (!ticket && mesa && ordenAbiertaId) {
      void (async () => {
        try {
          await sb.from("sales_order").update({ estado: "POR_COBRAR" }).eq("id", ordenAbiertaId);
          await sb.from("restaurant_table").update({ estado: "POR_COBRAR" }).eq("id", mesa.id);
          void recargarMesas();
        } catch (e) {
          console.warn("Fallo al actualizar mesa/pedido a POR_COBRAR", e);
        }
      })();
    }
    const doc: TicketImpresion = ticket
      ? construirTicketImpresion(ticket)
      : {
          local: locInfo,
          contexto: mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Barra",
          operario: operario?.nombre,
          lineas: lineasComanda().map((l) => ({
            cantidad: l.cantidad,
            nombre: nombreBaseDeKey(l.id, "nombre_ticket"),
            importe: l.precio * l.cantidad,
            extras: extraIngredientesDetallados(l.id).map((ext) => ({
              nombre: ext.nombre,
              cantidad: ext.uds,
              precioExtra: ext.precio,
            })),
          })),
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

  // Comandas de cocina/barra: al MARCHAR, imprime los artículos de cada partida
  // sin precios. En Gluuh Desktop imprime en local (por IP, latencia cero); en
  // móvil/navegador encola a la cola COMPARTIDA (print_job) enrutando por
  // estación × zona → impresora, y la despacha un Desktop (guía 15 §6.1).
  function imprimirComandas() {
    if (typeof window === "undefined") return;
    const contexto = mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Barra";
    const grupos = (["COCINA", "BARRA", "CAMARERO"] as const).map((estacion) => ({
      estacion,
      lineas: lineasComanda()
        .filter((l) => l.estacion === estacion)
        .map((l) => ({ 
          cantidad: l.cantidad, 
          nombre: nombreDeKey(l.id, "nombre_cocina"), 
          nota: notas[l.id]?.trim() || undefined,
          pase: pases[l.id] || null
        })),
    }));

    if (window.gluuh) {
      for (const [estacion, tipoDoc] of [["COCINA", "COMANDA_COCINA"], ["BARRA", "COMANDA_BARRA"]] as const) {
        const lineas = grupos.find((g) => g.estacion === estacion)?.lineas ?? [];
        if (!lineas.length) continue;
        void imprimirComanda({ contexto, operario: operario?.nombre, nota: notaMesa || undefined, lineas }, estacion, resolverImpresora(cfgImpresion, tipoDoc));
      }
      return;
    }
    // Sin Desktop: cola compartida (la comandera móvil hace salir la comanda en cocina).
    void encolarComandas(sb, { contexto, roomId: mesa?.room_id ?? null, operario: operario?.nombre, grupos });
  }

  /* ── Operaciones de comanda ── */
  // Añade `id` a la comanda y devuelve la clave REAL usada (puede llevar "#n" si
  // hubo que separar la línea para no contagiar un descuento/precio manual).
  const addProd = (id: string): string => {
    // Lee buffer/modo con getState() (valor VIVO): el grid memoizado captura addProd
    // y la raíz ya no está suscrita al teclado (plan 011).
    const { buffer: buf, modo: m } = useTpvStore.getState();
    const qty = m === "UND" ? (Number(buf.replace(",", ".")) || 1) : 1;
    // ponytail: comandaRef puede quedar 1 tick atrás si se dispara 2 veces en el
    // mismo render; en ese caso peor caso = fusiona en la misma #n (uds sumadas), no rompe.
    const clave = claveParaAnadir(id, comandaRef.current, (k) =>
      descuentosRef.current[k] !== undefined ||
      preciosManualesRef.current[k] !== undefined ||
      lineasGuardadasRef.current.has(k)
    );
    setComanda((c) => ({ ...c, [clave]: (c[clave] ?? 0) + qty }));
    // Atribución: sella la línea con el operario ACTIVO (por ref: sobrevive al cambio de camarero).
    const op = operarioRef.current;
    if (op) setAnadidoPor((a) => ({ ...a, [clave]: { id: op.id, nombre: op.nombre } }));
    if (m === "UND") { setBuffer(""); setEditando(false); }
    setLineaSel(clave);   // al añadir, la línea nueva queda marcada
    return clave;
  };

  /* ── Teclado (con MODO: Unidad/Precio/Descuento reflejado en la barra) ── */
  // Tap en una línea del ticket: la marca (siempre hay una marcada); cancela edición.
  function onLineaTap(id: string) {
    setEditando(false); setModo("UND"); setBuffer("");
    setLineaSel(id);
  }
  // ESTABLE (useCallback []): lee buffer/modo/editando/lineaSel con getState() y
  // los permisos por ref → TecladoTPV (memo) no re-renderiza por identidad de props.
  const handleKey = useCallback((k: string) => {
    const st = useTpvStore.getState();
    const permite = (p: string) => permisosRef.current[p] !== false;
    // Aplica el valor tecleado a una línea según el modo. Devuelve true si aplicó.
    const aplicarModo = (id: string, m: "UND" | "PREC" | "DTO%" | "DTO€"): boolean => {
      const val = Number(st.buffer.replace(",", ".")) || 0;
      if (!val) return false;
      if (m === "DTO%") { if (!permite("descuento")) return false; st.setDescuentos((d) => ({ ...d, [id]: { tipo: "PCT", valor: val } })); }
      else if (m === "DTO€") { if (!permite("descuento")) return false; st.setDescuentos((d) => ({ ...d, [id]: { tipo: "EUR", valor: val } })); }
      else if (m === "PREC") { if (!permite("modificar")) return false; st.setPreciosManuales((mm) => ({ ...mm, [id]: val })); }
      else { if (!permite("modificar")) return false; st.setComanda((c) => ({ ...c, [id]: Math.max(1, Math.round(val)) })); }
      st.setBuffer(""); return true;
    };
    if (k === "CLR") { st.setBuffer(""); st.setLineaSel(null); st.setModo("UND"); st.setEditando(false); return; }
    if (k === "CAN") {
      const sel = st.lineaSel;
      if (!sel || !permite("modificar")) return;
      st.setComanda((c) => { const { [sel]: _, ...r } = c; return r; });
      st.setDescuentos((d) => { const { [sel]: _, ...r } = d; return r; });
      st.setPreciosManuales((m) => { const { [sel]: _, ...r } = m; return r; });
      st.setNotas((n) => { const { [sel]: _, ...r } = n; return r; });
      st.setInvitadas((v) => { const { [sel]: _, ...r } = v; return r; });
      st.setLineaSel(null); st.setBuffer(""); st.setEditando(false); return;
    }
    if (k === "<") { st.setBuffer((b) => b.slice(0, -1)); return; }   // borrar último dígito
    // Teclas de MODO (Und/Precio/DTO): ARMAN el teclado (lo habilitan y pintan el
    // botón en verde). Con una línea seleccionada, editan su valor (recuadro + mensaje).
    // 2ª pulsación del MISMO modo → confirma lo tecleado (si hay línea) y desarma.
    if (k === "UND" || k === "PREC" || k === "DTO%" || k === "DTO€") {
      if (st.editando && st.modo === k) {
        if (st.lineaSel && st.buffer) aplicarModo(st.lineaSel, k);
        st.setEditando(false); st.setModo("UND"); st.setBuffer("");
        return;
      }
      st.setModo(k); st.setEditando(true); st.setBuffer("");
      return;
    }
    // Dígitos y coma
    if (k === "," && st.buffer.includes(",")) return;
    st.setBuffer((b) => b + k);
  }, []);

  /* ── Backend ── */
  // Carga la lista de mesas + el importe de la cuenta abierta de cada una.
  async function recargarMesas() {
    const cols = "id,nombre,estado,room_id,pos_x,pos_y,capacidad,rotacion";
    // Promise.resolve fuerza el arranque del thenable de supabase YA: la query de
    // pedidos abiertos viaja en paralelo con la cadena (con fallback) de mesas.
    const pOrds = Promise.resolve(
      sb.from("sales_order").select("table_id,total,created_at")
        .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
        .not("table_id", "is", null),
    );
    const conColor = await sb.from("restaurant_table").select(`${cols},sprite,color`).order("nombre");
    const conSprite = conColor.error ? await sb.from("restaurant_table").select(`${cols},sprite`).order("nombre") : null;
    const sinSprite = (conColor.error && conSprite?.error) ? await sb.from("restaurant_table").select(cols).order("nombre") : null;
    const mData = (!conColor.error ? conColor.data : (!conSprite?.error ? conSprite?.data : sinSprite?.data)) as Mesa[] | null;
    const { data: ords } = await pOrds;
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

  async function recargarElementos() {
    const cols = "id,room_id,tipo,etiqueta,icono,pos_x,pos_y,ancho,alto,rotacion";
    const conColor = await sb.from("plano_elemento").select(`${cols},color`);
    const sinColor = conColor.error ? await sb.from("plano_elemento").select(cols) : null;
    const eData = (!conColor.error ? conColor.data : sinColor?.data) as Elemento[] | null;
    setElementos(eData ?? []);
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

  function nuevoParaLlevar(nombre: string, telefono: string) {
    if (!nombre.trim()) return;
    setNavSala(false);
    setMesa(null); setBarra(false); setTicket(null); setOrdenAbiertaId(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({});
    setBuffer(""); setLineaSel(null); setVistaProds(false);
    setLlevar({ nombre: nombre.trim(), telefono: telefono.trim() });
  }

  async function abrirLlevar(o: { id: string; cliente_nombre: string; cliente_telefono: string | null }) {
    setNavSala(false);
    setMesa(null); setBarra(false); setTicket(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({}); setAnadidoPor({}); setPases({});
    setBuffer(""); setLineaSel(null); setVistaProds(false);
    setLlevar({ nombre: o.cliente_nombre, telefono: o.cliente_telefono ?? "" });
    setOrdenAbiertaId(o.id);
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas,modificadores,pase").eq("order_id", o.id);
    const cmd: Record<string, number> = {}, pr: Record<string, number> = {}, nt: Record<string, string> = {};
    const pasesCargados: Record<string, number> = {};
    const guardadas = new Set<string>();
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number; notas: string | null; modificadores?: any; pase?: number | null }[]) {
      if (!l.product_id || !prodPorId.has(l.product_id)) continue;
      let baseKey = l.product_id;
      if (l.modificadores && typeof l.modificadores === "object" && l.modificadores.key) {
        baseKey = l.modificadores.key;
      }
      const clave = claveParaAnadir(baseKey, cmd, () => true);
      cmd[clave] = (cmd[clave] ?? 0) + Number(l.cantidad);
      guardadas.add(clave);
      const manualBase = obtenerBaseManualSiDifiere(baseKey, Number(l.precio_unitario));
      if (manualBase !== undefined) {
        pr[clave] = manualBase;
      }
      if (l.notas) nt[clave] = l.notas;
      if (l.pase) pasesCargados[clave] = l.pase;
    }
    setComanda(cmd); setPreciosManuales(pr); setNotas(nt);
    setPases(pasesCargados);
    setLineasGuardadas(guardadas);
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
      modificadores: { key: l.id },
      pase: pases[l.id] || null,
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
    // Inserta las líneas COMPROBANDO el resultado; degrada sin user_id (la col.
    // de la mig. 0059 puede no existir). false = no se pudieron guardar.
    const insertarLineas = async (oid: string): Promise<boolean> => {
      if (!lineas.length) return true;
      const filas = lineas.map((l) => ({ order_id: oid, ...l }));
      const { error } = await sb.from("order_line").insert(filas);
      if (!error) return true;
      const { error: e2 } = await sb.from("order_line").insert(filas.map(({ user_id, ...r }) => r));
      if (e2) { toast.error("No se pudieron guardar las líneas de la cuenta."); return false; }
      return true;
    };
    if (orderId) {
      await sb.from("sales_order").update({ estado, estado_preparacion: estadoPrep, total: totalRedondeado, ...camposCuenta }).eq("id", orderId);
      // Reemplazo ATÓMICO de líneas (RPC 0094): elimina la ventana DELETE→INSERT
      // en la que un fallo dejaba la cuenta sin líneas. Si la migración aún no
      // está aplicada en este entorno, degrada al camino antiguo comprobando.
      const { error: rpcErr } = await sb.rpc("reemplazar_lineas_orden", { p_order_id: orderId, p_lineas: lineas });
      if (rpcErr) {
        await sb.from("order_line").delete().eq("order_id", orderId);
        if (!(await insertarLineas(orderId))) return null;
      }
    } else {
      const { data: order } = await sb.from("sales_order").insert({
        location_id: locationId, table_id: mesa?.id ?? null, user_id: operario?.id ?? userId,
        canal: "TPV", estado, estado_preparacion: estadoPrep,
        total: totalRedondeado, client_id: crypto.randomUUID(), ...camposCuenta,
      }).select("id").single();
      if (!order) return null;
      orderId = (order as { id: string }).id;
      setOrdenAbiertaId(orderId);
      if (!(await insertarLineas(orderId))) return null;
    }
    return orderId;
  }

  // Carga la cuenta de una mesa en el estado (comanda, precios, notas, pedido).
  // Devuelve true si la mesa tenía cuenta abierta. NO cambia de pantalla.
  async function cargarCuentaMesa(m: Mesa): Promise<boolean> {
    setMesa(m); setBarra(false); setLlevar(null); setTicket(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({}); setAnadidoPor({}); setPases({});
    setLineaSel(null); setVistaProds(false); setOrdenAbiertaId(null);

    const { data: ord } = await sb.from("sales_order")
      .select("id").eq("table_id", m.id)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) { setNotaMesa(""); return false; }
    const oid = (ord as { id: string }).id;
    setOrdenAbiertaId(oid);
    // La nota (best-effort, la columna puede no existir) viaja EN PARALELO con las líneas.
    const pNotas = Promise.resolve(sb.from("sales_order").select("notas").eq("id", oid).maybeSingle());

    // Cada order_line = su propia línea de comanda (clave única base#n), preservando el
    // precio exacto (dto por línea), la nota y la atribución. user_id puede no existir (0059).
    const conUser = await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas,user_id,modificadores,pase").eq("order_id", oid);
    const lns = conUser.error
      ? (await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas,modificadores,pase").eq("order_id", oid)).data
      : conUser.data;
    const nq = await pNotas;
    setNotaMesa((nq.data as { notas?: string } | null)?.notas ?? "");
    const comandaCargada: Record<string, number> = {};
    const precios: Record<string, number> = {};
    const notasCargadas: Record<string, string> = {};
    const autores: Record<string, { id: string; nombre: string }> = {};
    const pasesCargados: Record<string, number> = {};
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number; notas: string | null; user_id?: string | null; modificadores?: any; pase?: number | null }[]) {
      if (!l.product_id || !prodPorId.has(l.product_id)) continue;
      let baseKey = l.product_id;
      if (l.modificadores && typeof l.modificadores === "object" && l.modificadores.key) {
        baseKey = l.modificadores.key;
      }
      // clave única por order_line: fuerza #n cuando el producto ya está (una línea por fila).
      const clave = claveParaAnadir(baseKey, comandaCargada, () => true);
      comandaCargada[clave] = Number(l.cantidad);
      const manualBase = obtenerBaseManualSiDifiere(baseKey, Number(l.precio_unitario));
      if (manualBase !== undefined) {
        precios[clave] = manualBase;
      }
      if (l.notas) notasCargadas[clave] = l.notas;
      if (l.user_id) autores[clave] = { id: l.user_id, nombre: operarios.find((o) => o.id === l.user_id)?.nombre ?? "" };
      if (l.pase) pasesCargados[clave] = l.pase;
    }
    const guardadas = new Set(Object.keys(comandaCargada));
    setComanda(comandaCargada);
    setPreciosManuales(precios);
    setNotas(notasCargadas);
    setAnadidoPor(autores);
    setPases(pasesCargados);
    setLineasGuardadas(guardadas);
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
      .map((l) => ({ cantidad: Number(l.cantidad), nombre: prodPorId.get(l.product_id ?? "")?.nombre ?? "Producto", importe: Number(l.cantidad) * Number(l.precio_unitario) }));
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
        .filter((l) => (prodPorId.get(l.product_id ?? "")?.estacion ?? "COCINA") === estacion)
        .map((l) => ({ cantidad: Number(l.cantidad), nombre: prodPorId.get(l.product_id ?? "")?.nombre ?? "Producto", nota: l.notas?.trim() || undefined }));
      if (!lineas.length) continue;
      void imprimirComanda({ contexto: m.nombre, operario: operario?.nombre, nota: notaM, lineas }, estacion, resolverImpresora(cfgImpresion, tipoDoc));
    }
  }

  // Dividir cuenta de una mesa directamente desde el plano:
  // carga la cuenta y abre el modal correspondiente (sin ir al TPV).
  async function dividirMesa(m: Mesa) {
    if (!puede("cobrar") || !(await cargarCuentaMesa(m))) return;
    setModalActivo('DIVIDIR');
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
  // Camino antiguo del traspaso (degradación si la RPC 0095 no está aplicada).
  // Ya corregido: clavea por CLAVE DE LÍNEA, no por product_id.
  async function traspasarLineasLegacy(origenId: string, destino: Mesa, movimientos: { clave: string; uds: number }[], todo: boolean) {
    const dq = await sb.from("sales_order").select("id").eq("table_id", destino.id).in("estado", ESTADOS_ABIERTOS).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let destId = (dq.data as { id: string } | null)?.id;
    if (!destId) {
      const { data } = await sb.from("sales_order").insert({ location_id: locationId, table_id: destino.id, user_id: operario?.id ?? userId, canal: "TPV", estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: 0, client_id: crypto.randomUUID() }).select("id").single();
      destId = (data as { id: string } | null)?.id;
    }
    if (!destId) { toast.error("No se pudo abrir la cuenta de destino."); return false; }
    const { data: srcLns } = await sb.from("order_line").select("id,product_id,nombre,cantidad,precio_unitario,tipo_impositivo,notas,estacion,modificadores,pase").eq("order_id", origenId);
    const udsDe = (clave: string) => movimientos.find((m) => m.clave === clave)?.uds ?? 0;
    for (const l of (srcLns ?? []) as { id: string; product_id: string | null; nombre: string; cantidad: number; precio_unitario: number; tipo_impositivo: string; notas: string | null; estacion: string; modificadores?: any; pase?: number | null }[]) {
      // La clave de comanda viaja en modificadores.key (crearOrden la sella ahí).
      const clave = (l.modificadores && typeof l.modificadores === "object" && l.modificadores.key) ? String(l.modificadores.key) : (l.product_id ?? "");
      const mover = todo ? Number(l.cantidad) : Math.min(Number(l.cantidad), udsDe(clave));
      if (mover <= 0) continue;
      const { error } = await sb.from("order_line").insert({ order_id: destId, product_id: l.product_id, nombre: l.nombre, cantidad: mover, precio_unitario: l.precio_unitario, tipo_impositivo: l.tipo_impositivo, notas: l.notas, estacion: l.estacion, modificadores: l.modificadores, pase: l.pase ?? null });
      if (error) { toast.error("El traspaso falló a medias. Revisa ambas mesas."); return false; }
      if (mover >= Number(l.cantidad)) await sb.from("order_line").delete().eq("id", l.id);
      else await sb.from("order_line").update({ cantidad: Number(l.cantidad) - mover }).eq("id", l.id);
    }
    await recomputarTotal(destId);
    await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", destino.id);
    const { data: resto } = await sb.from("order_line").select("id").eq("order_id", origenId).limit(1);
    if (!resto?.length) {
      await sb.from("sales_order").update({ estado: "ANULADA", total: 0 }).eq("id", origenId);
      if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
    } else {
      await recomputarTotal(origenId);
    }
    return true;
  }

  async function ejecutarTraspaso(destino: Mesa) {
    const origenId = ordenAbiertaId, modo = modoTraspaso;
    if (busy || !origenId || !modo || destino.id === mesa?.id) { cancelarTraspaso(); return; }
    setBusy(true);
    try {
      // Movimientos por CLAVE DE LÍNEA (traspLineas se rellena con la clave de la
      // comanda). Antes se buscaba por product_id → con formato/extras movía 0 uds
      // en silencio, o aplicaba las uds de una línea a otra del mismo producto.
      const todo = modo === "MESA";
      const movimientos = todo ? [] : Object.entries(traspLineas)
        .filter(([, uds]) => uds > 0)
        .map(([clave, uds]) => ({ clave, uds }));
      if (!todo && movimientos.length === 0) { toast.warning("No has elegido unidades que traspasar."); cancelarTraspaso(); return; }

      // Traspaso ATÓMICO (RPC 0095): un fallo a medias ya no duplica ni pierde líneas.
      const { error: rpcErr } = await sb.rpc("traspasar_lineas", {
        p_origen: origenId,
        p_destino_mesa: destino.id,
        p_location: locationId,
        p_user: operario?.id ?? userId,
        p_movimientos: movimientos,   // [] = mesa entera
      });
      if (rpcErr && !(await traspasarLineasLegacy(origenId, destino, movimientos, todo))) return;

      setModoTraspaso(null); setTraspLineas({});
      await recargarMesas();
      reset();
      toast.success(`Traspasado a ${destino.nombre}`);
    } finally { setBusy(false); }
  }
  async function cobrarMesa(m: Mesa) {
    if (!puede("cobrar") || !(await cargarCuentaMesa(m))) return;
    setModalActivo('COBRAR');
  }

  async function enviarCocina(estadoPrep: string) {
    if (busy) return;
    if (!unidades) { toast.warning("No hay nada que enviar"); return; }
    setBusy(true);
    try {
      const orderId = await crearOrden("ENVIADA_COCINA", estadoPrep);
      if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      const marchar = estadoPrep === "EN_PREPARACION";
      if (marchar) imprimirComandas();   // solo imprime en Gluuh Desktop; el pedido va al KDS igualmente
      await recargarMesas();
      
      if (mesa) {
        await cargarCuentaMesa(mesa);
      } else if (llevar && orderId) {
        await abrirLlevar({ id: orderId, cliente_nombre: llevar.nombre, cliente_telefono: llevar.telefono || null });
      } else {
        reset();
      }
      
      // Feedback: aunque no haya impresora, el pedido ya está en la pantalla de cocina (KDS).
      if (!marchar) toast.success("Enviado a cocina");
      else if (typeof window !== "undefined" && window.gluuh) toast.success("Marchado a cocina/barra");
      else toast.success("Sin impresora: enviado a la pantalla de cocina");
    } finally { setBusy(false); }
  }

  // Guarda la cuenta abierta y limpia la pantalla. Mesa/llevar se auto-marchan;
  // un Ticket directo con líneas se aparca como cuenta de barra para no perderlo.
  async function guardarActual() {
    if (busy) return;
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

  function irASala(destino: { tipo: "ticket" | "barra" | "room" | "llevar"; id?: string }) {
    setMesaSel(null); setMesaSelInfo(null);
    if (destino.tipo === "ticket") {
      if (!mesa && !llevar) setBarra(true);   // Ticket vacío = venta directa
      setNavSala(false);
      return;
    }
    // Cambia de vista AL INSTANTE (sin esperar); la cuenta en curso se aparca en 2º plano.
    setNavSala(true);
    if (destino.tipo === "barra") setVistaSala("BARRA");
    else if (destino.tipo === "llevar") setVistaSala("LLEVAR");
    else if (destino.id) setVistaSala(destino.id);
    void guardarActual();
  }

  // Cobro real: /api/ticket (desglose) → crearOrden COBRADA → payment por línea →
  // (VERIFACTU si activo) → ticket imprimible. `filas` = pagos ya resueltos
  // (metodo del esquema + importe + propina). NO recalcula fiscalidad.
  async function cobrar(
    filas: { metodo: string; importe: number; propina: number }[],
    opts: { abrirCajon?: boolean; imprimir?: boolean } = {},
  ) {
    if (busy || cobrandoRef.current || !unidades) return;
    cobrandoRef.current = true;
    setBusy(true);
    try {
      // Cálculo fiscal ANTES de tocar nada en BD: si falla o no responde en 15 s,
      // el cobro aborta entero (nada de venta COBRADA sin ticket ni TPV colgado).
      let t: Ticket;
      try {
        // Bearer de la sesión: /api/ticket ya NO es anónimo (era un endpoint de
        // cómputo —QR/huella— abierto a cualquiera). Mismo patrón que /api/factura.
        const tok = (await sb.auth.getSession()).data.session?.access_token;
        const res = await fetch("/api/ticket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            territorio: TERR[territorio] ?? "PENINSULA_BALEARES",
            lineas: lineasComanda().map((l) => ({ precio: l.precio, tipo: l.tipo, cantidad: l.cantidad })),
          }),
        });
        if (!res.ok) { toast.error("No se pudo calcular el ticket. No se ha cobrado nada."); return; }
        t = (await res.json()) as Ticket;
      } catch {
        toast.error("Sin conexión con el servidor. No se ha cobrado nada.");
        return;
      }
      if (!t?.impuestos?.desglose) { toast.error("Respuesta fiscal inválida. No se ha cobrado nada."); return; }
      const orderId = await crearOrden("COBRADA", "ENTREGADO");
      if (!orderId) { toast.error("No se pudo guardar la cuenta. No se ha cobrado nada."); return; }
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
        if (payErr) {
          // El pedido ya quedó COBRADA (crearOrden): lo devolvemos a POR_COBRAR
          // para que el descuadre sea visible y recuperable, no silencioso.
          await sb.from("sales_order").update({ estado: "POR_COBRAR" }).eq("id", orderId);
          if (mesa) await sb.from("restaurant_table").update({ estado: "POR_COBRAR" }).eq("id", mesa.id);
          toast.error("El pago NO quedó registrado. La cuenta sigue pendiente de cobro.");
          await recargarMesas();
          return;   // sin cajón, sin liberar mesa, sin ticket
        }
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
    } finally { cobrandoRef.current = false; setBusy(false); }
  }

  // Cobro desde CobrarModal: mapea las líneas de pago (payment_method) al esquema
  // de `payment`, reparte propina/descuento y decide el cajón por abre_cajon.
  function cobrarDesdeModal(pagos: LineaPago[], opts: CobrarOpciones) {
    setModalActivo(null);
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
    setModalActivo(null);
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
        const out: { product_id: string | null; nombre: string; cantidad: number; precio_unitario: number; tipo_impositivo: number; notas: string | null; estacion: string; modificadores: any }[] = [];
        for (const a of asign) {
          const m = meta[a.id]; if (!m) continue;
          out.push({ product_id: m.productId, nombre: m.nombre, cantidad: a.uds, precio_unitario: invitadas[a.id] ? 0 : m.precio, tipo_impositivo: m.tipo, notas: notas[a.id]?.trim() || null, estacion: m.estacion, modificadores: { key: a.id } });
        }
        return out;
      };

      // División ATÓMICA (RPC 0095): antes los inserts de los documentos 2.. no se
      // comprobaban → si uno fallaba, ESA parte de la cuenta desaparecía en silencio.
      const etiquetaBase = mesa?.nombre ?? llevar?.nombre ?? "Ticket";
      const docsRpc = clean.map((d) => ({ total: totalDe(d.lineas), lineas: filasDe(d.lineas) }));
      const { error: rpcErr } = await sb.rpc("dividir_cuenta", {
        p_origen: ordenAbiertaId,
        p_location: locationId,
        p_mesa: mesa?.id ?? null,
        p_user: operario?.id ?? userId,
        p_etiqueta_base: etiquetaBase,
        p_campos: camposCuenta,
        p_docs: docsRpc,
      });

      if (rpcErr) {
        // Degradación (0095 sin aplicar): camino antiguo, ahora COMPROBANDO cada insert.
        const doc0 = clean[0]!;
        let baseId = ordenAbiertaId;
        if (baseId) {
          await sb.from("sales_order").update({ estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: totalDe(doc0.lineas), ...camposCuenta }).eq("id", baseId);
          await sb.from("order_line").delete().eq("order_id", baseId);
        } else {
          const { data } = await sb.from("sales_order").insert({ location_id: locationId, table_id: mesa?.id ?? null, user_id: operario?.id ?? userId, canal: "TPV", estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: totalDe(doc0.lineas), client_id: crypto.randomUUID(), ...camposCuenta }).select("id").single();
          baseId = (data as { id: string } | null)?.id ?? null;
        }
        if (!baseId) { toast.error("No se pudo dividir la cuenta. Nada se ha modificado."); return; }
        const f0 = filasDe(doc0.lineas);
        if (f0.length) {
          const { error } = await sb.from("order_line").insert(f0.map((l) => ({ order_id: baseId, ...l })));
          if (error) { toast.error("La división falló al guardar el primer documento."); return; }
        }
        for (let i = 1; i < clean.length; i++) {
          const { data, error } = await sb.from("sales_order").insert({ location_id: locationId, table_id: null, user_id: operario?.id ?? userId, canal: "TPV", estado: "ENVIADA_COCINA", estado_preparacion: "EN_PREPARACION", total: totalDe(clean[i]!.lineas), client_id: crypto.randomUUID(), aparcado_como: `${etiquetaBase} (${i + 1})`, ...camposCuenta }).select("id").single();
          const nid = (data as { id: string } | null)?.id;
          if (error || !nid) { toast.error(`No se pudo crear el documento ${i + 1}. Revisa la cuenta.`); return; }
          const fl = filasDe(clean[i]!.lineas);
          if (fl.length) {
            const { error: e2 } = await sb.from("order_line").insert(fl.map((l) => ({ order_id: nid, ...l })));
            if (e2) { toast.error(`El documento ${i + 1} quedó sin líneas. Revísalo.`); return; }
          }
        }
        if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      }

      await Promise.all([recargarMesas(), recargarLlevar(), recargarAparcados()]);
      reset();
      toast.success(`Cuenta dividida en ${clean.length} documentos`);
    } finally { setBusy(false); }
  }

  /* ── Funciones de cuenta (columna estilo Glop) ── */

  // Carga las líneas de un pedido existente en la comanda de pantalla.
  async function cargarLineas(orderId: string) {
    const { data: lns } = await sb.from("order_line").select("product_id,cantidad,precio_unitario,notas,modificadores,pase").eq("order_id", orderId);
    const cmd: Record<string, number> = {}, pr: Record<string, number> = {}, nt: Record<string, string> = {};
    const pasesCargados: Record<string, number> = {};
    const guardadas = new Set<string>();
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number; notas: string | null; modificadores?: any; pase?: number | null }[]) {
      if (!l.product_id || !prodPorId.has(l.product_id)) continue;
      let baseKey = l.product_id;
      if (l.modificadores && typeof l.modificadores === "object" && l.modificadores.key) {
        baseKey = l.modificadores.key;
      }
      const clave = claveParaAnadir(baseKey, cmd, () => true);
      cmd[clave] = (cmd[clave] ?? 0) + Number(l.cantidad);
      guardadas.add(clave);
      const manualBase = obtenerBaseManualSiDifiere(baseKey, Number(l.precio_unitario));
      if (manualBase !== undefined) {
        pr[clave] = manualBase;
      }
      if (l.notas) nt[clave] = l.notas;
      if (l.pase) pasesCargados[clave] = l.pase;
    }
    setComanda(cmd); setPreciosManuales(pr); setNotas(nt);
    setPases(pasesCargados);
    setLineasGuardadas(guardadas);
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
        nombre: prodPorId.get(l.product_id ?? "")?.nombre ?? "Producto",
        cantidad: Number(l.cantidad), total: Number(l.cantidad) * Number(l.precio_unitario),
      });
    }
    setAparcadosLineas(map);
  }

  // Aparcar: guarda la cuenta con una etiqueta y dispara la comanda (como Glop).
  async function aparcar() {
    if (busy) return;
    if (!exige("aparcar")) return;
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
    if (busy) return;
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
    setModalActivo(null);
    reset();
    setNavSala(false); setBarra(true);   // vuelve a la pantalla Ticket con la cuenta cargada
    await sb.from("sales_order").update({ aparcado_como: null }).eq("id", o.id);
    setOrdenAbiertaId(o.id);
    await cargarLineas(o.id);
    await recargarAparcados();
  }

  async function pasarAMesa(destino: Mesa) {
    setModalActivo(null);
    if (!unidades && !ordenAbiertaId) return;
    setBusy(true);
    try {
      const orderId = await crearOrden("ENVIADA_COCINA", "EN_PREPARACION");
      if (orderId) {
        await sb.from("sales_order").update({ table_id: destino.id, aparcado_como: null }).eq("id", orderId);
        await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", destino.id);
      }
      if (mesa && mesa.id !== destino.id) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      
      setMesa(destino);
      setBarra(false);
      setTicket(null);
      await Promise.all([recargarMesas(), recargarAparcados()]);
      toast.success(`Cuenta pasada a la mesa ${destino.nombre.replace("Mesa ", "")}`);
    } finally { setBusy(false); }
  }

  // Buscar cliente por nombre o teléfono (saneado para el filtro .or de PostgREST).
  async function buscarClientes(q: string) {
    setBusqCliente(q);
    const limpio = q.replace(/[,()%]/g, "").trim();
    if (limpio.length < 2) { setClientesEnc([]); return; }
    const { data } = await sb.from("customer").select("id,nombre,telefono,nif")
      .or(`nombre.ilike.%${limpio}%,telefono.ilike.%${limpio}%,nif.ilike.%${limpio}%`).limit(8);
    setClientesEnc((data as { id: string; nombre: string; telefono: string | null; nif: string | null }[]) ?? []);
  }
  function asignarCliente(c: { id: string; nombre: string; nif?: string | null }) {
    setCliente({ id: c.id, nombre: c.nombre, nif: c.nif ?? null });
    setModalActivo(null); setBusqCliente(""); setClientesEnc([]);
  }
  async function crearClienteRapido() {
    if (!nuevoCli.nombre.trim()) return;
    // Con NIF, /api/factura emite factura COMPLETA (F1) en vez de simplificada (F2).
    const { data } = await sb.from("customer")
      .insert({
        nombre: nuevoCli.nombre.trim(),
        telefono: nuevoCli.telefono.trim() || null,
        nif: nuevoCli.nif.trim().toUpperCase() || null,
      })
      .select("id,nombre,nif").single();
    if (data) asignarCliente(data as { id: string; nombre: string; nif: string | null });
    setNuevoCli({ nombre: "", telefono: "", nif: "" });
  }

  function reprimirUltimo() {
    setModalActivo(null);
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
  function bloquear() { setModalActivo(null); setBloqueado(true); }

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
  function onPressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
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
    const key = addProd(claveDeLinea(p.id, fid, []));
    setModProd({ p, fid, reemplazar: key });
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

    const viejo = modProd.reemplazar;
    if (viejo) {
      const clave = claveDeLinea(modProd.p.id, modProd.fid, modIds);
      // "unidades" del modal fija la cantidad; si no se tocó, conserva la de la línea previa.
      const qty = sel.unidades && sel.unidades >= 1 ? sel.unidades : (comanda[viejo] ?? 1);
      const desc = descuentos[viejo];
      const pm = preciosManuales[viejo];
      const inv = !!invitadas[viejo];
      const autor = anadidoPor[viejo];

      setComanda((c) => {
        const next = { ...c };
        if (viejo !== clave) {
          delete next[viejo];
          next[clave] = qty;
        } else {
          next[clave] = qty;
        }
        return next;
      });

      if (viejo !== clave) {
        setDescuentos((d) => { const { [viejo]: _, ...r } = d; return desc ? { ...r, [clave]: desc } : r; });
        setPreciosManuales((m) => { const { [viejo]: _, ...r } = m; return pm !== undefined ? { ...r, [clave]: pm } : r; });
        setInvitadas((v) => { const { [viejo]: _, ...r } = v; return inv ? { ...r, [clave]: true } : r; });
        setNotas((n) => { const { [viejo]: _, ...r } = n; return { ...r, [clave]: texto }; });
        setAnadidoPor((a) => { const { [viejo]: _, ...r } = a; return autor ? { ...r, [clave]: autor } : r; });
        setLineaSel(clave);
        setModProd({ p: modProd.p, fid: modProd.fid, reemplazar: clave });
      } else {
        setNotas((n) => ({ ...n, [clave]: texto }));
      }
    }
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
    if (!exige("agotado")) return;
    let hasta: string | null = null;
    if (agotar) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); hasta = d.toISOString(); }
    const { error } = await sb.from("product").update({ agotado_hasta: hasta }).eq("id", p.id);
    setAgotarPop(null);
    if (error) { toast.error("No se pudo cambiar el agotado."); return; }
    // Parche en el store (instantáneo, sin refetch): antes recargaba TODOS los
    // productos y además el realtime disparaba una recarga completa del catálogo.
    setProds(prods.map((x) => (x.id === p.id ? { ...x, agotado_hasta: hasta } : x)));
  }

  // Alta rápida de producto desde el TPV: nombre + precio + clase fiscal; la
  // categoría es la abierta y el IVA se calcula por clase × territorio (ivaAuto).
  async function onFotoRapida(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tenantId) return;
    try { const url = await subirMedia(sb, tenantId, file, "productos"); setNuevoProd((s) => ({ ...s, foto_url: url })); }
    catch (err) { console.error(err); }
  }
  async function crearProductoRapido(anadir: boolean) {
    if (!exige("crear_producto")) return;
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
      setModalActivo(null);
      setNuevoProd({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: "", foto_url: "" });
    } finally { setBusy(false); }
  }

  function reset() {
    setComanda({}); setDescuentos({}); setPreciosManuales({}); setNotas({}); setInvitadas({}); setAnadidoPor({});
    setLineasGuardadas(new Set());
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
  // La búsqueda va DIFERIDA (useDeferredValue): el input responde tecla a tecla
  // y el grid (con fotos) se refiltra sin bloquear la pulsación.
  const busqDiferida = useDeferredValue(busqProd);
  const productosVista = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = norm(busqDiferida.trim());
    if (!q) return productosCat;
    return prods.filter((p) => norm(p.nombre).includes(q));
  }, [busqDiferida, productosCat, prods]);
  const buscando = busqProd.trim().length > 0;                 // input/cabecera: inmediato
  const buscandoDiferido = busqDiferida.trim().length > 0;     // grid: acompasado al filtro
  const catActual    = cats.find((c) => c.id === catSelEf);
  const colorActual  = catActual ? (colorCat[catActual.id] ?? "") : "";
  // Solo categorías marcadas "mostrar en venta" (Fase 1 Glop) y disponibles a
  // esta hora según su horario (0067; sin franjas = siempre). tickHorario fuerza
  // la re-evaluación cada minuto.
  const catsVisibles = useMemo(
    () => cats.filter((c) => c.mostrar_venta !== false && categoriaDisponible(horariosCat[c.id], new Date())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cats, horariosCat, tickHorario],
  );
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
  }, [comanda, prodPorId]);

  // Handlers ESTABLES por id para los tiles. Sin esto, el React.memo de TileProducto
  // no serviría de nada: cada render crearía closures nuevos y se re-renderizarían
  // los 40 tiles (esa era la causa del parpadeo del grid al recargar el catálogo).
  const onTileClick = useEventCallback((id: string) => { const p = prodPorId.get(id); if (p) onProdClick(p); });
  const onTilePressStart = useEventCallback((id: string) => { const p = prodPorId.get(id); if (p) onProdPressStart(p); });
  const onTilePressEnd = useEventCallback(() => { onPressEnd(); });

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
            id={p.id}
            nombre={p.texto_boton || p.nombre}
            precio={p.precio}
            agotado={agotado}
            foto={foto ?? undefined}
            color={(p.category_id ? colorCat[p.category_id] : undefined) ?? colorActual}
            mostrarPrecio={mostrarPrecio}
            txtClase={txtClase}
            eur={eur}
            onClick={onTileClick}
            onPressStart={onTilePressStart}
            onPressEnd={onTilePressEnd}
          />
        );
      })}
      {/* Alta rápida: crear un producto sin salir del TPV (oculta al buscar) */}
      {!buscandoDiferido && (
        <button type="button"
          onClick={() => { setNuevoProd({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: catSelEf ?? "", foto_url: "" }); setModalActivo('NUEVO_PROD'); }}
          className="flex min-h-[78px] flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border text-[9px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Plus size={14} strokeWidth={1.5} />
          <span className="text-xs font-medium">Nuevo</span>
        </button>
      )}
      {productosVista.length === 0 && (
        <p className="col-span-full text-muted-foreground text-sm">
          {buscandoDiferido ? `Sin resultados para «${busqDiferida.trim()}».` : "Sin productos. Pulsa «Nuevo» para crear el primero."}
        </p>
      )}
    </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productosVista, buscandoDiferido, busqDiferida, colorCat, colorActual, catSelEf, botonesCfg]);

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
            id={c.id}
            nombre={c.texto_boton || c.nombre}
            color={color}
            seleccionada={sel}
            Icono={IconoCat}
            foto={catFoto ?? undefined}
            onClick={setCatSel}
          />
        );
      })}
      {catsVisibles.length === 0 && (
        <p className="col-span-full text-muted-foreground text-sm">Sin categorías. Añade carta en el panel.</p>
      )}
    </div>
     
  ), [catsVisibles, catSelEf, colorCat, iconosCat]);

  /* ── Identidades ESTABLES para los hijos memoizados (plan 011): los wrappers
     useEventCallback invocan siempre la última versión del handler, así
     ColumnaFunciones/RailSalas/TecladoTPV (memo) no re-renderizan por identidad. ── */
  const abrirCobrar = useCallback(() => setModalActivo('COBRAR'), []);
  const abrirUtilidades = useCallback(() => setModalActivo('UTILIDADES'), []);
  const onAparcadosModal = useCallback(() => setModalActivo('APARCADOS'), []);
  const onPasarMesaModal = useCallback(() => setModalActivo('PASAR_MESA'), []);
  const onClienteModal = useCallback(() => setModalActivo('CLIENTE'), []);
  const onDividirModal = useCallback(() => setModalActivo('DIVIDIR'), []);
  const onAparcarEstable = useEventCallback(aparcar);
  const onLlevarBarraEstable = useEventCallback(() => { void llevarABarra(); });
  const onPrepararEstable = useEventCallback(() => enviarCocina("PENDIENTE"));
  const onMarcharEstable = useEventCallback(() => enviarCocina("EN_PREPARACION"));
  const onUltimoDocEstable = useEventCallback(reprimirUltimo);
  const onImprimirEstable = useEventCallback(imprimirRecibo);
  const onAbrirCajonEstable = useEventCallback(abrirCajonManual);
  const onConsumoPropioEstable = useEventCallback(() => { if (puede("invitar")) setTipoOperacion((t) => (t === "AUTOCONSUMO" ? "VENTA" : "AUTOCONSUMO")); });
  const onBorrarCuentaEstable = useEventCallback(() => { if (puede("borrar")) setPedirBorrar(true); });
  const onBloquearEstable = useEventCallback(bloquear);
  const irASalaEstable = useEventCallback(irASala);
  const onReservasEstable = useEventCallback(async () => { await guardarActual(); setNavSala(true); setVistaSala("RESERVAS"); });

  // Props del rail vertical de acciones de CUENTA (orden configurable), memoizadas:
  // ColumnaFunciones (memo) solo re-renderiza cuando cambia su dato visible.
  const accionesRapidasProps = useMemo(() => ({
    hayLineas: unidades > 0,
    hayCuenta: unidades > 0 || !!ordenAbiertaId,
    tipoOperacion,
    nAparcados: aparcados.length,
    hayUltimoDoc: !!ultimoDoc,
    orden: ordenFunciones,
    favoritos: ["aparcar", "marchar"] as const,
    onAparcar: onAparcarEstable,
    onAparcados: onAparcadosModal,
    onLlevarBarra: onLlevarBarraEstable,
    onPasarMesa: onPasarMesaModal,
    onConsumoPropio: onConsumoPropioEstable,
    onDividir: onDividirModal,
    onBorrarCuenta: onBorrarCuentaEstable,
    onUltimoDoc: onUltimoDocEstable,
    onCliente: onClienteModal,
    // ponytail: pendiente de definir → abre Utilidades como casa temporal.
    onCamarero: abrirUtilidades,
    onPreparar: onPrepararEstable,
    onMarchar: onMarcharEstable,
    // Utilidades ancladas al fondo del rail (movidas desde el teclado).
    onAbrirCajon: onAbrirCajonEstable,
    onUtilidades: abrirUtilidades,
    onImprimir: onImprimirEstable,
    imprimirDisabled: !ticket && !unidades,
    onBloquear: onBloquearEstable,
    // Los *Estable son de identidad fija: no necesitan estar en deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [unidades, ordenAbiertaId, tipoOperacion, aparcados.length, ultimoDoc, ordenFunciones, ticket]);

  // Tabs del rail de salas, memoizadas: RailSalas (memo) no re-renderiza al
  // teclear ni al tocar líneas; los badges siguen vivos por las deps.
  const railTabs = useMemo<RailTab[]>(() => {
    // Icono por sala: por nombre (las salas son configurables) con reserva genérica.
    const iconoSala = (nombre: string): LucideIcon => {
      const n = nombre.toLowerCase();
      if (n.includes("terraza")) return Sun;
      if (n.includes("barra")) return Store;
      if (n.includes("llevar")) return ShoppingBag;
      return Armchair;   // salón y demás salas
    };
    return [
      { id: "TICKET", label: "Ticket", icon: Receipt, onClick: () => irASalaEstable({ tipo: "ticket" }) },
      { id: "BARRA", label: "Aparcado", icon: Store, badge: aparcados.length || undefined, onClick: () => irASalaEstable({ tipo: "barra" }) },
      ...rooms.map((rm) => ({
        id: rm.id, label: rm.nombre, icon: iconoSala(rm.nombre),
        badge: mesas.filter((m) => m.room_id === rm.id && (totalesMesa[m.id] ?? 0) > 0).length || undefined,
        onClick: () => irASalaEstable({ tipo: "room", id: rm.id }),
      })),
      { id: "LLEVAR", label: "Para llevar", icon: ShoppingBag, badge: llevarList.length || undefined, onClick: () => irASalaEstable({ tipo: "llevar" }) },
      { id: "RESERVAS", label: "Reservas", icon: CalendarCheck, badge: reservas.length || undefined, onClick: () => { void onReservasEstable(); } },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, mesas, totalesMesa, aparcados.length, llevarList.length, reservas.length]);

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
                <span className="mt-1 w-full px-2 text-center text-sm font-semibold truncate block" title={o.nombre}>{o.nombre}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">#{o.codigo}</span>
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
          <p className="mb-4 text-center text-3xl font-bold">TPV bloqueado</p>
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

  // (El rail lateral fijo se construye arriba como `railTabs` memoizadas — plan 011.)



  /* ── Navegación de salas (estilo Glop): plano / barra / llevar / reservas ── */
  if (navSala) {
    return (
      <PlanoSalas
        sb={sb}
        operario={operario!}
        mesas={mesas}
        setMesas={setMesas}
        rooms={rooms}
        elementos={elementos}
        setElementos={setElementos}
        reservas={reservas}
        totalesMesa={totalesMesa}
        aparcados={aparcados}
        aparcadosLineas={aparcadosLineas}
        llevarList={llevarList}
        recuperarAparcado={recuperarAparcado}
        nuevoParaLlevar={nuevoParaLlevar}
        abrirLlevar={abrirLlevar}
        irASala={irASala}
        vistaSala={vistaSala}
        recargarMesas={recargarMesas}
        recargarElementos={recargarElementos}
        recargarReservas={recargarReservas}
        abrirMesa={abrirMesa}
        cobrarMesa={cobrarMesa}
        dividirMesa={dividirMesa}
        iniciarTraspaso={iniciarTraspaso}
        cancelarTraspaso={cancelarTraspaso}
        ejecutarTraspaso={ejecutarTraspaso}
        reimprimirCocinaMesa={reimprimirCocinaMesa}
        imprimirCuentaMesa={imprimirCuentaMesa}
        marca={marca}
        ultimoDoc={ultimoDoc}
        reprimirUltimo={reprimirUltimo}
        abrirCajonManual={abrirCajonManual}
        modoTraspaso={modoTraspaso}
        comanda={comanda}
        nombreLinea={nombreDeKey}
        traspLineas={traspLineas}
        setTraspLineas={setTraspLineas}
        prods={prods}
        busy={busy}
        setModalUtilidades={(v) => setModalActivo(v ? 'UTILIDADES' : null)}
        reservasPorMesa={reservasPorMesa}
        locationId={locationId}
        renderVelo={renderVelo}
        puede={puede}
      />
    );
  }

  /* ── Pantalla venta (layout Ágora) ── */
  // Categoría efectiva: la elegida o la primera (así siempre se ven productos debajo).


  // (Las props del rail de acciones se construyen arriba como `accionesRapidasProps`
  // memoizadas — plan 011.)
  const hayInvitadas = Object.values(invitadas).some(Boolean);
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
      <div className={`flex min-h-0 flex-1 ${modoZurdo ? "flex-row-reverse" : ""}`}>

        {/* ─── Columna izquierda: [ticket + teclado] · rail (a altura completa) ─── */}
        <div className={`flex w-[532px] flex-none ${modoZurdo ? "border-l" : "border-r"} border-border bg-card`}>

          {/* Columna de contenido: ticket (crece) + teclado apilados. El border-r la separa
              del rail a lo alto (ticket + teclado), de arriba abajo. */}
          <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${modoZurdo ? "border-l" : "border-r"} border-border`}>
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
              const marchado = lineasGuardadas.has(id);
              return (
                <div
                  key={id}
                  onClick={() => onLineaTap(id)}
                  className={`flex w-full flex-col rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                    sel ? "bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_#0e8fa2]" : "hover:bg-accent"
                  } ${marchado ? "opacity-80" : ""}`}
                >
                  <div className="flex w-full items-start gap-1">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1">
                        <span className={`truncate ${marchado ? "text-muted-foreground/90 font-medium" : "font-bold text-foreground"}`}>
                          {nombreBaseDeKey(id)}
                        </span>
                        {marchado && (
                          <span className="inline-flex flex-none items-center rounded bg-emerald-500/10 px-1 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
                            MARCHADO
                          </span>
                        )}
                        {pases[id] && (
                          <span className="inline-flex flex-none items-center rounded bg-yellow-500/15 px-1 text-[9px] font-bold text-yellow-600 dark:text-yellow-400">
                            {pases[id] === 4 ? "POSTRE" : pases[id] === 5 ? "BEBIDA" : `${pases[id]}º`}
                          </span>
                        )}
                        {multiCamarero && autor && <span title={autor.nombre} className={`flex-none rounded px-1 text-[9px] font-semibold bg-muted text-muted-foreground`}>{iniciales(autor.nombre)}</span>}
                        {inv && <span className="inline-flex flex-none items-center gap-0.5 rounded bg-emerald-500/15 px-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400"><IconGift size={11} /> INVITADO</span>}
                        {(desc || pm) && (
                          <span className={`flex-none rounded px-1 text-[10px] font-medium tabular-nums bg-muted text-muted-foreground`}>
                            {pm ? `P:${eur(pm)}` : ""}
                            {desc ? (desc.tipo === "PCT" ? ` -${desc.valor}%` : ` -${eur(desc.valor)}`) : ""}
                          </span>
                        )}
                      </span>
                      {extraIngredientesDetallados(id).map((ext, idx) => (
                        <span key={idx} className="mt-0.5 block pl-3 text-[10px] text-muted-foreground/75 font-medium leading-tight">
                          ↳ {ext.nombre} {ext.uds > 1 ? `x${ext.uds}` : ""} {ext.precio > 0 ? `(+${eur(ext.precio * ext.uds)})` : ""}
                        </span>
                      ))}
                      {notas[id] && (
                        <span className="mt-0.5 block truncate text-[10px] text-amber-600 dark:text-amber-400">✎ {notas[id]}</span>
                      )}
                    </span>
                    <span className="w-[2.4rem] text-right font-medium tabular-nums pt-0.5">
                      {sel ? <BufferEnLinea tipo="UND" fallback={q} /> : q}
                    </span>
                    <span className="w-[4.2rem] text-right tabular-nums pt-0.5">
                      {sel ? <BufferEnLinea tipo="PRECIO" fallback={eur(pe)} /> : eur(pe)}
                    </span>
                    <span className={`w-[4.8rem] text-right font-semibold tabular-nums pt-0.5 ${inv ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{inv ? "Inv." : eur(pe * q)}</span>
                  </div>

                  {sel && (
                    <div className="mt-2 flex items-center gap-1 border-t border-border/40 pt-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] text-muted-foreground mr-1">Pase:</span>
                      {[
                        { val: 1, label: "1º" },
                        { val: 2, label: "2º" },
                        { val: 3, label: "3º" },
                        { val: 4, label: "Postre" },
                        { val: 5, label: "Bebida" },
                      ].map((pOpt) => {
                        const isCurrent = (pases[id] || 0) === pOpt.val;
                        return (
                          <button
                            key={pOpt.val}
                            type="button"
                            onClick={() => setPases((prev) => ({ ...prev, [id]: pOpt.val }))}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold border transition-all ${
                              isCurrent
                                ? "bg-brand text-brand-foreground border-brand"
                                : "bg-background text-muted-foreground border-border hover:bg-accent"
                            }`}
                          >
                            {pOpt.label}
                          </button>
                        );
                      })}
                      {(pases[id] || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setPases((prev) => { const { [id]: _, ...r } = prev; return r; })}
                          className="rounded px-1.5 py-0.5 text-[9px] font-bold border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* (Editor de línea retirado: la cantidad se cambia con el teclado (Und.),
              eliminar = "Anular línea" y la nota = "Com. y extra" en la fila de acciones.) */}

          {/* Banda de totales (UDS · PRECIO/DTO · ARTÍCULOS · TOTAL) + hint "toca la línea". */}
          <BarraTotales
            hayLinea={!!lineaSel}
            udsLinea={lineaSel ? (comanda[lineaSel] ?? 0) : 0}
            precioLinea={lineaSel ? precioEfectivo(lineaSel) : 0}
            unidades={unidades}
            total={total}
            eur={eur}
            nombreLineaSel={lineaSel ? nombreDeKey(lineaSel) : null}
          />
          {/* Fila de acciones de LÍNEA/extra (bajo los totales): Anular · Comp. menú · Com. y extra · Invitar. */}
          <FilaAccionesLinea
            haySeleccion={!!lineaSel}
            hayInvitadas={hayInvitadas}
            hayUnidades={!!unidades}
            onAnular={anularLineaSel}
            onCompMenu={abrirCompMenu}
            onComExtra={comExtraSel}
            onInvitar={() => { if (puede("invitar")) setModalActivo('INVITAR'); }}
          />
          </div>{/* fin parte superior */}

          {/* Teclado numérico bajo el ticket, dentro de la columna de contenido.
              El buffer (lo que se teclea) ya se ve en la barra de totales, en verde. */}
          <TecladoTPV
            onKey={handleKey}
            onModo={handleKey}
            onCobrar={abrirCobrar}
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
        <RailSalas tabs={railTabs} activo="TICKET" busy={busy} onConfig={abrirUtilidades} />
      </div>

      {/* ── Barra de estado inferior (estilo Glop) ── */}
      <BarraEstado
        operario={operario?.nombre}
        terminal={terminal}
        contexto={mesa ? mesa.nombre : llevar ? `Para llevar · ${llevar.nombre}` : "Ticket"}
        cajaAbierta={cajaAbierta}
        modoZurdo={modoZurdo}
        onModoZurdoChange={setModoZurdo}
      />

      {/* ── Modal: Cliente y comensales ── */}
      {modalActivo === 'CLIENTE' && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalActivo(null)}>
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
              placeholder="Buscar por nombre, teléfono o NIF…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            {clientesEnc.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {clientesEnc.map((c) => (
                  <button type="button" key={c.id} onClick={() => asignarCliente(c)} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-accent">
                    <span className="flex items-center gap-2">
                      {c.nombre}
                      {/* Con NIF se le puede emitir factura completa: se marca para que el camarero lo vea. */}
                      {c.nif && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">{c.nif}</span>}
                    </span>
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
              <input
                aria-label="NIF del cliente"
                value={nuevoCli.nif}
                onChange={(e) => setNuevoCli((c) => ({ ...c, nif: e.target.value }))}
                placeholder="NIF / CIF — necesario para factura completa"
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase outline-none focus:border-brand"
              />
            </div>
            <button type="button" onClick={() => setModalActivo(null)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Pasar a mesa ── */}
      {modalActivo === 'PASAR_MESA' && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalActivo(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Pasar la cuenta a…</h3>
            <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
              {mesas.filter((m) => !mesa || m.id !== mesa.id).map((m) => (
                <button type="button" key={m.id} onClick={() => pasarAMesa(m)} disabled={busy}
                  className={`flex h-16 flex-col items-center justify-center rounded-md border text-sm disabled:opacity-50 ${
                    m.estado === "POR_COBRAR"
                      ? "border-yellow-500 bg-yellow-500/10"
                      : m.estado === "OCUPADA"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-border hover:bg-accent"
                  }`}>
                  <span className="font-semibold">{m.nombre}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.estado === "POR_COBRAR" ? "Por cobrar" : m.estado === "OCUPADA" ? "Ocupada" : "Libre"}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setModalActivo(null)} className="btn-ghost mt-3 w-full">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Cuentas aparcadas ── */}
      {modalActivo === 'APARCADOS' && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalActivo(null)}>
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
            <button type="button" onClick={() => setModalActivo(null)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Dividir cuenta (DividirCuentaModal): reparte líneas en documentos ── */}
      {modalActivo === 'DIVIDIR' && (
        <DividirCuentaModal
          lineas={lineasComanda().map((l) => ({ id: l.id, nombre: l.nombre, uds: l.cantidad, precio: l.precio }))}
          total={total}
          comensales={comensales}
          onAceptar={dividirAceptar}
          onCobrarTodos={() => { setModalActivo('COBRAR'); }}
          onCancelar={() => setModalActivo(null)}
          onAbrirCajon={abrirCajonManual}
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
      {modalActivo === 'INVITAR' && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalActivo(null)}>
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
              <button type="button" onClick={() => setModalActivo(null)} className="btn-primary text-sm">Hecho</button>
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
        // Unidades de partida del stepper: al re-editar, las de la línea; si no, las del
        // teclado (Und). getState al abrir: el buffer no cambia con el modal abierto.
        const tecl = useTpvStore.getState();
        const bufferUds = tecl.modo === "UND" ? (Number(tecl.buffer.replace(",", ".")) || 1) : 1;
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
            onEliminar={() => {
              if (modProd.reemplazar) {
                const key = modProd.reemplazar;
                setComanda((c) => { const { [key]: _, ...r } = c; return r; });
                setDescuentos((d) => { const { [key]: _, ...r } = d; return r; });
                setPreciosManuales((m) => { const { [key]: _, ...r } = m; return r; });
                setNotas((n) => { const { [key]: _, ...r } = n; return r; });
                setInvitadas((v) => { const { [key]: _, ...r } = v; return r; });
                setLineaSel(null);
              }
              setModProd(null);
            }}
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
      {modalActivo === 'NUEVO_PROD' && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalActivo(null)}>
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
                {nuevoProd.foto_url && <img src={urlFoto(nuevoProd.foto_url)} alt="" className="h-9 w-9 rounded object-cover" />}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => crearProductoRapido(false)} disabled={!nuevoProd.nombre.trim() || !nuevoProd.precio || busy} className="btn-ghost flex-1 disabled:opacity-50">Crear</button>
              <button type="button" onClick={() => crearProductoRapido(true)} disabled={!nuevoProd.nombre.trim() || !nuevoProd.precio || busy} className="btn-primary flex-1 disabled:opacity-50">Crear y añadir</button>
            </div>
            <button type="button" onClick={() => setModalActivo(null)} className="btn-ghost mt-2 w-full">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Modal: Utilidades ── */}
      {modalActivo === 'UTILIDADES' && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setModalActivo(null)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-semibold">Utilidades</h3>
            <div className="space-y-1.5">
              {window.gluuh && (
                <button type="button" onClick={() => { setModalActivo(null); abrirCajonManual(); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">Abrir cajón</button>
              )}
              <button type="button" onClick={reprimirUltimo} disabled={!ultimoDoc} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent disabled:opacity-40">Reimprimir último ticket</button>
              <button type="button" onClick={() => { setModalActivo(null); router.push("/modulos"); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">Módulos y pantallas</button>
              <button type="button" onClick={() => setSurfaceTheme(resolvedTheme === "dark" ? "light" : "dark")} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">{resolvedTheme === "dark" ? "Modo claro ☀️" : "Modo oscuro 🌙"}</button>
              <button type="button" onClick={() => { setModalActivo(null); salirOperario(); }} className="w-full rounded-md border border-border px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-accent">Salir del operario</button>
            </div>
            <button type="button" onClick={() => setModalActivo(null)} className="btn-ghost mt-3 w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Cobrar (CobrarModal): pago mixto, propina, descuento, F10/F11/F12 ── */}
      {modalActivo === 'COBRAR' && (
        <CobrarModal
          total={total}
          baseImponible={desgloseCobro.base}
          impuesto={desgloseCobro.impuesto}
          cliente={cliente?.nombre}
          clienteNif={cliente?.nif ?? null}
          empleado={operario?.nombre}
          terminal={terminal}
          formasPago={formasPago}
          onCobrar={cobrarDesdeModal}
          onImprimirCuenta={imprimirRecibo}
          onCancelar={() => setModalActivo(null)}
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
