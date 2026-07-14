// Sistema de módulos: catálogo estático en código + activación en BD
// (tabla tenant_module, migración 0035). Sin fila = activo por defecto.
// Diseño: docs/implementacion/04-modulos-y-emparejado.md.
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabaseBrowser";

export interface DefModulo {
  nombre: string;
  descripcion: string;
  /** Ruta de la pantalla (null = funcionalidad transversal). */
  ruta: string | null;
  /** No se puede desactivar (el TPV). */
  siempre?: boolean;
  /** Aún no disponible: se muestra pero no se puede activar. */
  proximamente?: boolean;
  /** Módulo premium: solo usable con licencia vigente que lo incluya (0052). */
  requiereLicencia?: true;
}

export const MODULOS = {
  TPV:        { nombre: "TPV",                    descripcion: "Pantalla de venta principal.", ruta: "/tpv", siempre: true },
  COMANDERA:  { nombre: "Comandera móvil",        descripcion: "Toma de comandas desde el móvil del camarero.", ruta: "/comandera" },
  COCINA:     { nombre: "Cocina (KDS)",           descripcion: "Monitor de comandas en cocina/barra, en tiempo real.", ruta: "/cocina" },
  PANTALLA:   { nombre: "Pantalla de recogida",   descripcion: "\"En preparación / listos\" para el cliente (fast-food).", ruta: "/pantalla" },
  VISOR:      { nombre: "Visor de cliente",       descripcion: "Segunda pantalla del TPV con el ticket en curso.", ruta: "/visor" },
  KIOSKO:     { nombre: "Kiosko de autopedido",   descripcion: "El cliente pide y paga solo, con tu marca.", ruta: "/kiosko", requiereLicencia: true },
  CARTELERIA: { nombre: "Cartelería digital",     descripcion: "Ofertas y promociones rotando en cualquier tele.", ruta: "/ofertas" },
  RESERVAS:   { nombre: "Reservas",               descripcion: "Reservas de mesa desde el TPV y el plano.", ruta: null },
  PAGOS:      { nombre: "Pagos integrados",       descripcion: "Datáfono y QR (Stripe/Bizum).", ruta: null, proximamente: true, requiereLicencia: true },
  QR_MESA:    { nombre: "Pedido por QR en mesa",  descripcion: "Carta y pedido desde el móvil del cliente.", ruta: null, proximamente: true, requiereLicencia: true },
  DELIVERY:   { nombre: "Delivery",               descripcion: "Glovo, Uber Eats y Just Eat en tu TPV.", ruta: null, proximamente: true, requiereLicencia: true },
  API:        { nombre: "Conexiones API",         descripcion: "Claves API y webhooks para integraciones.", ruta: null, proximamente: true, requiereLicencia: true },
  STOCK:      { nombre: "Compras y stock",        descripcion: "Proveedores, albaranes e inventario.", ruta: null, proximamente: true, requiereLicencia: true },
} as const satisfies Record<string, DefModulo>;

export type Modulo = keyof typeof MODULOS;

/** Ruta a la que salta un dispositivo emparejado según su módulo. */
export const RUTA_MODULO: Record<string, string> = Object.fromEntries(
  Object.entries(MODULOS).flatMap(([clave, def]) => (def.ruta ? [[clave, def.ruta]] : [])),
);

// ── Configuración por módulo (columna tenant_module.config, jsonb) ─────────
// Contrato de claves por módulo; las pantallas mezclan lo guardado sobre
// estos defectos, así funcionan igual sin fila de config.

export type ConfigCocina = {
  estacionDefecto: "COCINA" | "BARRA" | "CAMARERO" | "TODAS";
  tema: "oscuro" | "claro";
  avisoMin: number;
  criticoMin: number;
  sonido: boolean;
}
export type ConfigPantalla = {
  tituloPreparando: string;
  tituloListos: string;
  incluirBarra: boolean;
}
export type ConfigCarteleria = {
  segundosPorOferta: number;
}
export type ConfigVisor = {
  mensajeReposo: string;
  mensajeGracias: string;
}
/** Plantillas de diseño del kiosko (inspiradas en kioskos de comida rápida). */
export const DISENOS_KIOSKO = ["marca", "claro", "calido", "oscuro"] as const;
export type DisenoKiosko = (typeof DISENOS_KIOSKO)[number];

export type ConfigKiosko = {
  pedirNombre: boolean;
  mostrarPrecios: boolean;
  textoAqui: string;
  textoLlevar: string;
  textoConfirmacion: string;
  /** Plantilla visual; "marca" = portada a color de marca pleno (la original). */
  diseno?: DisenoKiosko;
  /** Fondo personalizado (hex); "" = automático según el diseño. */
  colorFondo?: string;
}

