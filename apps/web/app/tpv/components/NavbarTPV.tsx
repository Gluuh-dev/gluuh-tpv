"use client";

// Navbar del TPV (morado, h-14): el MISMO de la pantalla Ticket, para que salón,
// terraza, aparcados, para llevar y reservas parezcan la misma app sin salir del
// TPV. Izquierda: logo. Centro: contenido contextual de cada vista (chips,
// contadores, leyenda…). Derecha: operario. Mismo grosor y color siempre.
import type { ReactNode } from "react";

const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

export function NavbarTPV({ operario, subtitulo, children }: Readonly<{
  operario?: string;
  subtitulo?: string;
  children?: ReactNode;
}>) {
  return (
    <header className="flex h-14 flex-none items-center gap-3 bg-brand px-3 text-brand-foreground">
      <div className="flex flex-none items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      <div className="flex flex-none items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-xs font-bold">{iniciales(operario ?? "")}</div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">{operario ?? "—"}</div>
          {subtitulo && <div className="text-[11px] opacity-70">{subtitulo}</div>}
        </div>
      </div>
    </header>
  );
}

/** Chip del navbar: etiqueta pequeña + valor (mismo estilo que Mesa/Pax del Ticket). */
export function NavChip({ label, children, onClick, title }: Readonly<{
  label?: string;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}>) {
  const cuerpo = (
    <>
      {label && <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>}
      <span className="text-sm font-semibold">{children}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title}
        className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 transition-colors hover:bg-white/25">
        {cuerpo}
      </button>
    );
  }
  return <span title={title} className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5">{cuerpo}</span>;
}
