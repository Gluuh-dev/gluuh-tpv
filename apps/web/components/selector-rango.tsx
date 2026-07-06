"use client";

// Selector de rango de fechas compartido por los informes del panel.
// Acota las consultas para no descargar todo el histórico: PostgREST corta
// en 1000 filas por defecto de forma silenciosa y los totales salían incompletos.
// ponytail: agregación en el cliente acotada por rango+límite; cuando haya
// volumen real, la mejora siguiente es agregar en SQL (vistas/RPC con GROUP BY).

export type Rango = "7d" | "30d" | "90d" | "año";

export const RANGO_DEFECTO: Rango = "30d";

/** Límite explícito de filas por consulta de informe. */
export const LIMITE_INFORME = 10_000;

const OPCIONES: { k: Rango; label: string }[] = [
  { k: "7d", label: "7 días" },
  { k: "30d", label: "30 días" },
  { k: "90d", label: "90 días" },
  { k: "año", label: "Este año" },
];

/** ISO del inicio del rango, para `.gte("created_at", fechaDesde(rango))`. */
export function fechaDesde(r: Rango): string {
  const d = new Date();
  if (r === "año") return new Date(d.getFullYear(), 0, 1).toISOString();
  const dias = r === "7d" ? 7 : r === "30d" ? 30 : 90;
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

export function SelectorRango({ valor, onCambio }: { valor: Rango; onCambio: (r: Rango) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPCIONES.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onCambio(o.k)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            valor === o.k
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Aviso ámbar cuando la consulta devuelve exactamente LIMITE_INFORME filas. */
export function AvisoTruncado({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
      Resultados truncados ({LIMITE_INFORME.toLocaleString("es-ES")} filas) — reduce el rango de fechas para ver totales completos.
    </div>
  );
}
