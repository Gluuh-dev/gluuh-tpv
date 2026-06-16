import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "warehouse", titulo: "Almacenes", singular: "almacén",
    descripcion: "Almacenes para el control de stock.",
    fields: [
      { name: "nombre", label: "Nombre", required: true, placeholder: "Almacén principal" },
      { name: "direccion", label: "Dirección" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "direccion", label: "Dirección" }],
  }} />;
}
