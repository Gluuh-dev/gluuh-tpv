import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "customer_type", titulo: "Tipos de clientes", singular: "tipo",
    descripcion: "Categorías de cliente (habitual, empresa, VIP…).",
    fields: [
      { name: "nombre", label: "Nombre", required: true, placeholder: "Empresa" },
      { name: "descripcion", label: "Descripción", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "descripcion", label: "Descripción" }],
  }} />;
}
