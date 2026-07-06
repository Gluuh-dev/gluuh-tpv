"use client"; // el render de la columna «color» es una función: la página debe ser cliente.

import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "etiqueta_producto", titulo: "Etiquetas de productos", singular: "etiqueta",
    descripcion: "Etiquetas para clasificar y filtrar productos en el catálogo.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "color", label: "Color" },
    ],
    columns: [
      { name: "nombre", label: "Nombre" },
      {
        name: "color", label: "Color",
        render: (r) => r.color
          ? <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ background: String(r.color) }} />
              <span className="font-mono text-[12px]">{String(r.color)}</span>
            </span>
          : <span className="text-(--text-muted)">—</span>,
      },
    ],
  }} />;
}
