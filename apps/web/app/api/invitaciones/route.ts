import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { quienLlama, comoElServicio } from "@/app/lib/supabaseServidor";

// Emitir una INVITACIÓN (F2, migración 0115): sustituye al reparto de
// contraseñas. El token viaja UNA vez en la respuesta (para entregarlo por el
// canal que se decida); en la base solo queda su hash SHA-256. Siete días,
// un solo uso, una pendiente por email y empresa.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const llamante = await quienLlama(req);
  if (!llamante) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { supa: caller, userId } = llamante;

  // Autorización en SERVIDOR: gestionar usuarios (operario_permite es fail-closed
  // tras 0113; hasta entonces el propio RLS del insert limita el daño).
  const { data: puede, error: ePerm } = await caller.rpc("operario_permite", { p_permiso: "admin.usuarios" });
  if (ePerm) return NextResponse.json({ error: ePerm.message }, { status: 500 });
  if (!puede) return NextResponse.json({ error: "Sin permiso para invitar usuarios" }, { status: 403 });

  const cuerpo = await req.json().catch(() => ({}));
  const email = String(cuerpo.email ?? "").trim().toLowerCase();
  const nombre = String(cuerpo.nombre ?? "").trim();
  const rol = String(cuerpo.rol ?? "ENCARGADO");
  const perfilId = typeof cuerpo.perfil_id === "string" ? cuerpo.perfil_id : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email no válido" }, { status: 400 });
  }

  // Tenant del llamante (por su membresía, no por lo que diga el navegador).
  const { data: yo } = await caller
    .from("app_user").select("tenant_id, cuenta_id").eq("auth_user_id", userId).maybeSingle();
  const tenantId = (yo as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "Identidad incompleta" }, { status: 403 });

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { error } = await admin.from("invitacion").insert({
    tenant_id: tenantId,
    email,
    nombre: nombre || null,
    rol,
    perfil_id: perfilId,
    token_hash: tokenHash,
    emitida_por: (yo as { cuenta_id?: string | null } | null)?.cuenta_id ?? null,
  });
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json(
      { error: dup ? "Ya hay una invitación pendiente para ese email. Revócala antes de reemitir." : error.message },
      { status: dup ? 409 : 500 },
    );
  }

  // El enlace se devuelve UNA vez; no se persiste ni se registra en logs.
  const origen = new URL(req.url).origin;
  return NextResponse.json({ ok: true, url: `${origen}/invitacion/${token}`, caduca_dias: 7 });
}
