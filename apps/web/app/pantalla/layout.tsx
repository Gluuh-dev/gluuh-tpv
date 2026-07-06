"use client";
import { ModuloGuard } from "@/components/modulo-guard";

export default function PantallaLayout({ children }: { children: React.ReactNode }) {
  return <ModuloGuard modulo="PANTALLA">{children}</ModuloGuard>;
}
