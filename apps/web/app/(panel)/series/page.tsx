import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "invoice_series", titulo: "Series de facturación", singular: "serie",
    descripcion: "Series para numerar facturas y tickets (F, FA, devoluciones…).",
    fields: [
      { name: "nombre", label: "Nombre", required: true, placeholder: "Facturas" },
      { name: "prefijo", label: "Prefijo", placeholder: "F" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "prefijo", label: "Prefijo" }],
  }} />;
}
