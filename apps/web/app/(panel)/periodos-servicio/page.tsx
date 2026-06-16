import { CrudPage } from "@/components/crud-page";

export default function Page() {
  return <CrudPage config={{
    table: "periodo_servicio", titulo: "Periodos de servicio", singular: "periodo",
    descripcion: "Periodos de servicio que definen los turnos del local.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "hora_inicio", label: "Hora inicio" },
      { name: "hora_fin", label: "Hora fin" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "hora_inicio", label: "Hora inicio" }, { name: "hora_fin", label: "Hora fin" }],
  }} />;
}
