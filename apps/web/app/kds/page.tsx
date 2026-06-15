import { redirect } from "next/navigation";

// El KDS de demostración se ha unificado con la cocina real (autenticada y
// por empresa). Mantenemos /kds como alias hacia /cocina.
export default function KDSRedirect() {
  redirect("/cocina");
}
