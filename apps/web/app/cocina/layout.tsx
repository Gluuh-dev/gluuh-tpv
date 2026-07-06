"use client";
import { ModuloGuard } from "@/components/modulo-guard";

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  return <ModuloGuard modulo="COCINA">{children}</ModuloGuard>;
}
