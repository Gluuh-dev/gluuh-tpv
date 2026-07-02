// Configuración local del terminal (userData/config.json).
// ponytail: fichero editable a mano hasta que exista la pantalla de ajustes
// del dispositivo; entonces esta config migra a `setting` ámbito DEVICE.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ConfigImpresora } from "@gluuh/hardware";

export interface ConfigTerminal {
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

export function guardarConfig(userData: string, config: ConfigTerminal): void {
  writeFileSync(ruta(userData), JSON.stringify(config, null, 2), "utf8");
}
