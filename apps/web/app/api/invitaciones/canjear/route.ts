import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { comoElServicio, quienLlama } from "@/app/lib/supabaseServidor";

// Canje de una invitación (F2, migración 0115).
//
//   GET  ?token=…            → a quién invita y a qué empresa (para la página).
//   POST {token, password?}  → aceptarla:
//        · email SIN cuenta: crea el usuario Auth con SU contraseña (elegida por
//          la persona; Gluuh nunca la conoce), la cuenta global y la membresía.
//        · email CON cuenta: exige sesión iniciada de ESE email (Bearer) y añade
//          la membresía sin tocar la contraseña (plan 14 §6).
// La transición EMITIDA→ACEPTADA es atómica en SQL (canjear_invitacion): un
// token solo se canjea una vez aunque lleguen dos peticiones a la vez.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

type Invitacion = {
  id: string; tenant_id: string; email: string; nombre: string | null; rol: string;
  perfil_id: string | null; es_titular: boolean; estado: string; expira_at: string;
};

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 400 });
  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  const { data } = await admin
    .from("invitacion")
    .select("email, estado, expira_at, tenant:tenant_id(nombre)")
    .eq("token_hash", hash(token))
    .maybeSingle();
  const inv = data as { email: string; estado: string; expira_at: string; tenant: { nombre: string } | null } | null;
  if (!inv) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  const caducada = inv.estado === "EMITIDA" && new Date(inv.expira_at) < new Date();
  return NextResponse.json({
    empresa: inv.tenant?.nombre ?? "",
    email: inv.email,
    estado: caducada ? "CADUCADA" : inv.estado,
  });
}

export async function POST(req: Request) {
  const cuerpo = await req.json().catch(() => ({}));
  const token = String(cuerpo.token ?? "");
  const password = typeof cuerpo.password === "string" ? cuerpo.password : "";
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 400 });

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  // Mirar (sin consumir) para decidir el camino: ¿existe ya una cuenta Auth
  // con ese email?
  const { data: previa } = await admin
    .from("invitacion").select("*").eq("token_hash", hash(token)).maybeSingle();
  const inv = previa as Invitacion | null;
  if (!inv) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
  if (inv.estado !== "EMITIDA" || new Date(inv.expira_at) < new Date()) {
    return NextResponse.json({ error: "La invitación ya no es válida" }, { status: 410 });
  }

  let authUserId: string;
  const llamante = await quienLlama(req);
  if (llamante) {
    // Cuenta existente: la sesión debe ser DEL email invitado.
    const { data: u } = await llamante.supa.auth.getUser();
    const emailSesion = u.user?.email?.toLowerCase();
    if (emailSesion !== inv.email.toLowerCase()) {
      return NextResponse.json({ error: "La invitación es para otra cuenta" }, { status: 403 });
    }
    authUserId = llamante.userId;
  } else {
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    const { data: creado, error: eAlta } = await admin.auth.admin.createUser({
      email: inv.email,
      password,
      email_confirm: true, // llegar por el enlace de un solo uso ES la verificación del email
      user_metadata: { nombre: inv.nombre ?? "" },
    });
    if (eAlta || !creado.user) {
      const existe = /already|registered/i.test(eAlta?.message ?? "");
      return NextResponse.json(
        { error: existe ? "Ese email ya tiene cuenta: inicia sesión y vuelve a abrir el enlace." : (eAlta?.message ?? "No se pudo crear la cuenta") },
        { status: existe ? 409 : 500 },
      );
    }
    authUserId = creado.user.id;
  }

  // Cuenta global (idempotente) y membresía en la empresa.
  const { data: cuentaPrevia } = await admin.from("cuenta").select("id").eq("auth_user_id", authUserId).maybeSingle();
  let cuentaId = (cuentaPrevia as { id: string } | null)?.id ?? null;
  if (!cuentaId) {
    const { data: cNueva, error: eCuenta } = await admin
      .from("cuenta").insert({ auth_user_id: authUserId, nombre: inv.nombre ?? null }).select("id").single();
    if (eCuenta) return NextResponse.json({ error: eCuenta.message }, { status: 500 });
    cuentaId = (cNueva as { id: string }).id;
  }

  // Consumir la invitación de forma ATÓMICA: si otra petición llegó antes, aquí
  // no vuelve ninguna fila y no se crea membresía duplicada.
  const { data: canje, error: eCanje } = await admin.rpc("canjear_invitacion", {
    p_token_hash: hash(token),
    p_cuenta: cuentaId,
  });
  if (eCanje) return NextResponse.json({ error: eCanje.message }, { status: 500 });
  if (!Array.isArray(canje) || canje.length === 0) {
    return NextResponse.json({ error: "La invitación ya no es válida" }, { status: 410 });
  }

  const { error: eMiembro } = await admin.from("app_user").insert({
    tenant_id: inv.tenant_id,
    nombre: inv.nombre ?? inv.email.split("@")[0],
    email: inv.email,
    rol: inv.rol,
    perfil_id: inv.perfil_id,
    activo: true,
    auth_user_id: authUserId,
    cuenta_id: cuentaId,
  });
  if (eMiembro && !/duplicate|unique/i.test(eMiembro.message)) {
    return NextResponse.json({ error: eMiembro.message }, { status: 500 });
  }

  // Titular: el alta de la empresa avanza (email verificado + contraseña propia).
  if (inv.es_titular) {
    await admin.from("tenant").update({ estado_alta: "PASSWORD_CAMBIADA" }).eq("id", inv.tenant_id);
  }

  return NextResponse.json({ ok: true, empresa: inv.tenant_id });
}
