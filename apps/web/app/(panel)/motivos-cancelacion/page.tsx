import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "cancel_reason", titulo: "Motivos de cancelación", singular: "motivo",
    descripcion: "Motivos para anular líneas o tickets (error, devolución, cortesía…).",
    fields: [
      { name: "nombre", label: "Motivo", required: true, placeholder: "Error de comanda" },
    ],
    columns: [{ name: "nombre", label: "Motivo" }],
  }} />;
}
