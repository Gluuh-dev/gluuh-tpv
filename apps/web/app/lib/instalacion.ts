"use client";

// Instalación fijada a una empresa (0078): al activar el código de instalación
// (lo genera Gluuh en el alta) el equipo guarda { tenantId, empresa } y desde
// entonces el login es solo usuario+clave de ESA empresa. Cambiar de empresa
// exige otro código válido — que solo tiene el técnico.
export interface Instalacion { tenantId: string; empresa: string }

const KEY = "gluuh:instalacion";

export function leerInstalacion(): Instalacion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<Instalacion>;
    return j.tenantId && j.empresa ? { tenantId: j.tenantId, empresa: j.empresa } : null;
  } catch {
    return null;
  }
}

export function guardarInstalacion(i: Instalacion): void {
  try { localStorage.setItem(KEY, JSON.stringify(i)); } catch { /* sin almacenamiento */ }
}
