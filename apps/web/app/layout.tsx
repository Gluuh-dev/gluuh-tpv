import "./globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Gluuh TPV",
  description: "TPV de hostelería — gestión, comandas y cocina",
};

// ─────────────────────────────────────────────────────────────────────────────
//  LA CONFIGURACIÓN DEL NODO **NO** SE INYECTA AQUÍ. Y costó descubrir por qué.
//
//  La idea era: el layout lee `process.env.NODO_LOCAL` en el servidor y mete un
//  `<script>` con los datos del bar. Limpio y evidente… y NO FUNCIONA.
//
//  Casi todas las pantallas (incluido `/tpv`) son ESTÁTICAS: Next las prerenderiza **al
//  compilar**, cuando esa variable ni existe. El script se horneaba vacío y el TPV se
//  quedaba sin configuración — sirviendo la web perfectamente, eso sí, y sin un error en
//  ningún log.
//
//  La inyección la hace el GATEWAY del nodo (`apps/nodo/gateway.mjs`): mete el script en
//  el `<head>` del HTML al vuelo, según pasa. Da igual que la página sea estática o
//  dinámica, y la web se compila UNA vez para todos los bares.
//
//  En la nube no pasa nada de esto: allí las `NEXT_PUBLIC_*` de siempre.
//  Ver `app/lib/config.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
