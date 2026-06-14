import type { ReactNode } from "react";

export const metadata = {
  title: "Gluppo TPV",
  description: "Backoffice y TPV de hostelería",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
