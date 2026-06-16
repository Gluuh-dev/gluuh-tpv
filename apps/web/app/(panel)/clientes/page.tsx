import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "client", titulo: "Clientes", singular: "cliente",
    descripcion: "Clientes para facturación y fidelización.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "nif", label: "NIF/CIF", placeholder: "B12345678" },
      { name: "email", label: "Email", type: "email" },
      { name: "telefono", label: "Teléfono", type: "tel" },
      { name: "notas", label: "Notas", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "nif", label: "NIF" }, { name: "email", label: "Email" }, { name: "telefono", label: "Teléfono" }],
  }} />;
}
