"use client";
import { ModuloGuard } from "@/components/modulo-guard";

export default function ComanderaLayout({ children }: { children: React.ReactNode }) {
  return <ModuloGuard modulo="COMANDERA">{children}</ModuloGuard>;
}
