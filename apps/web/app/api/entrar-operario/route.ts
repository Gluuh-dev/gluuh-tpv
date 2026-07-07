import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Login local por USUARIO (nombre) + clave (backoffice sin email). Verifica
// (verificar_clave_operario, solo operarios sin email) y asegura una cuenta auth
// SINTÉTICA (email interno estable por código) con contraseña = clave; devuelve su
// email para que el cliente complete signInWithPassword. El login por email no se toca.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email interno determinista (tenant8 + código → único). No se muestra al usuario.
const emailSintetico = (codigo: string, tenantId: string) =>
  `op.${codigo}.${tenantId.slice(0, 8)}@codigo.gluuh.local`;

export async function POST(req: Request) {
  const { usuario, clave } = await req.json().catch(() => ({}));
  if (!usuario || !clave) return NextResponse.json({ error: "Falta el usuario o la clave" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("verificar_clave_operario", { p_usuario: String(usuario), p_clave: String(clave) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const op = (Array.isArray(data) ? data[0] : data) as { id: string; tenant_id: string; nombre: string; codigo: string; auth_user_id: string | null } | undefined;
  if (!op) return NextResponse.json({ error: "Usuario o clave incorrectos" }, { status: 401 });

  const email = emailSintetico(op.codigo, op.tenant_id);
  // Asegurar cuenta auth sintética con contraseña = clave (nunca toca un email real:
  // verificar_clave_operario ya excluye operarios con email).
  if (op.auth_user_id) {
    const { error: e } = await admin.auth.admin.updateUserById(op.auth_user_id, { password: String(clave) });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  } else {
    const { data: creado, error: e } = await admin.auth.admin.createUser({ email, password: String(clave), email_confirm: true });
    if (e || !creado.user) return NextResponse.json({ error: e?.message ?? "No se pudo preparar el acceso" }, { status: 500 });
    const { error: e2 } = await admin.from("app_user").update({ auth_user_id: creado.user.id }).eq("id", op.id);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
