import { NextResponse } from "next/server";
import { quienLlama, comoElServicio } from "@/app/lib/supabaseServidor";

// Cambio de contraseña SERVER-SIDE (F2 entrega 2.2). Antes el cliente hacía
// `auth.updateUser({ data: { debe_cambiar_password: false } })` — es decir, la
// bandera de "cambio obligatorio" vivía en metadata que el PROPIO cliente puede
// borrar sin cambiar nada. Ahora el servidor cambia la contraseña y solo
// entonces limpia la bandera (metadata para la UI + `cuenta` como autoridad).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const llamante = await quienLlama(req);
  if (!llamante) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cuerpo = await req.json().catch(() => ({}));
  const password = typeof cuerpo.password === "string" ? cuerpo.password : "";
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }
  if (password.length > 256) {
    return NextResponse.json({ error: "Contraseña demasiado larga" }, { status: 400 });
  }

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  const { error } = await admin.auth.admin.updateUserById(llamante.userId, {
    password,
    user_metadata: { debe_cambiar_password: false },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Autoridad server-side (0111). Si la migración aún no está aplicada, la
  // metadata ya quedó limpia y esto simplemente no encuentra la tabla.
  await admin.from("cuenta")
    .update({ debe_cambiar_password: false, password_caduca_at: null, updated_at: new Date().toISOString() })
    .eq("auth_user_id", llamante.userId);

  // ponytail: falta revocar el resto de sesiones al cambiarla (F2 entrega 2.3);
  // requiere el inventario de sesiones de 0111 poblado por el login.
  return NextResponse.json({ ok: true });
}
