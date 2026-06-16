import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "plantilla_etiqueta", titulo: "Plantillas de etiquetas", singular: "plantilla de etiqueta",
    descripcion: "Plantillas de etiquetas para productos e impresión.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
