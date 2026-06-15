import "./globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Gluuh TPV",
  description: "TPV de hostelería — gestión, comandas y cocina",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={cn("font-sans", inter.variable)}>
      <body>{children}</body>
    </html>
  );
}
