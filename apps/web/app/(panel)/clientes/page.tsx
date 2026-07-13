import { CrudPage } from "@/components/crud-page";

// Tabla `customer` (no `client`): es la que enlazan `sales_order.customer_id` y
// `reservation.customer_id`. La antigua `client` era huérfana —nada la ataba a una
// venta— y se unificó aquí en la migración 0099.
export default function Page() {
  return <CrudPage config={{
    table: "customer", titulo: "Clientes", singular: "cliente",
    descripcion: "Clientes para facturación y fidelización. Con NIF, el TPV les emite factura completa.",
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "nif", label: "NIF/CIF (para factura completa)", placeholder: "B12345678" },
      { name: "email", label: "Email", type: "email" },
      { name: "telefono", label: "Teléfono", type: "tel" },
      { name: "direccion", label: "Dirección", placeholder: "C/ Mayor, 1" },
      { name: "codigo_postal", label: "Código postal", placeholder: "38001" },
      { name: "poblacion", label: "Población" },
      { name: "provincia", label: "Provincia" },
      { name: "notas", label: "Notas", type: "textarea" },
    ],
    columns: [{ name: "nombre", label: "Nombre" }, { name: "nif", label: "NIF" }, { name: "email", label: "Email" }, { name: "telefono", label: "Teléfono" }],
  }} />;
}
