import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { GluuhContractDatabase, GluuhSupabaseClient, TablaPublica } from "@gluuh/supabase";
import { randomInt } from "node:crypto";
import { territorioDesdeDireccion } from "@gluuh/core";
import { PERFILES_RECOMENDADOS } from "@/app/lib/permisos";
import { hostPlataforma, mfaPlataformaInsuficiente } from "@/app/lib/plataforma";
import { clonarCatalogo, clonarTabla } from "@/app/lib/clonar-plantilla";

// Grupos que se pueden importar de la plantilla al alta, y su tabla/acción.
// (0127: se retiró el grupo "tickets" — `plantilla_ticket` nunca tuvo una fila;
// el diseño del ticket vive en `setting` clave `impresion.config.ticket`.)
const TABLA_GRUPO: Partial<Record<string, TablaPublica>> = { impuestos: "tax_rate", formas_pago: "payment_method" };

// Alta de empresa COMPLETA en un paso. SOLO el técnico de Gluuh (es_admin_plataforma).
// Decisiones guía 15 §12: el cliente NO tiene email de login — se le genera un
// USUARIO (del nombre, editable) + password inicial aleatoria con CAMBIO
// OBLIGATORIO en el primer login (metadata debe_cambiar_password). El alta
// también fija licencia (módulos+duración), genera el CÓDIGO DE INSTALACIÓN
// único (0000-0000-00000-0000-0000), la clave técnica, y siembra usuarios y
// catálogo de ejemplo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legible sin ambiguos (0/O, 1/l/I): clave técnica y password inicial.
const ALFABETO_CLAVE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const legible = (n: number) => Array.from({ length: n }, () => ALFABETO_CLAVE[randomInt(ALFABETO_CLAVE.length)]).join("");

// Código de instalación: dígitos aleatorios (CSPRNG) en grupos 4-4-5-4-4.
const dig = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");
const generarCodigoInstalacion = () => `${dig(4)}-${dig(4)}-${dig(5)}-${dig(4)}-${dig(4)}`;

// Usuario de acceso del cliente: minúsculas, sin acentos, solo a-z0-9
// ("Bar Pepe" → "barpepe"). Único a nivel de plataforma.
const normalizarUsuario = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Cuenta interna de Supabase Auth de la empresa (el cliente nunca ve este email;
// entra tecleando solo su usuario). Dominio distinto del de operarios (@codigo.*).
const emailCuenta = (usr: string) => `${usr}@cuentas.gluuh.local`;

// Quita claves sin valor (para updates parciales).
const conValor = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

type Admin = GluuhSupabaseClient;

// Aprovisionamiento tras el alta, una vez existe el tenant. Best-effort deliberado:
// la empresa queda creada aunque falle una pieza (se puede rehacer desde /admin).
async function aprovisionar(admin: Admin, tid: string, datos: {
  cif?: string; direccion?: string; poblacion?: string; provincia?: string;
  codigoPostal?: string; telefono?: string; emailContacto?: string; meses?: unknown; modulos?: unknown;
  importar?: unknown;
}): Promise<{ codigoInstalacion: string | null; claveTecnica: string | null }> {
  // Código de instalación único (reintento ante la remotísima colisión).
  let codigoInstalacion: string | null = null;
  for (let i = 0; i < 3 && !codigoInstalacion; i++) {
    const cod = generarCodigoInstalacion();
    const { error } = await admin.from("tenant").update({ codigo_instalacion: cod }).eq("id", tid);
    if (!error) codigoInstalacion = cod;
  }

  // Licencia (duración + módulos) y datos fiscales/dirección.
  const meses = Number.isInteger(datos.meses) && (datos.meses as number) > 0 ? (datos.meses as number) : null;
  const hasta = meses ? (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString().slice(0, 10); })() : null;
  const mods = Array.isArray(datos.modulos) ? datos.modulos.filter((m: unknown) => typeof m === "string") : [];
  // email_admin = email de CONTACTO (avisos de caducidad), no de login. El
  // trigger lo dejó con el email sintético; se sobrescribe si se indicó uno real.
  await admin.from("tenant").update(conValor({ cif: datos.cif, email_admin: datos.emailContacto, licencia_hasta: hasta, licencia_modulos: hasta ? mods : null })).eq("id", tid);
  // El TERRITORIO FISCAL se deduce de la dirección (CP → provincia; si no, el
  // nombre de la provincia). El trigger 0078 deja PENINSULA_BALEARES a fuego, y
  // asumirlo es el fallo caro: un bar canario facturaría al 21 % en vez de al
  // 7 % de IGIC sin dar ningún error. Fuera de España devuelve null → no se toca.
  const territorio = territorioDesdeDireccion({ codigoPostal: datos.codigoPostal, provincia: datos.provincia });
  const loc = conValor({
    direccion: datos.direccion, poblacion: datos.poblacion, provincia: datos.provincia,
    codigo_postal: datos.codigoPostal, telefono: datos.telefono, cif: datos.cif,
    territorio_fiscal: territorio,
  });
  if (Object.keys(loc).length) await admin.from("location").update(loc).eq("tenant_id", tid);

  // Clave técnica de la "Zona técnica" (RPC 0045); se devuelve UNA VEZ.
  let claveTecnica: string | null = legible(8);
  const { error: eClave } = await admin.rpc("admin_establecer_clave_tecnica", { p_tenant: tid, p_clave: claveTecnica });
  if (eClave) claveTecnica = null; // la clave se podrá fijar después

  // Siempre: perfiles recomendados. Los OPERARIOS ya NO se siembran (F4.4, plan
  // docs/plan/14): tecnico/1212, admin/1111, camarero/2222… eran credenciales
  // CONOCIDAS iguales en todos los clientes. El personal se da de alta desde el
  // panel (Usuarios y PIN) o por invitación; el PIN temporal se ve una vez.
  await admin.from("perfil").insert(
    PERFILES_RECOMENDADOS.map((r) => ({ tenant_id: tid, nombre: r.nombre, descripcion: r.descripcion, permisos: r.permisos })),
  );
  await admin.rpc("admin_sembrar_ejemplo", { p_tenant: tid });

  // Clonado desde la PLANTILLA BASE de lo marcado en el alta.
  const grupos = Array.isArray(datos.importar) ? datos.importar.filter((g): g is string => typeof g === "string") : [];
  await clonarDesdePlantilla(admin, tid, grupos, territorio);

  // Formas de pago por defecto (Efectivo/Tarjeta/Bizum), SIEMPRE — como semilla, no de la
  // plantilla (0106). Va después del clonado y es idempotente: si el admin marcó "importar
  // formas de pago", respeta las importadas; si no, siembra las de defecto. Sin esto, un bar
  // recién creado no puede cobrar (la pantalla de cobro sin métodos).
  await admin.rpc("admin_sembrar_formas_pago", { p_tenant: tid });

  // La semilla de terminal por defecto (0107, tpv1/121212) está RETIRADA: dependía de la
  // credencial por terminal de 0105 (diseño rechazado, plan docs/plan/14) y su RPC en la
  // nube referencia columnas inexistentes — fallaba siempre y el error se descartaba.
  // El alta vigente de terminales es el código efímero de emparejado (/conectar).

  return { codigoInstalacion, claveTecnica };
}

