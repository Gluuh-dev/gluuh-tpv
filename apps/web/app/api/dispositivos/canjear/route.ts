import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

// Canjea un código de vinculación de 6 dígitos por una credencial de
// dispositivo (JWT propio, no sesión Supabase). Lo llama la pantalla /conectar
// SIN autenticar: el código vigente ES la autorización (un solo uso, 10 min).
// Diseño: docs/implementacion/04-modulos-y-emparejado.md (paso 3).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { codigo } = await req.json().catch(() => ({ codigo: "" }));
  if (!/^\d{6}$/.test(String(codigo ?? ""))) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const secreto = process.env.DEVICE_JWT_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "Falta DEVICE_JWT_SECRET en el servidor" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: dev, error } = await admin
    .from("device")
    .select("id, tenant_id, nombre, modulo, codigo_expira")
    .eq("codigo_vinculacion", String(codigo))
    .is("vinculado_at", null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!dev?.codigo_expira || new Date(dev.codigo_expira) < new Date()) {
    return NextResponse.json({ error: "Código no válido o caducado" }, { status: 404 });
  }

  // Un solo uso: el código se consume al vincular.
  const { error: e2 } = await admin
    .from("device")
    .update({ vinculado_at: new Date().toISOString(), codigo_vinculacion: null, codigo_expira: null })
    .eq("id", dev.id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const modulo = dev.modulo ?? "TPV";
  const token = await new SignJWT({ tenant_id: dev.tenant_id, device_id: dev.id, modulo })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(new TextEncoder().encode(secreto));

  return NextResponse.json({ ok: true, device_id: dev.id, nombre: dev.nombre, modulo, token });
}
