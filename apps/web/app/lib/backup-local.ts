// Copia de seguridad local: la web (con su sesión Supabase) exporta las tablas
// del tenant a CSV y Gluuh Desktop las escribe en la carpeta/USB configurada.
// Se dispara desde el evento "backup" del escritorio (volcado nocturno) o a mano.
import { supabaseBrowser } from "./supabaseBrowser";

// ponytail: lista fija de tablas operativas; se amplía cuando haga falta.
const TABLAS = [
  "family", "category", "product", "menu", "menu_group", "menu_choice",
  "room", "restaurant_table", "sales_order", "order_line", "payment",
  "invoice", "cash_session", "cash_move", "customer", "reservation",
] as const;

function aCsv(filas: Record<string, unknown>[]): string {
  if (!filas.length) return "";
  const cols = Object.keys(filas[0]!);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(";"), ...filas.map((f) => cols.map((c) => esc(f[c])).join(";"))].join("\n");
}

export async function exportarBackupLocal(): Promise<{ ok: boolean; ruta?: string; error?: string }> {
  const gluuh = window.gluuh;
  if (!gluuh) return { ok: false, error: "Solo disponible en Gluuh Desktop" };

  const sb = supabaseBrowser();
  const ficheros: { nombre: string; contenido: string }[] = [];
  for (const tabla of TABLAS) {
    // Paginar en bloques de 1000 (límite por defecto de PostgREST).
    const filas: Record<string, unknown>[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await sb.from(tabla).select("*").range(desde, desde + 999);
      if (error) break; // tabla inaccesible: se omite, el backup sigue
      filas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    ficheros.push({ nombre: `${tabla}.csv`, contenido: aCsv(filas) });
  }
  ficheros.push({
    nombre: "manifest.json",
    contenido: JSON.stringify({ fecha: new Date().toISOString(), tablas: TABLAS, formato: "csv;" }, null, 2),
  });

  const hoy = new Date().toISOString().slice(0, 10);
  return gluuh.guardarBackup(`gluuh-backup-${hoy}`, ficheros);
}
