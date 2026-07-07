"use client";

// Barra de estado inferior del panel (estilo VS Code/Linear): empresa a la
// izquierda, entorno fiscal a la derecha. Slim, discreta, siempre visible.
import { Building2, Dot } from "lucide-react";

// ponytail: VERIFACTU vive en MODO PRUEBA hasta el final (última cosa antes de
// vender). Espejo del estado de /configuracion-verifactu; cuando exista el
// toggle real de entorno, leer de ahí en vez de esta constante.
const MODO_FISCAL: { label: string; produccion: boolean } = { label: "VERIFACTU · pruebas", produccion: false };

export function StatusBar({ empresa }: Readonly<{ empresa?: string }>) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-(--text-muted)">
      <span className="flex min-w-0 items-center gap-1.5">
        <Building2 className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{empresa || "Mi empresa"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Dot className={`h-4 w-4 ${MODO_FISCAL.produccion ? "text-success" : "text-amber-500"}`} aria-hidden />
        <span className={MODO_FISCAL.produccion ? "text-success" : "text-amber-500"}>{MODO_FISCAL.label}</span>
      </span>
    </footer>
  );
}
