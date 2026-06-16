import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "unit_of_measure", titulo: "Unidades de medida", singular: "unidad",
    descripcion: "Unidades para productos y compras (kg, l, ud…).",
    fields: [
      { name: "nombre", label: "Nombre", required: true, placeholder: "Kilogramo" },
      { name: "abreviatura", label: "Abreviatura", placeholder: "kg" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "abreviatura", label: "Abreviatura" }],
  }} />;
}
