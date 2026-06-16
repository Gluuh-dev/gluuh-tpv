"use client";

import { usePathname } from "next/navigation";
import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

function humanize(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const withSpaces = last.replace(/-/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export default function Page() {
  const pathname = usePathname();
  const title = humanize(pathname);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-[20px] font-semibold">{title}</h1>
      <EmptyState
        icon={<Hammer className="h-8 w-8" />}
        title="En preparación"
        description="Esta sección estará disponible próximamente."
      />
    </div>
  );
}