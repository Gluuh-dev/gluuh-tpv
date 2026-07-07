"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AppToaster } from "@/components/app-toaster";
import { PrintDispatcher } from "@/app/lib/print-dispatcher";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
      <AppToaster />
      {/* Despacho de impresión compartida (print_job): no-op salvo en Gluuh Desktop vinculado. */}
      <PrintDispatcher />
    </ThemeProvider>
  );
}
