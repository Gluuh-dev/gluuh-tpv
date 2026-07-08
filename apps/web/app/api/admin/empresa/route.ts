import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { hostPlataforma } from "@/app/lib/plataforma";

// Gestión de una empresa ya creada. SOLO el técnico de Gluuh (es_admin_plataforma).
// Acciones de soporte remoto (sin tocar la BD a mano): resetear la password del
// cliente (sin email, el rescate lo hace Gluuh), renovar la licencia y regenerar
// el código de instalación si se ha filtrado.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const legible = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const dig = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");
const generarCodigoInstalacion = () => `${dig(4)}-${dig(4)}-${dig(5)}-${dig(4)}-${dig(4)}`;

const conValor = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));
const MESES_CICLO: Record<string, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 };
const sumarMeses = (desde: Date, n: number) => { const d = new Date(desde); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

// La cuenta de EMPRESA de un tenant: el app_user con email (sintético
// @cuentas.gluuh.local) y auth_user_id — los operarios tienen email null.
async function cuentaEmpresa(admin: SupabaseClient, tid: string): Promise<string | null> {
  const { data } = await admin
    .from("app_user")
    .select("auth_user_id")
    .eq("tenant_id", tid)
    .not("auth_user_id", "is", null)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  return (data as { auth_user_id: string } | null)?.auth_user_id ?? null;
}

async function resetPassword(admin: SupabaseClient, tid: string) {
  const authId = await cuentaEmpresa(admin, tid);
  if (!authId) return NextResponse.json({ error: "Esta empresa no tiene cuenta de acceso con contraseña." }, { status: 404 });
  const nueva = legible(10);
  const { data: u } = await admin.auth.admin.getUserById(authId);
  const meta = { ...(u.user?.user_metadata ?? {}), debe_cambiar_password: true };
  const { error } = await admin.auth.admin.updateUserById(authId, { password: nueva, user_metadata: meta });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, passwordInicial: nueva });
}

async function renovarLicencia(admin: SupabaseClient, tid: string, meses: unknown, modulos: unknown) {
  const m = Number(meses);
  if (!Number.isInteger(m) || m <= 0) return NextResponse.json({ error: "Duración no válida" }, { status: 400 });
  const d = new Date(); d.setMonth(d.getMonth() + m);
  const hasta = d.toISOString().slice(0, 10);
  const mods = Array.isArray(modulos) ? modulos.filter((x: unknown) => typeof x === "string") : [];
  const { error } = await admin.from("tenant").update({ licencia_hasta: hasta, licencia_modulos: mods }).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, licenciaHasta: hasta });
}

async function regenerarCodigo(admin: SupabaseClient, tid: string) {
  for (let i = 0; i < 3; i++) {
    const cod = generarCodigoInstalacion();
    const { error } = await admin.from("tenant").update({ codigo_instalacion: cod }).eq("id", tid);
    if (!error) return NextResponse.json({ ok: true, codigoInstalacion: cod });
  }
  return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
}

// Suspender / reactivar (tenant.activo). Suspendida = no entran operarios ni se
// activan instalaciones nuevas (RLS/login lo comprueban).
async function suspender(admin: SupabaseClient, tid: string, activo: unknown) {
  const { error } = await admin.from("tenant").update({ activo: !!activo }).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, activo: !!activo });
}

// Límites de la empresa (licencia_limites jsonb). 0/vacío = sin límite.
async function limites(admin: SupabaseClient, tid: string, dispositivos: unknown, usuarios: unknown) {
  const lim: { dispositivos?: number; usuarios?: number } = {};
  if (Number.isInteger(dispositivos) && (dispositivos as number) > 0) lim.dispositivos = dispositivos as number;
  if (Number.isInteger(usuarios) && (usuarios as number) > 0) lim.usuarios = usuarios as number;
  const { error } = await admin.from("tenant").update({ licencia_limites: Object.keys(lim).length ? lim : null }).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Editar datos de la empresa (tenant + su local).
async function editar(admin: SupabaseClient, tid: string, d: Record<string, unknown>) {
  const t = conValor({ nombre: d.nombre, cif: d.cif, email_admin: d.emailContacto });
  if (Object.keys(t).length) await admin.from("tenant").update(t).eq("id", tid);
  const l = conValor({ direccion: d.direccion, poblacion: d.poblacion, provincia: d.provincia, codigo_postal: d.codigoPostal, telefono: d.telefono, cif: d.cif });
  if (Object.keys(l).length) await admin.from("location").update(l).eq("tenant_id", tid);
  return NextResponse.json({ ok: true });
}

// Configuración de pago (ciclo, forma, precio, próximo pago).
async function configPago(admin: SupabaseClient, tid: string, d: Record<string, unknown>) {
  const precio = Number(d.precio);
  const { error } = await admin.from("tenant").update({
    ciclo_pago: (d.ciclo as string) || null,
    forma_pago: (d.forma as string) || null,
    precio_periodo: Number.isFinite(precio) && precio > 0 ? precio : null,
    proximo_pago: (d.proximo as string) || null,
  }).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Registrar un pago recibido de la empresa y avanzar el próximo pago según el ciclo.
async function registrarPago(admin: SupabaseClient, tid: string, d: Record<string, unknown>) {
  const importe = Number(d.importe);
  if (!Number.isFinite(importe) || importe <= 0) return NextResponse.json({ error: "Importe no válido" }, { status: 400 });
  const { data: t } = await admin.from("tenant").select("ciclo_pago, proximo_pago").eq("id", tid).maybeSingle();
  const ciclo = (t as { ciclo_pago?: string } | null)?.ciclo_pago ?? null;
  const desde = (t as { proximo_pago?: string } | null)?.proximo_pago ?? new Date().toISOString().slice(0, 10);
  const n = ciclo ? (MESES_CICLO[ciclo] ?? 1) : 1;
  const hasta = sumarMeses(new Date(desde), n);
  const { error } = await admin.from("pago_gluuh").insert({
    tenant_id: tid, importe, concepto: (d.concepto as string) || null, metodo: (d.metodo as string) || null,
    periodo_desde: desde, periodo_hasta: hasta,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Avanza el próximo pago al fin del periodo cubierto.
  await admin.from("tenant").update({ proximo_pago: hasta }).eq("id", tid);
  return NextResponse.json({ ok: true, proximoPago: hasta });
}

export async function POST(req: Request) {
  if (!hostPlataforma(req.headers.get("host"))) return new NextResponse(null, { status: 404 });
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

  const body = await req.json().catch(() => ({}));
  const { accion, tenantId, meses, modulos, activo, dispositivos, usuarios } = body;
  if (!tenantId) return NextResponse.json({ error: "Falta la empresa" }, { status: 400 });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  switch (accion) {
    case "reset-password": return resetPassword(admin, tenantId);
    case "renovar-licencia": return renovarLicencia(admin, tenantId, meses, modulos);
    case "regenerar-codigo": return regenerarCodigo(admin, tenantId);
    case "suspender": return suspender(admin, tenantId, activo);
    case "limites": return limites(admin, tenantId, dispositivos, usuarios);
    case "editar": return editar(admin, tenantId, body);
    case "config-pago": return configPago(admin, tenantId, body);
    case "registrar-pago": return registrarPago(admin, tenantId, body);
    default: return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  }
}
