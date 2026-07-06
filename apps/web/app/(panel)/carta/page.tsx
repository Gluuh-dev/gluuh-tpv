import { redirect } from "next/navigation";

// La carta combinada se dividió en páginas propias (Ágora): /familias · /categorias
// · /productos. Esta ruta antigua redirige a Productos para no duplicar.
export default function CartaRedirect() {
  redirect("/productos");
}
