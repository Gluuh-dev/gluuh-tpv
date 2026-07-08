"use client";

// Consola de plataforma: tipo del resumen de empresas (RPC admin_resumen_empresas,
// 0083) y estado de suscripción compartido por la lista, la ficha y Suscripciones.
export interface ResumenEmpresa {
  id: string;
  slug: string | null;   // URL de la ficha (/admin/empresas/bar-demo); null si falta la 0089
  nombre: string;
  cif: string | null;
  email_admin: string | null;
  plan: string;
  codigo_instalacion: string | null;
  es_plantilla: boolean;
  activo: boolean;
  licencia_limites: { dispositivos?: number; usuarios?: number } | null;
  licencia_hasta: string | null;
  licencia_modulos: string[];
  created_at: string;
  ciclo_pago: string | null;
  forma_pago: string | null;
  precio_periodo: number | null;
  proximo_pago: string | null;
  precio_calculado: number;
  n_productos: number;
  n_usuarios: number;
  n_dispositivos: number;
  n_dispositivos_online: number;
}

export type EstadoSub = { variant: "success" | "warning" | "destructive" | "secondary"; texto: string; dias: number | null };

// Estado de la suscripción: activa (verde) · caduca pronto <30 días (ámbar) ·
// caducada (rojo) · sin licencia (neutro).
export function estadoSuscripcion(hasta: string | null): EstadoSub {
  if (!hasta) return { variant: "secondary", texto: "Sin licencia", dias: null };
  const dias = Math.floor((new Date(hasta).getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return { variant: "destructive", texto: "Caducada", dias };
  if (dias <= 30) return { variant: "warning", texto: `Caduca en ${dias} d`, dias };
  return { variant: "success", texto: "Activa", dias };
}

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// La ficha se enlaza por slug (URL legible); UUID como fallback pre-0089.
export const urlEmpresa = (e: Pick<ResumenEmpresa, "id" | "slug">) => `/admin/empresas/${e.slug ?? e.id}`;

// Resuelve el parámetro de la URL (slug o UUID) contra el resumen ya cargado.
export const buscarEmpresa = (lista: ResumenEmpresa[], param: string) =>
  lista.find((e) => e.slug === param || e.id === param) ?? null;

// Acción de soporte sobre una empresa (POST /api/admin/empresa) con el mensaje
// de resultado ya formateado. Compartida por la ficha y la pestaña Suscripción.
export async function accionEmpresa(tenantId: string, accion: string, extra?: Record<string, unknown>): Promise<{ ok: boolean; msg: string }> {
  const { supabaseBrowser } = await import("./supabaseBrowser");
  const { data: { session } } = await supabaseBrowser().auth.getSession();
  const res = await fetch("/api/admin/empresa", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ accion, tenantId, ...extra }),
  });
  const out = await res.json();
  if (!res.ok) return { ok: false, msg: out.error ?? "Error" };
  if (out.passwordInicial) return { ok: true, msg: `Nueva password (apúntala): ${out.passwordInicial}` };
  if (out.codigoInstalacion) return { ok: true, msg: `Nuevo código de instalación: ${out.codigoInstalacion}` };
  if (out.licenciaHasta) return { ok: true, msg: `Licencia renovada hasta ${fechaCorta(out.licenciaHasta)}` };
  return { ok: true, msg: "Hecho." };
}
