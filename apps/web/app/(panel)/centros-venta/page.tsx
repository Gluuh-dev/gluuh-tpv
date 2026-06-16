import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "sales_center", titulo: "Centros de venta", singular: "centro",
    descripcion: "Puntos/zonas de venta para informes (barra, terraza, eventos…).",
    fields: [
      { name: "nombre", label: "Nombre", required: true, placeholder: "Barra" },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
