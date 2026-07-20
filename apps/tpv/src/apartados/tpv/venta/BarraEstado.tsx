import { useEffect, useState } from "react";
import { Monitor, MapPin, Wifi, CircleDot, Keyboard } from "lucide-react";
import { getTecladoAuto, setTecladoAuto } from "../../../ui";

function Sep() { return <span className="h-3.5 w-px bg-border" />; }

// Interruptor del auto-teclado: al activarlo, tocar un input saca el teclado en
// pantalla; tocar fuera lo oculta. Se persiste en localStorage (getTecladoAuto).
function ToggleAutoTeclado() {
  const [on, setOn] = useState(getTecladoAuto);
  // El teclado lleva su propio interruptor en la barra de título; sin escuchar
  // el aviso, esta casilla se quedaba mintiendo hasta recargar la pantalla.
  useEffect(() => {
    const cambiar = (e: Event) => setOn(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("gluuh:teclado-auto", cambiar);
    return () => window.removeEventListener("gluuh:teclado-auto", cambiar);
  }, []);
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none" title="Mostrar el teclado en pantalla al tocar un campo">
      <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setTecladoAuto(e.target.checked); }} className="accent-[color:var(--brand)]" />
      <Keyboard size={13} /> Auto-teclado
    </label>
  );
}

// Pie de la operativa: operario, terminal, contexto, caja, modo zurdo, conexión.
export function BarraEstado({
  operario, terminal, contexto, zurdo, onZurdo,
}: Readonly<{ operario: string; terminal: string; contexto: string; zurdo: boolean; onZurdo: (v: boolean) => void }>) {
  return (
    <footer className="flex flex-none items-center gap-3 border-t border-border bg-surface-2 px-4 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{operario.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
        {operario}
      </span>
      <Sep />
      <span className="flex items-center gap-1.5"><Monitor size={13} /> {terminal}</span>
      <Sep />
      <span className="flex items-center gap-1.5"><MapPin size={13} /> {contexto || "Sin cuenta"}</span>
      <Sep />
      <span className="flex items-center gap-1.5 text-success"><CircleDot size={13} /> Caja abierta</span>

      <span className="ml-auto"><ToggleAutoTeclado /></span>
      <Sep />
      <label className="flex cursor-pointer items-center gap-2 select-none">
        <input type="checkbox" checked={zurdo} onChange={(e) => onZurdo(e.target.checked)} className="accent-(--brand)" />
        Modo zurdo
      </label>
      <Sep />
      <span className="flex items-center gap-1.5 text-success"><Wifi size={13} /> En línea</span>
    </footer>
  );
}
