"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Minus,
  ChevronsRight,
  Sidebar,
  PanelRight,
  MessageSquare,
  Maximize2,
  Expand,
  Check,
} from "lucide-react";
import { type SlideMode } from "@/lib/assistant-store";
import { cn } from "@/lib/utils";

/* ─── Manija de redimensión (solo modo push) ──────────────────────────── */
function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Arrastra para redimensionar"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const x0 = e.clientX;
        const move = (ev: PointerEvent) => onDrag(x0 - ev.clientX);
        const up = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      }}
      className="absolute inset-y-0 left-0 z-20 w-2.5 -translate-x-1/2 cursor-ew-resize flex justify-center group/rz"
    >
      <span className="h-full w-px bg-transparent group-hover/rz:bg-foreground/40 transition-colors" />
    </div>
  );
}

/* ─── Datos de los 5 modos ────────────────────────────────────────────── */
const MODE_OPTIONS: { id: SlideMode; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "push",    label: "Barra lateral (empuja)",  Icon: Sidebar },
  { id: "overlay", label: "Lateral flotante",         Icon: PanelRight },
  { id: "corner",  label: "Esquina flotante",         Icon: MessageSquare },
  { id: "center",  label: "Modal centrado",           Icon: Maximize2 },
  { id: "full",    label: "Pantalla completa",        Icon: Expand },
];

/* ─── Menú de modos (popover propio) ─────────────────────────────────── */
function ModeMenu({
  current,
  onChange,
}: {
  current: SlideMode;
  onChange: (m: SlideMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const CurrentIcon = MODE_OPTIONS.find((m) => m.id === current)?.Icon ?? Sidebar;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Cambiar modo de visualización"
        aria-label="Cambiar modo de visualización"
        className="w-7 h-7 rounded grid place-items-center text-foreground/80 hover:text-foreground hover:bg-surface-overlay cursor-pointer transition-colors"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-[100] bg-surface-overlay border border-border p-1 rounded-xl shadow-xl min-w-[200px]">
          {MODE_OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { onChange(id); setOpen(false); }}
              className={cn(
                "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                id === current
                  ? "bg-surface-muted text-foreground"
                  : "text-(--text-secondary) hover:bg-surface-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 text-(--text-muted)" />
              <span className="flex-1 text-left">{label}</span>
              {id === current && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Props ───────────────────────────────────────────────────────────── */
export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  mode: SlideMode;
  onModeChange: (m: SlideMode) => void;
  width: number;
  onWidth: (w: number) => void;
  title: string;
  children: ReactNode;
}

/* ─── SlideOver principal ─────────────────────────────────────────────── */
export function SlideOver({
  open,
  onClose,
  mode,
  onModeChange,
  width,
  onWidth,
  title,
  children,
}: SlideOverProps) {
  /* Bloquear scroll del body solo en center/full */
  useEffect(() => {
    if (open && (mode === "center" || mode === "full")) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, mode]);

  /* Cerrar con Esc */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  /* Botón de cerrar: icono según modo */
  const CloseIcon = mode === "push" || mode === "overlay" ? ChevronsRight : Minus;
  const closeLabel =
    mode === "push" || mode === "overlay" ? "Contraer panel" : "Minimizar panel";

  /* ── Cabecera compartida ─────────────────────────────────────────── */
  const Header = (
    <div className="h-11 px-3 border-b border-border flex items-center gap-1.5 shrink-0">
      <span className="text-[13px] font-semibold flex-1 truncate">{title}</span>
      <ModeMenu current={mode} onChange={onModeChange} />
      <button
        onClick={onClose}
        title={closeLabel}
        aria-label={closeLabel}
        className="w-7 h-7 rounded grid place-items-center text-foreground/80 hover:text-foreground hover:bg-surface-overlay cursor-pointer transition-colors"
      >
        {mode === "push" || mode === "overlay" ? (
          <ChevronsRight className="w-4 h-4" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </button>
    </div>
  );

  /* ── PUSH ─────────────────────────────────────────────────────────── */
  if (mode === "push") {
    return (
      <div
        style={{ width: `${width}px` }}
        className="fixed inset-y-0 right-0 z-40 bg-surface border-l border-border flex flex-col transition-all duration-200 ease-out"
      >
        <ResizeHandle
          onDrag={(dx) => {
            const newW = Math.round(Math.max(360, Math.min(Math.min(1000, window.innerWidth - 160), width + dx)));
            onWidth(newW);
          }}
        />
        {Header}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    );
  }

  /* ── OVERLAY ──────────────────────────────────────────────────────── */
  if (mode === "overlay") {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          style={{ width: `${width}px` }}
          className="fixed inset-y-0 right-0 z-50 bg-surface border-l border-border flex flex-col transition-all duration-200 ease-out"
        >
          {Header}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </>
    );
  }

  /* ── CORNER ───────────────────────────────────────────────────────── */
  if (mode === "corner") {
    return (
      <div className="fixed bottom-20 right-5 z-50 w-[440px] h-[680px] max-h-[calc(100vh-7rem)] rounded-2xl border border-border shadow-2xl bg-surface flex flex-col transition-all duration-200 ease-out">
        {Header}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    );
  }

  /* ── CENTER ───────────────────────────────────────────────────────── */
  if (mode === "center") {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="fixed inset-0 z-50 grid place-items-center pointer-events-none">
          <div className="pointer-events-auto h-[85vh] w-full max-w-2xl rounded-xl border border-border shadow-2xl bg-surface flex flex-col transition-all duration-200 ease-out">
            {Header}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      </>
    );
  }

  /* ── FULL ─────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col transition-all duration-200 ease-out">
      {Header}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto h-full">{children}</div>
      </div>
    </div>
  );
}
