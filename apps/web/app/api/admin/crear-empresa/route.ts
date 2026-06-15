import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Crea una cuenta de empresa. SOLO el administrador de plataforma (Gluuh).
// Verifica al llamante con su token (es_admin_plataforma) y luego usa la clave
// secreta para crear el usuario; el trigger provisiona tenant + propietario.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const caller = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: esAdmin, error: e1 } = await caller.rpc("es_admin_plataforma");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!esAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { empresa, email, password } = await req.json();
  if (!empresa || !email || !password) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { empresa_nombre: empresa },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, userId: data.user?.id });
}
