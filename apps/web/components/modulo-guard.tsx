"use client";

// Envuelve una pantalla de módulo: si la empresa lo tiene desactivado,
// muestra el aviso en vez del contenido. Render optimista mientras carga.
import Link from "next/link";
import { MODULOS, useModuloActivo, type Modulo } from "../app/lib/modulos";

export function ModuloGuard({ modulo, children }: { modulo: Modulo; children: React.ReactNode }) {
  const activo = useModuloActivo(modulo);

  if (activo === false) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Módulo no activado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            «{MODULOS[modulo].nombre}» está desactivado para tu empresa.
            Actívalo en Configuración → Módulos.
          </p>
          <Link href="/modulos" className="btn-primary mt-5 inline-block">Ir a Módulos</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
