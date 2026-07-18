import type { Metadata } from "next";
import type { ReactNode } from "react";

// La ventana del panel del servidor (Edge en modo --app, acceso directo
// "Servidor Gluuh") toma su título y su icono del <head> de ESTA ruta. Sin
// esto heredaba el "Gluuh TPV" global y el icono de Edge — y el dueño veía
// "Gluuh TPV" en una ventana que es el SERVIDOR. (El icono lo inyecta Next
// solo, por la convención `app/servidor/icon.png` — no se declara aquí.)
// El manifest le da a la ventana --app identidad de APLICACIÓN (nombre e
// iconos cuadrados): sin él, la barra de tareas enseña el icono de Edge.
export const metadata: Metadata = {
  title: "Gluuh Servidor",
  manifest: "/manifest-servidor.webmanifest",
};

export default function ServidorLayout({ children }: { children: ReactNode }) {
  return children;
}
