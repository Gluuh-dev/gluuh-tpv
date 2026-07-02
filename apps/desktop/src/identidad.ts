// Identidad del dispositivo: credencial obtenida al emparejar en /conectar.
// Se persiste en userData/device.json; si no existe, la app funciona sin
// vincular (login web normal) y puede vincularse más tarde desde /conectar.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface Identidad {
  device_id: string;
  nombre: string;
  modulo: string;
  token: string;
}

function ruta(userData: string): string {
  return path.join(userData, "device.json");
}

export function leerIdentidad(userData: string): Identidad | null {
  try {
    return JSON.parse(readFileSync(ruta(userData), "utf8")) as Identidad;
  } catch {
    return null;
  }
}

export function guardarIdentidad(userData: string, identidad: Identidad): void {
  writeFileSync(ruta(userData), JSON.stringify(identidad, null, 2), "utf8");
}
