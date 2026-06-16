"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AppToaster } from "@/components/app-toaster";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}
