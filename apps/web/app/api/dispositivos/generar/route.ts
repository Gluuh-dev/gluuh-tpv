import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Genera un código de vinculación de 6 dígitos (caduca en 10 min, un solo uso).
// Solo PROPIETARIO/ENCARGADO (el rol viaja en el JWT vía el auth hook).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function claim(token: string, nombre: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return String(payload[nombre] ?? "");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const caller = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { error: eUser } = await caller.auth.getUser();
  if (eUser) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rol = claim(token, "user_rol");
  if (!["PROPIETARIO", "ENCARGADO"].includes(rol)) {
    return NextResponse.json({ error: "Solo encargado o propietario" }, { status: 403 });
  }
  const tenantId = claim(token, "tenant_id");
  if (!tenantId) return NextResponse.json({ error: "Sesión sin empresa" }, { status: 403 });

  const { tipo = "TPV", modulo = "TPV", nombre = "" } = await req.json().catch(() => ({}));

  // Local del tenant (RLS del llamante).
  const { data: loc } = await caller.from("location").select("id").limit(1).maybeSingle();
  if (!loc) return NextResponse.json({ error: "La empresa no tiene local" }, { status: 400 });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: dev, error } = await admin
    .from("device")
    .insert({
      tenant_id: tenantId,
      location_id: loc.id,
      tipo,
      modulo,
      nombre: nombre || `${tipo} nuevo`,
      codigo_vinculacion: codigo,
      codigo_expira: expira,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, device_id: dev.id, codigo, expira });
}
