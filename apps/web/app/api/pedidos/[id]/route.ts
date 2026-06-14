import { NextResponse } from "next/server";
import type { EstadoPreparacion } from "@gluppo/core";
import { actualizarEstado } from "../../../lib/pedidosStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/pedidos/:id → cambia el estado de preparación (desde el KDS). */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { estado } = (await req.json()) as { estado: EstadoPreparacion };
  const pedido = actualizarEstado(ctx.params.id, estado);
  if (!pedido) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  return NextResponse.json(pedido);
}
