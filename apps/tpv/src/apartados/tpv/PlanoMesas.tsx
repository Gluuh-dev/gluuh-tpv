import { useState } from "react";
import { Home, Banknote, StickyNote, Split, MoveHorizontal, ChefHat, ReceiptText, Printer, DoorOpen, CreditCard } from "lucide-react";
import { eur } from "../../lib/dinero";
import { SALAS_DEMO, type Mesa } from "./datos";
import { RailSalas } from "./RailSalas";

function colorMesa(estado: Mesa["estado"], sel: boolean): string {
  if (sel) return "#3b82f6";
  if (estado === "OCUPADA") return "#f59e0b";
  if (estado === "POR_COBRAR") return "#eab308";
  return "#8a5a2b"; // LIBRE (madera)
}

function Leyenda({ color, children }: Readonly<{ color: string; children: React.ReactNode }>) {
  return <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/85"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {children}</span>;
}

function AccPie({ Icono, label, tono, onClick, disabled }: Readonly<{ Icono: typeof Home; label: string; tono?: "cobro" | "brand"; onClick?: () => void; disabled?: boolean }>) {
  const base = tono === "cobro" ? "bg-cobro text-white border-cobro-lit" : tono === "brand" ? "bg-brand text-white border-brand" : "bg-surface-2 text-muted-foreground border-border";
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-md border px-3 py-2 text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-40 ${base}`}><span className="flex items-center gap-1.5"><Icono size={15} /> {label}</span></button>;
}

// Vista de SALA (plano): cabecera (sala · ocupadas · leyenda) + suelo con las
// mesas + panel de previsualización de la mesa tocada + rail + barra de acciones.
// Fiel al TPV de Next (el suelo SVG con sprites llega en una fase posterior).
export function PlanoMesas({
  vista, onVista, onConfig, onAbrirMesa, onNuevaBarra, onInicio, operario,
}: Readonly<{
  vista: string; onVista: (v: string) => void; onConfig: () => void;
  onAbrirMesa: (m: Mesa) => void; onNuevaBarra: () => void; onInicio: () => void; operario: string;
}>) {
  const sala = SALAS_DEMO.find((s) => s.id === vista) ?? SALAS_DEMO[0]!;
  const ocup = sala.mesas.filter((m) => m.estado !== "LIBRE").length;
  const [sel, setSel] = useState<Mesa | null>(null);

  const tocarMesa = (m: Mesa) => {
    if (sel?.id === m.id || m.estado === "LIBRE") { onAbrirMesa(m); return; } // 2º toque / mesa libre → abrir
    setSel(m); // 1er toque → previsualizar
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Cabecera morada */}
      <header className="flex h-14 flex-none items-center gap-3 bg-brand px-3 text-white">
        <button type="button" onClick={onInicio} aria-label="Inicio" className="grid h-9 w-9 place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><Home size={18} /></button>
        <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto" draggable={false} />
        <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm"><span className="opacity-70">SALA</span> <b>{sala.nombre}</b></span>
        <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm"><span className="opacity-70">OCUPADAS</span> <b>{ocup}/{sala.mesas.length}</b></span>
        <div className="ml-3 flex items-center gap-3">
          <Leyenda color="#34d399">Libre</Leyenda><Leyenda color="#f59e0b">Ocupada</Leyenda><Leyenda color="#38bdf8">Reservada</Leyenda>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-xs font-bold">{operario.slice(0, 1).toUpperCase()}</span>
          <span className="hidden text-sm font-semibold sm:block">{operario}</span>
        </span>
      </header>

      {/* Cuerpo: suelo + preview + rail */}
      <div className="flex min-h-0 flex-1">
        {/* Suelo */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-auto p-6"
          style={{ backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--paper) 8%, transparent) 1px, transparent 1px)", backgroundSize: "26px 26px" }}>
          <div className="grid auto-rows-min content-start gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))" }}>
            {sala.mesas.map((m) => {
              const activa = sel?.id === m.id;
              const c = colorMesa(m.estado, activa);
              return (
                <button key={m.id} type="button" onClick={() => tocarMesa(m)}
                  className={`grid aspect-square place-items-center rounded-xl text-white transition-transform active:scale-95 ${activa ? "scale-105 ring-2 ring-brand" : ""}`}
                  style={{ background: c }}>
                  <span className="font-display text-xl font-extrabold [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">{m.nombre}</span>
                  {m.estado === "POR_COBRAR" && <span className="absolute mt-10 rounded bg-danger px-1 text-[9px] font-bold">CUENTA</span>}
                </button>
              );
            })}
            {sala.mesas.length === 0 && (
              <button type="button" onClick={onNuevaBarra} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-brand-lit/50 bg-brand/5 text-brand-lit transition-transform active:scale-95">Nueva</button>
            )}
          </div>
        </div>

        {/* Panel de previsualización */}
        <aside className="flex w-[320px] flex-none flex-col border-l border-border bg-card">
          <div className="space-y-3 p-5 text-sm">
            {[["MESA", sel?.nombre ?? "—"], ["APERTURA", sel?.abiertaMin != null ? `hace ${sel.abiertaMin}′` : "—"], ["COMENSALES", sel?.comensales ?? "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</span><span className="font-semibold text-foreground">{v}</span></div>
            ))}
            <div className="flex justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">IMPORTE</span><span className="font-display text-lg font-bold text-cobro tabular-nums">{eur(sel?.total ?? 0)}</span></div>
          </div>
          {!sel && <p className="mt-auto p-6 text-center text-sm text-muted-foreground">Toca una mesa para ver su cuenta.<br />Toca de nuevo para abrirla.</p>}
          {sel && <button type="button" onClick={() => onAbrirMesa(sel)} className="mx-5 mb-5 mt-auto rounded-xl bg-brand py-3 font-bold text-white transition-transform active:scale-95">Abrir {sel.nombre}</button>}
        </aside>

        {/* Rail de salas */}
        <RailSalas vista={vista} onVista={onVista} onConfig={onConfig} />
      </div>

      {/* Barra de acciones */}
      <footer className="no-scrollbar flex flex-none items-center gap-2 overflow-x-auto border-t border-border bg-surface px-3 py-2">
        <AccPie Icono={DoorOpen} label="Cerrar salón" onClick={onInicio} />
        <AccPie Icono={Banknote} label="Abrir cajón" disabled />
        <AccPie Icono={StickyNote} label="Notas mesa" disabled />
        <AccPie Icono={Split} label="Dividir pagos" disabled />
        <AccPie Icono={MoveHorizontal} label="Trasp. mesa" disabled />
        <AccPie Icono={ChefHat} label="Re. cocina" disabled />
        <AccPie Icono={ReceiptText} label="Último doc." disabled />
        <AccPie Icono={Printer} label="Imp. cuenta" disabled />
        <span className="ml-auto flex gap-2">
          <AccPie Icono={DoorOpen} label="Abrir mesa" tono="brand" disabled={!sel} onClick={() => sel && onAbrirMesa(sel)} />
          <AccPie Icono={CreditCard} label="Cobrar" tono="cobro" disabled={!sel} onClick={() => sel && onAbrirMesa(sel)} />
        </span>
      </footer>
    </div>
  );
}
