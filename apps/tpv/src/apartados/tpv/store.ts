import { create } from "zustand";
import { PRODUCTOS_DEMO } from "./datos";

// Store de la VENTA (operativa), calcado en esencia del TPV de Next: comanda,
// línea seleccionada, teclado con modos que aplican EN VIVO. Demo sobre
// PRODUCTOS_DEMO; al cablear el nodo cambia la fuente del catálogo, no la forma.

export type ModoTeclado = "UND" | "PREC" | "DTO%" | "DTO€";
export interface Descuento { tipo: "PCT" | "EUR"; valor: number }

function precioBase(id: string): number {
  return PRODUCTOS_DEMO.find((p) => p.id === id)?.precio ?? 0;
}

export interface VentaState {
  contexto: string;
  comensales: number;
  alias: string;

  comanda: Record<string, number>;
  precios: Record<string, number>;
  descuentos: Record<string, Descuento>;
  invitadas: Record<string, boolean>;
  lineaSel: string | null;

  catSel: string | null;
  busqueda: string;

  buffer: string;
  modo: ModoTeclado;
  editando: boolean;

  iniciar: (contexto: string, comensales?: number) => void;
  addProd: (id: string) => void;
  seleccionar: (id: string) => void;
  setComensales: (n: number) => void;
  setAlias: (a: string) => void;
  setCatSel: (c: string | null) => void;
  setBusqueda: (b: string) => void;
  invitarLinea: (id: string) => void;
  anularLinea: (id: string) => void;
  vaciar: () => void;

  pulsarModo: (m: ModoTeclado) => void;
  pulsarDigito: (d: string) => void;
  borrar: () => void;
  limpiar: () => void;

  precioEfectivo: (id: string) => number;
  precioSel: () => number;   // precio unitario de la línea seleccionada (para la barra)
  descSel: () => Descuento | null;
  total: () => number;
  unidades: () => number;
}

// Aplica el buffer a la línea seleccionada SEGÚN el modo (en vivo). Buffer vacío
// = revertir (uds→1, sin precio manual, sin descuento).
function aplicar(s: VentaState, buffer: string): Partial<VentaState> {
  const id = s.lineaSel;
  if (!id) return {};
  const num = Number.parseFloat(buffer.replace(",", ".")) || 0;

  if (s.modo === "UND") {
    if (buffer === "") return {};
    return { comanda: { ...s.comanda, [id]: Math.max(1, Math.round(num)) } };
  }
  if (s.modo === "PREC") {
    const precios = { ...s.precios };
    if (buffer === "") delete precios[id]; else precios[id] = num;
    return { precios };
  }
  const descuentos = { ...s.descuentos };
  if (buffer === "") delete descuentos[id];
  else descuentos[id] = { tipo: s.modo === "DTO%" ? "PCT" : "EUR", valor: num };
  return { descuentos };
}

export const useVenta = create<VentaState>((set, get) => ({
  contexto: "",
  comensales: 1,
  alias: "",
  comanda: {},
  precios: {},
  descuentos: {},
  invitadas: {},
  lineaSel: null,
  catSel: null,
  busqueda: "",
  buffer: "",
  modo: "UND",
  editando: false,

  iniciar: (contexto, comensales = 1) => set({
    contexto, comensales, alias: "",
    comanda: {}, precios: {}, descuentos: {}, invitadas: {},
    lineaSel: null, buffer: "", modo: "UND", editando: false, busqueda: "",
  }),

  addProd: (id) => set((s) => ({
    comanda: { ...s.comanda, [id]: (s.comanda[id] ?? 0) + 1 },
    lineaSel: id, buffer: "", editando: false, modo: "UND",
  })),

  seleccionar: (id) => set({ lineaSel: id, buffer: "", editando: false }),
  setComensales: (n) => set({ comensales: Math.max(1, n) }),
  setAlias: (a) => set({ alias: a }),
  setCatSel: (c) => set({ catSel: c }),
  setBusqueda: (b) => set({ busqueda: b }),

  invitarLinea: (id) => set((s) => ({ invitadas: { ...s.invitadas, [id]: !s.invitadas[id] } })),

  anularLinea: (id) => set((s) => {
    const comanda = { ...s.comanda }; delete comanda[id];
    const precios = { ...s.precios }; delete precios[id];
    const descuentos = { ...s.descuentos }; delete descuentos[id];
    const invitadas = { ...s.invitadas }; delete invitadas[id];
    return { comanda, precios, descuentos, invitadas, lineaSel: s.lineaSel === id ? null : s.lineaSel };
  }),

  vaciar: () => set({ comanda: {}, precios: {}, descuentos: {}, invitadas: {}, lineaSel: null, buffer: "", editando: false }),

  // Pulsar un modo: si ya estabas en él, sales; si no, entras (empieza vacío; el
  // valor de la línea no cambia hasta que teclees).
  pulsarModo: (m) => set((s) => (s.modo === m && s.editando ? { editando: false, buffer: "" } : { modo: m, editando: true, buffer: "" })),

  pulsarDigito: (d) => set((s) => {
    if (!s.editando) return s;
    if (d === "," && s.buffer.includes(",")) return s;
    const buffer = (s.buffer + d).slice(0, 8);
    return { buffer, ...aplicar({ ...s, buffer }, buffer) };
  }),

  borrar: () => set((s) => {
    const buffer = s.buffer.slice(0, -1);
    return { buffer, ...aplicar({ ...s, buffer }, buffer) };
  }),

  limpiar: () => set((s) => ({ buffer: "", ...aplicar({ ...s, buffer: "" }, "") })),

  precioEfectivo: (id) => {
    const s = get();
    let base = s.precios[id] ?? precioBase(id.split("|")[0]!);
    const d = s.descuentos[id];
    if (d) base = d.tipo === "PCT" ? base * (1 - d.valor / 100) : base - d.valor;
    return Math.max(0, Math.round(base * 100) / 100);
  },

  precioSel: () => {
    const s = get();
    const id = s.lineaSel;
    if (!id) return 0;
    return s.precios[id] ?? precioBase(id.split("|")[0]!);
  },
  descSel: () => {
    const s = get();
    return (s.lineaSel && s.descuentos[s.lineaSel]) || null;
  },

  total: () => {
    const s = get();
    return Object.entries(s.comanda).reduce((acc, [id, q]) => acc + (s.invitadas[id] ? 0 : s.precioEfectivo(id) * q), 0);
  },

  unidades: () => Object.values(get().comanda).reduce((a, q) => a + q, 0),
}));
