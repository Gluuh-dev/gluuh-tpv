"use client";
import { ModuloGuard } from "@/components/modulo-guard";

export default function OfertasLayout({ children }: { children: React.ReactNode }) {
  return <ModuloGuard modulo="CARTELERIA">{children}</ModuloGuard>;
}
