"use client"

import React, { useId, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface FieldBaseProps {
  label?: string
  hint?: string
  error?: string
}

type TextFieldProps = FieldBaseProps & React.ComponentProps<"input">
type TextAreaProps = FieldBaseProps & React.ComponentProps<"textarea">

const controlBase =
  "w-full bg-(--input-bg) border rounded-md px-2.5 text-[13px] text-foreground placeholder:text-(--text-muted) outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand/30"
const controlError = "border-rose-500/60 focus:border-rose-500"
const controlNormal = "border-border"

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, className, id: idProp, ...rest }, ref) => {
    const autoId = useId()
    const id = idProp ?? (label ? autoId : undefined)

    return (
      <div className={cn("flex flex-col", className)}>
        {label && (
          <label
            htmlFor={id}
            className="block mb-1 text-[10px] uppercase tracking-wider font-semibold text-(--text-muted)"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            controlBase,
            "h-8",
            error ? controlError : controlNormal,
          )}
          {...rest}
        />
        {error ? (
          <p className="mt-1 text-[11px] text-rose-500">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-[11px] text-(--text-muted)">{hint}</p>
        ) : null}
      </div>
    )
  },
)
TextField.displayName = "TextField"

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, hint, error, className, id: idProp, ...rest }, ref) => {
    const autoId = useId()
    const id = idProp ?? (label ? autoId : undefined)

    return (
      <div className={cn("flex flex-col", className)}>
        {label && (
          <label
            htmlFor={id}
            className="block mb-1 text-[10px] uppercase tracking-wider font-semibold text-(--text-muted)"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={cn(
            controlBase,
            "min-h-20 py-2 resize-y",
            error ? controlError : controlNormal,
          )}
          {...rest}
        />
        {error ? (
          <p className="mt-1 text-[11px] text-rose-500">{error}</p>
        ) : hint ? (
          <p className="mt-1 text-[11px] text-(--text-muted)">{hint}</p>
        ) : null}
      </div>
    )
  },
)
TextArea.displayName = "TextArea"
