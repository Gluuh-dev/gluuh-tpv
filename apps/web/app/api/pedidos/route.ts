import { NextResponse } from "next/server";
import type { EstadoPreparacion } from "@gluuh/core";
import { crearPedido, listarPedidos, type PedidoItem } from "../../lib/pedidosStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pedidos?estado=EN_PREPARACION → lista de pedidos (demo en memoria). */
export async function GET(req: Request) {
  const estado = new URL(req.url).searchParams.get("estado") as EstadoPreparacion | null;
  return NextResponse.json(listarPedidos(estado ?? undefined));
}

interface CrearDto {
  items: PedidoItem[];
  tipoConsumo: "LOCAL" | "PARA_LLEVAR";
  canal?: "KIOSKO" | "TPV" | "COMANDERA" | "ONLINE";
}

/** POST /api/pedidos → crea un pedido (desde el kiosko). */
export async function POST(req: Request) {
  const dto = (await req.json()) as CrearDto;
  if (!dto.items?.length) {
    return NextResponse.json({ error: "Pedido vacío" }, { status: 400 });
  }
  const pedido = crearPedido({
    items: dto.items,
    tipoConsumo: dto.tipoConsumo ?? "LOCAL",
    canal: dto.canal ?? "KIOSKO",
  });
  return NextResponse.json(pedido, { status: 201 });
}
