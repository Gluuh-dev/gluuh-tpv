"use client";
import { supabaseBrowser } from "./supabaseBrowser";

// Configuración por ámbito (ver supabase/migrations/0023_setting.sql).
// La resolución aplica precedencia DEVICE > LOCAL > GLOBAL.
export type SettingScope = "GLOBAL" | "LOCAL" | "DEVICE";

export interface SettingTarget {
  /** Local/centro de venta (para ámbito LOCAL o como contexto al resolver). */
  locationId?: string | null;
  /** Terminal (para ámbito DEVICE o como contexto al resolver). */
  deviceId?: string | null;
}

/**
 * Lee un ajuste resolviendo por precedencia DEVICE > LOCAL > GLOBAL.
 * Devuelve `null` si no existe en ningún ámbito.
 */
export async function getSetting<T = unknown>(
  key: string,
  target: SettingTarget = {},
): Promise<T | null> {
  const { data, error } = await supabaseBrowser().rpc("setting_get", {
    p_key: key,
    p_location_id: target.locationId ?? null,
    p_device_id: target.deviceId ?? null,
  });
  if (error) throw error;
  return (data ?? null) as T | null;
}

/**
 * Crea o actualiza un ajuste en el ámbito indicado.
 * - GLOBAL: no requiere target.
 * - LOCAL: requiere `locationId`.
 * - DEVICE: requiere `deviceId`.
 */
export async function setSetting<T = unknown>(
  scope: SettingScope,
  key: string,
  value: T,
  target: SettingTarget = {},
): Promise<void> {
  if (scope === "LOCAL" && !target.locationId)
    throw new Error("setSetting LOCAL requiere locationId");
  if (scope === "DEVICE" && !target.deviceId)
    throw new Error("setSetting DEVICE requiere deviceId");

  const { error } = await supabaseBrowser().rpc("setting_set", {
    p_scope: scope,
    p_key: key,
    p_value: value as unknown,
    p_location_id: target.locationId ?? null,
    p_device_id: target.deviceId ?? null,
  });
  if (error) throw error;
}
