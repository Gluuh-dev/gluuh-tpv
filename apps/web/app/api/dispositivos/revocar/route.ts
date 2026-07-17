import { NextResponse } from "next/server";
import { quienLlama, comoElServicio } from "@/app/lib/supabaseServidor";

// Revocar un TERMINAL (F4, migración 0117): el propietario/encargado con permiso
// de usuarios corta las credenciales v2 del aparato. La renovación deja de
// funcionar al instante y el access caduca en ≤12 h. Revocar un terminal no
// afecta a los demás. (El JWT legacy de 30 días no es revocable: su retirada
// completa es F4.4, rotando DEVICE_JWT_SECRET cuando no queden clientes viejos.)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const llamante = await quienLlama(req);
  if (!llamante) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: puede, error: ePerm } = await llamante.supa.rpc("operario_permite", { p_permiso: "admin.usuarios" });
  if (ePerm) return NextResponse.json({ error: ePerm.message }, { status: 500 });
  if (!puede) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { device_id } = await req.json().catch(() => ({}));
  if (typeof device_id !== "string" || !device_id) {
    return NextResponse.json({ error: "Falta device_id" }, { status: 400 });
  }

  // El terminal tiene que ser del tenant del llamante (RLS del caller lo prueba).
  const { data: dev } = await llamante.supa.from("device").select("id, tenant_id").eq("id", device_id).maybeSingle();
  if (!dev) return NextResponse.json({ error: "Terminal no encontrado" }, { status: 404 });

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  const { error } = await admin
    .from("credencial_dispositivo")
    .update({ revocada_at: new Date().toISOString() })
    .eq("device_id", device_id)
    .is("revocada_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cerrar también la sesión de operario activa del aparato.
  await admin.from("sesion_operario").delete().eq("device_id", device_id);

  return NextResponse.json({ ok: true });
}
