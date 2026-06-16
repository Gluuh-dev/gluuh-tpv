import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "plantilla_comanda", titulo: "Plantillas de comandas", singular: "plantilla de comanda",
    descripcion: "Plantillas de comandas para impresión en cocina.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
