import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { excedeLimite, ipDe } from "../dispositivos/limite";

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
  // Anti fuerza bruta de claves de operario (mismo mecanismo que el emparejado):
  // 10 intentos/min por IP. Las claves suelen ser de 4 dígitos → imprescindible.
  if (excedeLimite(`operario:${ipDe(req)}`, 10)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." }, { status: 429 });
  }

  const { usuario, clave, tenant_id } = await req.json().catch(() => ({}));
  if (!usuario || !clave) return NextResponse.json({ error: "Falta el usuario o la clave" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  const admin = createClient(url, secret, { auth: { persistSession: false } });
  // Instalación fijada a una empresa (0078): el operario SOLO puede entrar en su
  // tenant, aunque usuario+clave coincidan en otra empresa.
  const { data, error } = await admin.rpc("verificar_clave_operario", {
    p_usuario: String(usuario),
    p_clave: String(clave),
    p_tenant: typeof tenant_id === "string" && tenant_id ? tenant_id : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const op = (Array.isArray(data) ? data[0] : data) as { id: string; tenant_id: string; nombre: string; codigo: string; auth_user_id: string | null } | undefined;
  if (!op) return NextResponse.json({ error: "Usuario o clave incorrectos" }, { status: 401 });

  const email = emailSintetico(op.codigo, op.tenant_id);
  // La clave (4+ díg.) ya se verificó contra clave_hash. La contraseña de la cuenta
  // sintética es un TOKEN aleatorio fuerte (Supabase exige ≥6) que se fija ahora y se
  // devuelve para que el cliente inicie sesión. Nunca toca un email real (verificar
  // excluye operarios con email).
  const passSesion = randomBytes(24).toString("base64url");
  if (op.auth_user_id) {
    const { error: e } = await admin.auth.admin.updateUserById(op.auth_user_id, { password: passSesion });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  } else {
    const { data: creado, error: e } = await admin.auth.admin.createUser({ email, password: passSesion, email_confirm: true });
    if (e || !creado.user) return NextResponse.json({ error: e?.message ?? "No se pudo preparar el acceso" }, { status: 500 });
    const { error: e2 } = await admin.from("app_user").update({ auth_user_id: creado.user.id }).eq("id", op.id);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, secret: passSesion });
}
