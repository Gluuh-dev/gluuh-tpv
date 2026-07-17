import type { Metadata } from "next";
import type { ReactNode } from "react";

// La ventana del panel del servidor (Edge en modo --app, acceso directo
// "Servidor Gluuh") toma su título y su icono del <head> de ESTA ruta. Sin
// esto heredaba el "Gluuh TPV" global y el icono de Edge — y el dueño veía
// "Gluuh TPV" en una ventana que es el SERVIDOR.
export const metadata: Metadata = {
  title: "Gluuh Servidor",
  icons: { icon: "/servidor/icon.png", apple: "/servidor/icon.png" },
};

export default function ServidorLayout({ children }: { children: ReactNode }) {
  return children;
}
