import { create } from "zustand";

export type ModoDescuento = { tipo: "PCT" | "EUR"; valor: number };

export interface OperarioInfo {
  id: string;
  nombre: string;
}

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

export interface Cliente {
  id: string | null;
  nombre: string;
  telefono?: string | null;
  /** Con NIF la venta se factura COMPLETA (AEAT F1); sin NIF, simplificada (F2). */
  nif?: string | null;
}

export interface TpvState {
  // Ticket / Account state
  comanda: Record<string, number>;
  descuentos: Record<string, ModoDescuento>;
  preciosManuales: Record<string, number>;
  notas: Record<string, string>;
  invitadas: Record<string, boolean>;
  anadidoPor: Record<string, OperarioInfo>;
  pases: Record<string, number>;
  lineaSel: string | null;
  
  // Context selection
  mesa: Mesa | null;
  llevar: { nombre: string; telefono: string } | null;
  ordenAbiertaId: string | null;
  
  // Account properties
  cliente: Cliente | null;
  comensales: number;
  alias: string;
  tipoOperacion: "VENTA" | "INVITACION" | "AUTOCONSUMO";
  
  // Calculator state
  buffer: string;
  modo: "UND" | "PREC" | "DTO%" | "DTO€";
  editando: boolean;
  modoZurdo: boolean;

  // Actions
  setComanda: (val: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setDescuentos: (val: Record<string, ModoDescuento> | ((prev: Record<string, ModoDescuento>) => Record<string, ModoDescuento>)) => void;
  setPreciosManuales: (val: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setNotas: (val: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setInvitadas: (val: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  setAnadidoPor: (val: Record<string, OperarioInfo> | ((prev: Record<string, OperarioInfo>) => Record<string, OperarioInfo>)) => void;
  setPases: (val: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setLineaSel: (val: string | null | ((prev: string | null) => string | null)) => void;
  
  setMesa: (val: Mesa | null | ((prev: Mesa | null) => Mesa | null)) => void;
  setLlevar: (val: { nombre: string; telefono: string } | null | ((prev: { nombre: string; telefono: string } | null) => { nombre: string; telefono: string } | null)) => void;
  setOrdenAbiertaId: (val: string | null | ((prev: string | null) => string | null)) => void;
  
  setCliente: (val: Cliente | null | ((prev: Cliente | null) => Cliente | null)) => void;
  setComensales: (val: number | ((prev: number) => number)) => void;
  setAlias: (val: string | ((prev: string) => string)) => void;
  setTipoOperacion: (val: "VENTA" | "INVITACION" | "AUTOCONSUMO" | ((prev: "VENTA" | "INVITACION" | "AUTOCONSUMO") => "VENTA" | "INVITACION" | "AUTOCONSUMO")) => void;
  
  setBuffer: (val: string | ((prev: string) => string)) => void;
  setModo: (val: "UND" | "PREC" | "DTO%" | "DTO€" | ((prev: "UND" | "PREC" | "DTO%" | "DTO€") => "UND" | "PREC" | "DTO%" | "DTO€")) => void;
  setEditando: (val: boolean | ((prev: boolean) => boolean)) => void;
  setModoZurdo: (val: boolean | ((prev: boolean) => boolean)) => void;
  
  limpiarCuenta: () => void;
}

export const useTpvStore = create<TpvState>((set) => ({
  // Ticket / Account state
  comanda: {},
  descuentos: {},
  preciosManuales: {},
  notas: {},
  invitadas: {},
  anadidoPor: {},
  pases: {},
  lineaSel: null,
  
  // Context selection
  mesa: null,
  llevar: null,
  ordenAbiertaId: null,
  
  // Account properties
  cliente: null,
  comensales: 1,
  alias: "",
  tipoOperacion: "VENTA",
  
  // Calculator state
  buffer: "",
  modo: "UND",
  editando: false,
  modoZurdo: (typeof window !== "undefined" && localStorage.getItem("gluuh_modo_zurdo") === "true"),

  // Actions
  setComanda: (val) => set((state) => ({ comanda: typeof val === "function" ? val(state.comanda) : val })),
  setDescuentos: (val) => set((state) => ({ descuentos: typeof val === "function" ? val(state.descuentos) : val })),
  setPreciosManuales: (val) => set((state) => ({ preciosManuales: typeof val === "function" ? val(state.preciosManuales) : val })),
  setNotas: (val) => set((state) => ({ notas: typeof val === "function" ? val(state.notas) : val })),
  setInvitadas: (val) => set((state) => ({ invitadas: typeof val === "function" ? val(state.invitadas) : val })),
  setAnadidoPor: (val) => set((state) => ({ anadidoPor: typeof val === "function" ? val(state.anadidoPor) : val })),
  setPases: (val) => set((state) => ({ pases: typeof val === "function" ? val(state.pases) : val })),
  setLineaSel: (val) => set((state) => ({ lineaSel: typeof val === "function" ? val(state.lineaSel) : val })),
  
  setMesa: (val) => set((state) => ({ mesa: typeof val === "function" ? val(state.mesa) : val })),
  setLlevar: (val) => set((state) => ({ llevar: typeof val === "function" ? val(state.llevar) : val })),
  setOrdenAbiertaId: (val) => set((state) => ({ ordenAbiertaId: typeof val === "function" ? val(state.ordenAbiertaId) : val })),
  
  setCliente: (val) => set((state) => ({ cliente: typeof val === "function" ? val(state.cliente) : val })),
  setComensales: (val) => set((state) => ({ comensales: typeof val === "function" ? val(state.comensales) : val })),
  setAlias: (val) => set((state) => ({ alias: typeof val === "function" ? val(state.alias) : val })),
  setTipoOperacion: (val) => set((state) => ({ tipoOperacion: typeof val === "function" ? val(state.tipoOperacion) : val })),
  
  setBuffer: (val) => set((state) => ({ buffer: typeof val === "function" ? val(state.buffer) : val })),
  setModo: (val) => set((state) => ({ modo: typeof val === "function" ? val(state.modo) : val })),
  setEditando: (val) => set((state) => ({ editando: typeof val === "function" ? val(state.editando) : val })),
  setModoZurdo: (val) => set((state) => {
    const next = typeof val === "function" ? val(state.modoZurdo) : val;
    if (typeof window !== "undefined") {
      localStorage.setItem("gluuh_modo_zurdo", String(next));
    }
    return { modoZurdo: next };
  }),
  
  limpiarCuenta: () => set({
    comanda: {},
    descuentos: {},
    preciosManuales: {},
    notas: {},
    invitadas: {},
    anadidoPor: {},
    pases: {},
    lineaSel: null,
    cliente: null,
    comensales: 1,
    alias: "",
    tipoOperacion: "VENTA",
    buffer: "",
    modo: "UND",
    editando: false
  })
}));
