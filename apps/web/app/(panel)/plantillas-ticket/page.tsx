import { redirect } from "next/navigation";

// El diseño del ticket vive en /configuracion-de-impresion (setting "impresion.config");
// el CRUD de plantilla_ticket era cosmético y nada lo leía.
export default function Page() {
  redirect("/configuracion-de-impresion");
}
