import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { NAV } from "@/app/lib/nav";
import { PageHeader } from "@/components/ui/page-header";

// Página principal de una sección: rejilla con sus apartados y opciones (estilo Ágora).
export function SectionIndex({ id }: { id: string }) {
  const entry = NAV.find((e) => e.id === id);
  if (!entry) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={entry.title} description="Elige una opción para gestionar." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entry.sections.map((sec, si) => (
          <div key={si} className="rounded-lg border border-border bg-card p-4">
            {sec.title && <div className="mb-2 border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{sec.title}</div>}
            <div className="space-y-0.5">
              {sec.items.map((i, ii) => {
                if (!i.href) return (
                  <div key={ii} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground/50">
                    {i.label}<span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">pronto</span>
                  </div>
                );
                const cls = "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-foreground";
                return i.blank
                  ? <a key={ii} href={i.href} target="_blank" rel="noreferrer" className={cls}>{i.label}<ExternalLink className="h-3.5 w-3.5 opacity-50" /></a>
                  : <Link key={ii} href={i.href} className={cls}>{i.label}</Link>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
