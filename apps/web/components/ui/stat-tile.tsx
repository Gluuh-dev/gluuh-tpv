import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "brand" | "emerald" | "rose" | "amber" | "sky" | "default"

const iconTone: Record<Tone, string> = {
  default: "text-(--text-muted)",
  brand:   "text-brand",
  emerald: "text-emerald-500",
  rose:    "text-rose-500",
  amber:   "text-amber-500",
  sky:     "text-sky-500",
}

interface StatTileProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: string
  tone?: Tone
  className?: string
}

export function StatTile({
  label,
  value,
  icon,
  hint,
  tone = "default",
  className,
}: StatTileProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-(--text-muted)">
          {label}
        </span>
        {icon && (
          <span className={cn("flex items-center", iconTone[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <p className="mt-0.5 text-[11px] text-(--text-muted)">{hint}</p>
      )}
    </div>
  )
}
