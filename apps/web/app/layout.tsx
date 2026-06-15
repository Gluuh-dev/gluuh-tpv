import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Gluuh TPV",
  description: "TPV de hostelería — gestión, comandas y cocina",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
