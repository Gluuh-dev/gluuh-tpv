import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "punto_venta", titulo: "Puntos de venta", singular: "punto de venta",
    descripcion: "Puntos de venta o terminales configurados en el local.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
