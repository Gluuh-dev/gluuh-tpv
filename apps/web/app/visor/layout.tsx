"use client";
import { ModuloGuard } from "@/components/modulo-guard";

export default function VisorLayout({ children }: { children: React.ReactNode }) {
  return <ModuloGuard modulo="VISOR">{children}</ModuloGuard>;
}
