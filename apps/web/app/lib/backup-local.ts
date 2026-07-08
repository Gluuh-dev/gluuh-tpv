// Copia de seguridad local: la web (con su sesión Supabase) exporta las tablas
// del tenant a CSV y Gluuh Desktop las escribe en la carpeta/USB configurada.
// Se dispara desde el evento "backup" del escritorio (volcado nocturno) o a mano.
import { supabaseBrowser } from "./supabaseBrowser";
import { setSetting } from "./settings";

// ponytail: lista fija de tablas operativas; se amplía cuando haga falta.
const TABLAS = [
  "family", "category", "product", "menu", "menu_group", "menu_choice",
  "room", "restaurant_table", "sales_order", "order_line", "payment",
  "invoice", "cash_session", "cash_move", "customer", "reservation",
] as const;

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

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
  const ficheros: { nombre: string; contenido: string; base64?: boolean }[] = [];
  const incompletas: string[] = [];
  for (const tabla of TABLAS) {
    // Paginar en bloques de 1000 (límite por defecto de PostgREST).
    const filas: Record<string, unknown>[] = [];
    let completa = true;
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await sb.from(tabla).select("*").range(desde, desde + 999);
      if (error) { completa = false; break; } // fallo a mitad: CSV parcial, no fiable
      filas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    if (!completa) incompletas.push(tabla);
    ficheros.push({ nombre: `${tabla}.csv`, contenido: aCsv(filas) });
  }
  // Imágenes de producto a la subcarpeta "imagenes/". Si una no se puede
  // descargar (URL caída), se omite sin abortar el resto del backup.
  const { data: conFoto } = await sb.from("product").select("id,foto_url").not("foto_url", "is", null);
  for (const p of (conFoto ?? []) as { id: string; foto_url: string }[]) {
    try {
      const resp = await fetch(p.foto_url);
      if (!resp.ok) continue;
      const b64 = await blobABase64(await resp.blob());
      const ext = (p.foto_url.split("?")[0]!.split(".").pop() || "jpg").slice(0, 4);
      ficheros.push({ nombre: `imagenes/${p.id}.${ext}`, contenido: b64, base64: true });
    } catch { /* imagen no accesible: se omite */ }
  }

  // El manifest registra qué tablas quedaron incompletas: una copia con omisiones
  // silenciosas es peor que ninguna (al restaurar faltarían datos sin avisar).
  ficheros.push({
    nombre: "manifest.json",
    contenido: JSON.stringify({ fecha: new Date().toISOString(), tablas: TABLAS, incompletas, formato: "csv;" }, null, 2),
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const res = await gluuh.guardarBackup(`gluuh-backup-${hoy}`, ficheros);
  if (res.ok && incompletas.length) {
    return { ok: false, ruta: res.ruta, error: `Copia incompleta: ${incompletas.join(", ")}` };
  }
  // Registrar la última copia OK para mostrarla en el panel (D2). Best-effort:
  // si falla el setting, la copia igualmente se hizo.
  if (res.ok) {
    try {
      await setSetting("GLOBAL", "backup.ultima", { fecha: new Date().toISOString(), ruta: res.ruta ?? "" });
    } catch { /* el estado se registra la próxima vez */ }
  }
  return res;
}
