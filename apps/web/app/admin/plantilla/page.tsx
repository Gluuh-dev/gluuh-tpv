"use client";

// Plantilla base (consola de plataforma, Fases 2-3). Lo que se le crea a CADA
// empresa nueva: usuarios, familias, productos, tickets, impuestos… Se editará
// como un backoffice normal (un "tenant plantilla") y, al dar de alta una
// empresa, se marcará qué clonar. En construcción.
import { LayoutTemplate } from "lucide-react";

export default function Plantilla() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted"><LayoutTemplate className="h-5 w-5 text-muted-foreground" aria-hidden /></div>
        <h1 className="mt-3 text-lg font-semibold">Plantilla base</h1>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
          Aquí definirás lo que se crea por defecto en cada empresa nueva
          (usuarios, familias, productos, tickets, impuestos…). Se editará como un
          backoffice y, al crear una empresa, marcarás qué importar. En construcción.
        </p>
      </div>
    </div>
  );
}
