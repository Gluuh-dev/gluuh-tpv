// Copia de seguridad local: la web (con su sesión) genera los CSV y el main
// los escribe en la carpeta/USB elegida. Retención: últimas 30 copias.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const PREFIJO = "gluuh-backup-";
const RETENCION = 30;

export interface FicheroBackup {
  nombre: string;
  contenido: string;
}

export function guardarBackupEnDisco(
  destino: string,
  nombreCarpeta: string,
  ficheros: FicheroBackup[],
): { ok: boolean; ruta?: string; error?: string } {
  try {
    if (!destino) return { ok: false, error: "Backup sin destino configurado (config.json → backup.destino)" };
    const carpeta = path.join(destino, nombreCarpeta.startsWith(PREFIJO) ? nombreCarpeta : PREFIJO + nombreCarpeta);
    mkdirSync(carpeta, { recursive: true });
    for (const f of ficheros) {
      // Solo el nombre base: nada de rutas relativas que escapen de la carpeta.
      writeFileSync(path.join(carpeta, path.basename(f.nombre)), f.contenido, "utf8");
    }
    // Retención: borrar las copias más antiguas (orden lexicográfico = cronológico).
    const copias = readdirSync(destino).filter((d) => d.startsWith(PREFIJO)).sort();
    for (const vieja of copias.slice(0, Math.max(0, copias.length - RETENCION))) {
      rmSync(path.join(destino, vieja), { recursive: true, force: true });
    }
    return { ok: true, ruta: carpeta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Devuelve true una vez al día cuando el reloj pasa por la hora configurada. */
export function crearPlanificadorDiario(obtenerHora: () => string | undefined, accion: () => void): NodeJS.Timeout {
  let ultimoDia = "";
  return setInterval(() => {
    const hora = obtenerHora();
    if (!hora) return;
    const ahora = new Date();
    const hoy = ahora.toISOString().slice(0, 10);
    const hhmm = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
    if (hhmm >= hora && ultimoDia !== hoy) {
      ultimoDia = hoy;
      accion();
    }
  }, 60_000);
}
