"use client";

// Barra de estado inferior del panel (estilo VS Code/Linear): empresa a la
// izquierda; a la derecha, aviso de licencia (si caduca pronto o caducó,
// guía 15 §9) y entorno fiscal. Slim, discreta, siempre visible.
import Link from "next/link";
import { Building2, Dot, KeyRound } from "lucide-react";

// ponytail: VERIFACTU vive en MODO PRUEBA hasta el final (última cosa antes de
// vender). Espejo del estado de /configuracion-verifactu; cuando exista el
// toggle real de entorno, leer de ahí en vez de esta constante.
const MODO_FISCAL: { label: string; produccion: boolean } = { label: "VERIFACTU · pruebas", produccion: false };

export function StatusBar({ empresa, licenciaHasta }: Readonly<{ empresa?: string; licenciaHasta?: string | null }>) {
  // Chip de licencia solo cuando requiere atención: ámbar <30 días, rojo caducada.
  let lic: { txt: string; cls: string } | null = null;
  if (licenciaHasta) {
    const dias = Math.floor((new Date(licenciaHasta).getTime() - Date.now()) / 86_400_000);
    if (dias < 0) lic = { txt: "Licencia caducada", cls: "text-destructive" };
    else if (dias <= 30) lic = { txt: `Licencia: ${dias} días`, cls: "text-amber-500" };
  }
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-[11px] text-(--text-muted)">
      <span className="flex min-w-0 items-center gap-1.5">
        <Building2 className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{empresa || "Mi empresa"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {lic && (
          <Link href="/acerca-de" className={`flex items-center gap-1 font-medium hover:underline ${lic.cls}`} title="Ver licencia">
            <KeyRound className="h-3 w-3" aria-hidden />{lic.txt}
          </Link>
        )}
        <span className="flex items-center gap-1">
          <Dot className={`h-4 w-4 ${MODO_FISCAL.produccion ? "text-success" : "text-amber-500"}`} aria-hidden />
          <span className={MODO_FISCAL.produccion ? "text-success" : "text-amber-500"}>{MODO_FISCAL.label}</span>
        </span>
      </span>
    </footer>
  );
}