// Clona de la plantilla base (tenant es_plantilla) los grupos marcados: carta,
// impuestos, formas de pago, tickets. Best-effort por grupo: un fallo no aborta
// el alta (la empresa queda creada aunque falte un grupo).
async function clonarDesdePlantilla(admin: Admin, tid: string, grupos: string[], territorio?: string | null): Promise<void> {
  if (!grupos.length) return;
  const { data: pl } = await admin.from("tenant").select("id").eq("es_plantilla", true).maybeSingle();
  const origen = (pl as { id: string } | null)?.id;
  if (!origen || origen === tid) return;
  for (const g of grupos) {
    try {
      // El catálogo se clona recalculando el % al territorio del destino: la
      // plantilla puede ser de otro territorio que el bar que se da de alta.
      if (g === "catalogo") await clonarCatalogo(admin, origen, tid, territorio);
      else {
        const tabla = TABLA_GRUPO[g];
        if (tabla) await clonarTabla(admin, tabla, origen, tid);
      }
    } catch { /* grupo omitido; la empresa queda igualmente creada */ }
  }
}

export async function POST(req: Request) {
  if (!hostPlataforma(req.headers.get("host"))) return new NextResponse(null, { status: 404 });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (mfaPlataformaInsuficiente(token)) return NextResponse.json({ error: "Esta acción requiere verificación en dos pasos (MFA)" }, { status: 403 });
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const caller = createClient<GluuhContractDatabase>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: esAdmin, error: e1 } = await caller.rpc("es_admin_plataforma");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!esAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { empresa, usuario, emailContacto, cif, direccion, poblacion, provincia, codigoPostal, telefono, meses, modulos, importar } = await req.json();
  if (!empresa) return NextResponse.json({ error: "Falta el nombre de la empresa" }, { status: 400 });
  const usr = normalizarUsuario(String(usuario || empresa));
  if (usr.length < 3) return NextResponse.json({ error: "El usuario debe tener al menos 3 letras o números" }, { status: 400 });

  const admin = createClient<GluuhContractDatabase>(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const passwordInicial = legible(10);
  const { data, error } = await admin.auth.admin.createUser({
    email: emailCuenta(usr),
    password: passwordInicial,
    email_confirm: true,
    // empresa_nombre dispara el aprovisionamiento del trigger (0078);
    // debe_cambiar_password fuerza el cambio en el primer login.
    user_metadata: { empresa_nombre: empresa, nombre: usr, debe_cambiar_password: true },
  });
  if (error) {
    const duplicado = /already|registered|exists/i.test(error.message);
    return NextResponse.json(
      { error: duplicado ? `El usuario «${usr}» ya existe: elige otro.` : error.message },
      { status: duplicado ? 409 : 400 },
    );
  }

  const { data: au } = await admin
    .from("app_user")
    .select("tenant_id")
    .eq("auth_user_id", data.user?.id ?? "")
    .maybeSingle();
  if (!au?.tenant_id) {
    return NextResponse.json({ ok: true, usuario: usr, passwordInicial, claveTecnica: null, codigoInstalacion: null });
  }

  const { codigoInstalacion, claveTecnica } = await aprovisionar(admin, au.tenant_id as string, {
    cif, direccion, poblacion, provincia, codigoPostal, telefono, emailContacto, meses, modulos, importar,
  });
  return NextResponse.json({ ok: true, usuario: usr, passwordInicial, claveTecnica, codigoInstalacion });
}
