import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Pedidos REALES en Supabase (clave secreta, solo servidor). El kiosko es público
// (sin login), por eso pasa por esta ruta de servidor. KDS/display la consultan.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo (un local). En producción se deriva del dispositivo/sesión.
const TENANT = "11111111-1111-1111-1111-111111111111";
const LOCATION = "22222222-2222-2222-2222-222222222222";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

export async function GET() {
  const sb = admin();
  const { data, error } = await sb
    .from("sales_order")
    .select("id,numero_pedido,estado_preparacion,tipo_consumo,created_at,order_line(nombre,cantidad)")
    .eq("tenant_id", TENANT)
    .neq("estado_preparacion", "ENTREGADO")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pedidos = (data ?? []).map((o: any) => ({
    id: o.id,
    numero: o.numero_pedido,
    estado: o.estado_preparacion,
    tipoConsumo: o.tipo_consumo,
    items: (o.order_line ?? []).map((l: any) => ({ nombre: l.nombre, cantidad: l.cantidad })),
    creadoEn: new Date(o.created_at).getTime(),
  }));
  return NextResponse.json(pedidos);
}

export async function POST(req: Request) {
  const dto = await req.json();
  if (!dto.items?.length) return NextResponse.json({ error: "Pedido vacío" }, { status: 400 });
  const sb = admin();
  const { data, error } = await sb.rpc("crear_pedido_srv", {
    p_tenant: TENANT,
    p_location: LOCATION,
    p_canal: dto.canal ?? "KIOSKO",
    p_tipo_consumo: dto.tipoConsumo ?? "LOCAL",
    p_items: dto.items,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, numero: data.numero, estado: "PENDIENTE" }, { status: 201 });
}
