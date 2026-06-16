"use client";

// ponytail: sin backend de IA todavía; el panel es la pieza de diseño.

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";
import { SlideOver } from "@/components/ui/slide-over";
import { Textarea } from "@/components/ui/textarea";

/* ─── Cuerpo del asistente (placeholder funcional) ───────────────────── */
function AssistantBody() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    if (!value.trim()) return;
    // ponytail: sin backend de IA todavía; el panel es la pieza de diseño.
    setValue("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Estado vacío amistoso */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-brand/10 grid place-items-center">
          <Sparkles className="w-6 h-6 text-brand" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-foreground">¿En qué te ayudo?</p>
          <p className="text-[13px] text-(--text-muted) mt-1">
            Escribe tu pregunta o usa el campo de abajo.
          </p>
        </div>
      </div>

      {/* Input de chat estilo Notion */}
      <div className="rounded-2xl border border-border bg-surface px-3.5 pt-3 pb-2.5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/30 transition-all">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje…"
          className="border-0 bg-transparent p-0 text-[13px] resize-none min-h-[60px] focus-visible:ring-0 focus-visible:border-0 outline-none placeholder:text-(--text-muted)"
        />
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleSend}
            disabled={!value.trim()}
            title="Enviar mensaje"
            aria-label="Enviar mensaje"
            className="w-8 h-8 rounded-full bg-brand text-white grid place-items-center disabled:opacity-40 hover:bg-brand-hover transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel global del asistente ─────────────────────────────────────── */
export function AssistantPanel() {
  const { open, mode, width, toggle, setOpen, setMode, setWidth } = useAssistant();

  /* Empujar contenido en modo push */
  useEffect(() => {
    if (open && mode === "push") {
      document.body.style.marginRight = `${width}px`;
      document.body.style.transition = "margin-right 200ms ease-out";
    } else {
      document.body.style.marginRight = "";
      document.body.style.transition = "";
    }
    return () => {
      document.body.style.marginRight = "";
      document.body.style.transition = "";
    };
  }, [open, mode, width]);

  /* Atajo global Ctrl/Cmd+J */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <>
      {/* Lanzador flotante — visible solo cuando el panel está cerrado */}
      {!open && (
        <button
          onClick={toggle}
          title="Asistente (Ctrl+J)"
          aria-label="Asistente (Ctrl+J)"
          className="fixed bottom-20 right-5 z-40 w-12 h-12 rounded-full shadow-lg ring-1 ring-border bg-brand text-white grid place-items-center hover:bg-brand-hover transition-colors"
        >
          <Sparkles className="w-5 h-5" />
        </button>
      )}

      {/* Panel slide-over */}
      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        mode={mode}
        onModeChange={setMode}
        width={width}
        onWidth={setWidth}
        title="Asistente"
      >
        <AssistantBody />
      </SlideOver>
    </>
  );
}
