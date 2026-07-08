import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { hostPlataforma } from "../lib/plataforma";

// Guard de superficie (server): /admin solo existe en admin.gluuh.com. En
// cualquier otro host → 404 (la app del cliente, el nodo local y los equipos
// instalados nunca exponen la zona de Gluuh). Sustituye al middleware proxy.ts.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  if (!hostPlataforma(h.get("host"))) notFound();
  return children;
}
