import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "tipo_preparacion", titulo: "Tipos de preparación", singular: "tipo de preparación",
    descripcion: "Tipos de preparación para clasificar cómo se elaboran los productos.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
