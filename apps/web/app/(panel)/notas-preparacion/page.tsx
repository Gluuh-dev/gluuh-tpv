import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "nota_preparacion", titulo: "Notas de preparación", singular: "nota de preparación",
    descripcion: "Notas de preparación que se envían a cocina junto con los pedidos.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
