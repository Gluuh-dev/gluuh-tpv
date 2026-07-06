import { cn } from "@/lib/utils";

/** Bloque de carga con pulso. Usa tokens (bg-surface-muted). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}

/** Esqueleto de tabla: N filas de altura fija dentro de una card. */
function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-surface p-3", className)} role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export { Skeleton, TableSkeleton };
