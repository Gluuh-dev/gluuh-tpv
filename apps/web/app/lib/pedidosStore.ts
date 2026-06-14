/**
 * Almacén de pedidos EN MEMORIA para la demo del flujo fast-food
 * (kiosko → cocina/KDS → display de cliente).
 *
 * ⚠️ DEMO: en producción esto vive en Supabase y la actualización en tiempo real
 * se hace con Supabase Realtime (no con polling). Ver docs/06 y docs/14.
 * Se guarda en globalThis para sobrevivir al hot-reload en desarrollo.
 */

import type { EstadoPreparacion, TipoOperacion } from "@gluppo/core";

export interface PedidoItem {
  nombre: string;
  cantidad: number;
  precio: number;
  tipo: number;
}

export interface Pedido {
  id: string;
  numero: number;
  canal: "KIOSKO" | "TPV" | "COMANDERA" | "ONLINE";
  tipoConsumo: "LOCAL" | "PARA_LLEVAR";
  tipoOperacion: TipoOperacion;
  estado: EstadoPreparacion;
  items: PedidoItem[];
  total: number;
  creadoEn: number;
}

interface Store {
  pedidos: Pedido[];
  siguienteNumero: number;
}

const g = globalThis as unknown as { __gluppoPedidos?: Store };
const store: Store = g.__gluppoPedidos ?? { pedidos: [], siguienteNumero: 1 };
g.__gluppoPedidos = store;

export function crearPedido(input: {
  items: PedidoItem[];
  tipoConsumo: Pedido["tipoConsumo"];
  canal?: Pedido["canal"];
  tipoOperacion?: TipoOperacion;
}): Pedido {
  const total = input.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const pedido: Pedido = {
    id: crypto.randomUUID(),
    numero: store.siguienteNumero++,
    canal: input.canal ?? "KIOSKO",
    tipoConsumo: input.tipoConsumo,
    tipoOperacion: input.tipoOperacion ?? "VENTA",
    estado: "PENDIENTE",
    items: input.items,
    total: Math.round(total * 100) / 100,
    creadoEn: Date.now(),
  };
  store.pedidos.unshift(pedido);
  // Limita el histórico en memoria.
  if (store.pedidos.length > 200) store.pedidos.length = 200;
  return pedido;
}

export function listarPedidos(estado?: EstadoPreparacion): Pedido[] {
  return estado ? store.pedidos.filter((p) => p.estado === estado) : store.pedidos;
}

export function actualizarEstado(id: string, estado: EstadoPreparacion): Pedido | undefined {
  const p = store.pedidos.find((x) => x.id === id);
  if (p) p.estado = estado;
  return p;
}
