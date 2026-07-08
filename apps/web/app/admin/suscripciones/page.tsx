"use client";

// Suscripciones (consola de plataforma, Fase 4). Panel de plan/módulos/caducidad
// por empresa. De momento, la renovación vive en Empresas (Aplicar a la empresa);
// aquí irá la vista consolidada de suscripciones.
import { CreditCard } from "lucide-react";

export default function Suscripciones() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted"><CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden /></div>
        <h1 className="mt-3 text-lg font-semibold">Suscripciones</h1>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
          Vista por empresa de su plan, módulos contratados y caducidad. En construcción.
          Mientras tanto, renueva desde <strong>Empresas → Generar licencia → Aplicar a la empresa</strong>.
        </p>
      </div>
    </div>
  );
}
