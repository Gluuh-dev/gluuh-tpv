// Copia de seguridad local: la web (con su sesión) genera los CSV y el main
// los escribe en la carpeta/USB elegida. Retención: últimas 30 copias.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const PREFIJO = "gluuh-backup-";
const RETENCION = 30;

export interface FicheroBackup {
  nombre: string;
  /** Texto (CSV/JSON) o, si base64=true, contenido binario en base64 (imágenes). */
  contenido: string;
  base64?: boolean;
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
      // Se permite una subcarpeta (p. ej. "imagenes/x.jpg") pero cada segmento se
      // sanea con basename() para que nada pueda escapar de la carpeta de backup.
      const rel = f.nombre.split(/[\\/]/).map((s) => path.basename(s)).filter(Boolean).join(path.sep);
      const destinoFichero = path.join(carpeta, rel);
      mkdirSync(path.dirname(destinoFichero), { recursive: true });
      if (f.base64) writeFileSync(destinoFichero, Buffer.from(f.contenido, "base64"));
      else writeFileSync(destinoFichero, f.contenido, "utf8");
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
  const pad = (n: number) => String(n).padStart(2, "0");
  return setInterval(() => {
    const hora = obtenerHora();
    if (!hora) return;
    const ahora = new Date();
    // Fecha y hora en horario LOCAL: mezclar día UTC con hora local disparaba el
    // backup dos veces en las horas de madrugada (España es UTC+1/+2).
    const hoy = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
    const hhmm = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
    if (hhmm >= hora && ultimoDia !== hoy) {
      ultimoDia = hoy;
      accion();
    }
  }, 60_000);
}
