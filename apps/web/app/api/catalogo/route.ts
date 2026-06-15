import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lee la carta (categorías + productos) desde Supabase REAL usando la clave
// secreta (solo servidor → se salta la RLS de forma segura). El navegador nunca
// ve la clave. Ver docs/06 y docs/12.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase no configurado (faltan env)" }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: categorias, error: e1 }, { data: productos, error: e2 }] = await Promise.all([
    supabase.from("category").select("id,nombre,orden").eq("tenant_id", DEMO_TENANT).order("orden"),
    supabase
      .from("product")
      .select("id,nombre,precio,tipo_impositivo,category_id,disponible")
      .eq("tenant_id", DEMO_TENANT)
      .order("nombre"),
  ]);

  if (e1 || e2) {
    return NextResponse.json({ error: (e1 ?? e2)?.message }, { status: 500 });
  }

  return NextResponse.json({ categorias, productos });
}
