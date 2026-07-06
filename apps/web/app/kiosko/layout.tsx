"use client";
import { ModuloGuard } from "@/components/modulo-guard";

export default function KioskoLayout({ children }: { children: React.ReactNode }) {
  return <ModuloGuard modulo="KIOSKO">{children}</ModuloGuard>;
}
