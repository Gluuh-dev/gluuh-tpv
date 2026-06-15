import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TENANT = "11111111-1111-1111-1111-111111111111";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

// Cambia el estado de preparación (desde el KDS).
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { estado } = await req.json();
  const sb = admin();
  const { error } = await sb
    .from("sales_order")
    .update({ estado_preparacion: estado })
    .eq("id", ctx.params.id)
    .eq("tenant_id", TENANT);
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ ok: true });
}