export const CONFIG_COCINA_DEF: ConfigCocina = {
  estacionDefecto: "COCINA", tema: "oscuro", avisoMin: 10, criticoMin: 20, sonido: true,
};
export const CONFIG_PANTALLA_DEF: ConfigPantalla = {
  tituloPreparando: "En preparación", tituloListos: "Listos para recoger", incluirBarra: false,
};
export const CONFIG_CARTELERIA_DEF: ConfigCarteleria = { segundosPorOferta: 6 };
export const CONFIG_VISOR_DEF: ConfigVisor = {
  mensajeReposo: "¡Bienvenido!", mensajeGracias: "GRACIAS POR SU VISITA",
};
export const CONFIG_KIOSKO_DEF: ConfigKiosko = {
  pedirNombre: false, mostrarPrecios: true, textoAqui: "Comer aquí",
  textoLlevar: "Para llevar", textoConfirmacion: "Recógelo cuando aparezca en pantalla",
  diseno: "marca", colorFondo: "",
};

/** Mezcla la config guardada sobre los defectos, ignorando claves de tipo incorrecto. */
export function configCon<T extends Record<string, unknown>>(
  defectos: T,
  guardada: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...defectos };
  for (const k of Object.keys(defectos)) {
    if (k in guardada && typeof guardada[k] === typeof defectos[k]) out[k] = guardada[k];
  }
  return out as T;
}

/** Config guardada del módulo ({} si no hay fila, la tabla no existe o falla la red). */
export async function leerConfigModulo(
  sb: SupabaseClient,
  modulo: Modulo,
): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await sb
      .from("tenant_module")
      .select("config")
      .eq("modulo", modulo)
      .maybeSingle();
    if (error || !data?.config || typeof data.config !== "object") return {};
    return data.config as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Guarda la config del módulo. Upsert SOLO de la columna config: PostgREST
 * actualiza únicamente las columnas enviadas, así que si la fila existe su
 * `activo` se conserva; si no existe, se crea con el default (activo).
 */
export async function guardarConfigModulo(
  sb: SupabaseClient,
  tenantId: string,
  modulo: Modulo,
  config: Record<string, unknown>,
): Promise<{ error: string | null }> {
  // Sin `updated_at`: lo pone la base de datos (trigger `set_updated_at`). Antes iba el
  // reloj DEL NAVEGADOR, y de esa fecha depende ahora quién gana al sincronizar el bar
  // con la nube — un portátil con la hora atrasada dejaría al bar sin ver el cambio.
  const { error } = await sb
    .from("tenant_module")
    .upsert({ tenant_id: tenantId, modulo, config }, { onConflict: "tenant_id,modulo" });
  return { error: error?.message ?? null };
}

// ── Licencia (0052) ─────────────────────────────────────────────────────────
// La licencia efectiva vive en la fila tenant (licencia_hasta + licencia_modulos).
// hasta == null → empresa SIN licencia registrada: NO se gatea por licencia (las
// empresas existentes siguen igual). Con licencia, un módulo premium solo cuenta
// como activo si la licencia está vigente Y lo incluye.

const hoyISO = () => new Date().toISOString().slice(0, 10);

/** ¿La licencia está en vigor? (hay fecha de caducidad y no ha pasado). */
export function licenciaVigente(hasta: string | null): boolean {
  return hasta != null && hasta >= hoyISO();
}

/**
 * Estado de licencia del tenant. {hasta:null, modulos:[]} si no hay licencia
 * registrada, la columna no existe (migración sin aplicar) o falla la red:
 * en todos esos casos se degrada a "sin gating por licencia".
 */
export async function leerLicencia(
  sb: SupabaseClient,
): Promise<{ hasta: string | null; modulos: string[] }> {
  try {
    const { data, error } = await sb
      .from("tenant")
      .select("licencia_hasta, licencia_modulos")
      .limit(1)
      .maybeSingle();
    if (error || !data) return { hasta: null, modulos: [] };
    return {
      hasta: (data.licencia_hasta as string | null) ?? null,
      modulos: Array.isArray(data.licencia_modulos) ? (data.licencia_modulos as string[]) : [],
    };
  } catch {
    return { hasta: null, modulos: [] };
  }
}

/**
 * Módulos inactivos = desactivados a mano (tenant_module.activo=false) ∪
 * premium sin licencia. Solo se gatea por licencia si hay licencia registrada
 * (hasta != null); el interruptor manual sigue mandando por encima.
 */
export async function modulosInactivos(): Promise<Set<string>> {
  const sb = supabaseBrowser();
  const [{ data }, lic] = await Promise.all([
    sb.from("tenant_module").select("modulo, activo").eq("activo", false),
    leerLicencia(sb),
  ]);
  const off = new Set((data ?? []).map((f: { modulo: string }) => f.modulo));
  if (lic.hasta != null) {
    const vigente = licenciaVigente(lic.hasta);
    for (const [clave, def] of Object.entries(MODULOS)) {
      if ((def as DefModulo).requiereLicencia && (!vigente || !lic.modulos.includes(clave))) {
        off.add(clave);
      }
    }
  }
  return off;
}

/**
 * true/false cuando se sabe; null mientras carga (renderizar optimista).
 * Si la tabla no existe aún (migración sin aplicar), todo cuenta como activo.
 */
export function useModuloActivo(modulo: Modulo): boolean | null {
  const [activo, setActivo] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    modulosInactivos()
      .then((off) => { if (vivo) setActivo(!off.has(modulo)); })
      .catch(() => { if (vivo) setActivo(true); });
    return () => { vivo = false; };
  }, [modulo]);
  return activo;
}
