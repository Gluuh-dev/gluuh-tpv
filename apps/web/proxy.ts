import { NextResponse, type NextRequest } from "next/server";

// Separación de superficies (guía 15, decisión 07-07): la zona de PLATAFORMA
// (/admin y /api/admin — crear empresas, licencias) solo se sirve en los hosts
// de plataforma (admin.gluuh.com). En cualquier otro host la ruta NO EXISTE
// (404) aunque se conozca: la app del cliente (app.gluuh.com, nodo local del
// restaurante, equipo instalado) nunca expone la zona de Gluuh. En desarrollo
// se permite (localhost:3100/admin) para poder trabajar.
const HOSTS_PLATAFORMA = (process.env.PLATAFORMA_HOSTS ?? "admin.gluuh.com")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export default function proxy(req: NextRequest) {
  const host = ((req.headers.get("host") ?? "").split(":")[0] ?? "").toLowerCase();
  const permitido = HOSTS_PLATAFORMA.includes(host) || process.env.NODE_ENV === "development";
  if (!permitido) return new NextResponse(null, { status: 404 });
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
