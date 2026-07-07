// Configuración local del terminal (userData/config.json).
// ponytail: fichero editable a mano hasta que exista la pantalla de ajustes
// del dispositivo; entonces esta config migra a `setting` ámbito DEVICE.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ConfigImpresora } from "@gluuh/hardware";

export interface ConfigTerminal {
  /** URL/IP base del servidor de la web (p. ej. "http://192.168.1.10:3100").
   *  Se pide al instalar y es editable en Configuración. Sin ella se usa la env
   *  GLUUH_URL o, en su defecto, http://localhost:3100. */
  servidor?: string;
  /** Impresora ESC/POS; sin ella la impresión cae a window.print() en la web. */
  impresora?: ConfigImpresora;
  backup?: {
    /** Hora local "HH:MM" del volcado diario. */
    hora?: string;
    /** Carpeta/USB de destino. Sin destino no hay backup automático. */
    destino?: string;
  };
}

function ruta(userData: string): string {
  return path.join(userData, "config.json");
}

export function leerConfig(userData: string): ConfigTerminal {
  try {
    return JSON.parse(readFileSync(ruta(userData), "utf8")) as ConfigTerminal;
  } catch {
    return {};
  }
}

/** Escribe config.json (lo edita la sección de Configuración vía window.gluuh). */
export function guardarConfig(userData: string, cfg: ConfigTerminal): void {
  writeFileSync(ruta(userData), JSON.stringify(cfg, null, 2), "utf8");
}
