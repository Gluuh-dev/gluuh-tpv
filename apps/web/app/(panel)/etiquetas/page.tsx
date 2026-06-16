import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "etiqueta_producto", titulo: "Etiquetas de productos", singular: "etiqueta",
    descripcion: "Etiquetas para clasificar y filtrar productos en el catálogo.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "color", label: "Color" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "color", label: "Color" }],
  }} />;
}
