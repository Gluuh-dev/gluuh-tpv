"use client";

// Barra de estado inferior del TPV (estilo Glop): el estado operativo del
// terminal en una franja fina, siempre visible. Reloj y estado de red en vivo;
// el resto llega por props desde la pantalla de venta.
// Diseño: docs/auditoria_02_07_26/04-tpv-estilo-glop.md §4.1 + skill gluuh-ux-operativa.
// Memoizada (plan 011): sus props son primitivas; solo re-renderiza si cambian.
import { memo, useEffect, useState } from "react";
import { Monitor, MapPin, Wifi, WifiOff } from "lucide-react";

interface Props {
  operario?: string;
  /** Nombre del terminal (Gluuh Desktop) o "Navegador". */
  terminal: string;
  /** Contexto de venta: "Mesa 12", "Para llevar", "Barra"… */
  contexto: string;
  cajaAbierta: boolean;
  /** Tarifa activa; hoy fija hasta implementar tarifas (P1-3). */
  tarifa?: string;
  modoZurdo?: boolean;
  onModoZurdoChange?: (val: boolean) => void;
}

function Segmento({ icon, children, tono = "normal" }: { icon: React.ReactNode; children: React.ReactNode; tono?: "normal" | "ok" | "alerta" }) {
  const color = tono === "ok" ? "text-success"
    : tono === "alerta" ? "text-danger"
    : "text-muted-foreground";
  return (
    <span className={`flex items-center gap-1.5 whitespace-nowrap ${color}`}>
      <span className="flex-none">{icon}</span>
      <span className="font-medium text-foreground">{children}</span>
    </span>
  );
}

/** Separador vertical fino entre segmentos, para alinear la lectura de un vistazo. */
function Sep() {
  return <span aria-hidden className="h-3.5 w-px flex-none bg-border" />;
}

export const BarraEstado = memo(function BarraEstado({ operario, terminal, contexto, cajaAbierta, tarifa = "General", modoZurdo = false, onModoZurdoChange }: Props) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => { window.removeEventListener("online", set); window.removeEventListener("offline", set); };
  }, []);

  return (
    <footer className="flex-none border-t border-border bg-[#12161c]">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 text-xs">
        {/* Operario con avatar cian (inicial), como el mockup */}
        <span className="flex items-center gap-1.5 whitespace-nowrap text-foreground">
          <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-brand text-[.72rem] font-extrabold text-[#04191d]">
            {(operario || "—").charAt(0).toUpperCase()}
          </span>
          <span className="font-medium">{operario || "—"}</span>
        </span>
        <Sep />
        <Segmento icon={<Monitor size={14} strokeWidth={1.75} />}>{terminal}</Segmento>
        <Sep />
        <Segmento icon={<MapPin size={14} strokeWidth={1.75} />}>{contexto}</Segmento>
        <Sep />
        <Segmento icon={<span className={`h-2 w-2 rounded-full ${cajaAbierta ? "bg-success" : "bg-muted-foreground/40"}`} />} tono={cajaAbierta ? "ok" : "normal"}>
          {cajaAbierta ? "Caja abierta" : "Caja cerrada"}
        </Segmento>
        <Sep />
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-muted-foreground sm:flex">
          Tarifa <span className="font-medium text-foreground">{tarifa}</span>
        </span>
        <div className="ml-auto flex items-center gap-3 pl-3">
          {onModoZurdoChange && (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground select-none hover:text-foreground">
                <input 
                  type="checkbox" 
                  checked={modoZurdo} 
                  onChange={(e) => onModoZurdoChange(e.target.checked)} 
                  className="rounded border-border bg-card text-brand focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5" 
                />
                <span>Modo Zurdo</span>
              </label>
              <Sep />
            </>
          )}
          <Segmento icon={online ? <Wifi size={14} strokeWidth={1.75} /> : <WifiOff size={14} strokeWidth={1.75} />} tono={online ? "ok" : "alerta"}>
            {online ? "En línea" : "Sin conexión"}
          </Segmento>
        </div>
      </div>
    </footer>
  );
});
