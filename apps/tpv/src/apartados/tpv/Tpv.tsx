import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { EnObras } from "../../ui";
import { eur } from "../../lib/dinero";
import { PlanoMesas } from "./PlanoMesas";
import { Venta } from "./Venta";
import { RailSalas } from "./RailSalas";
import { useVenta } from "./store";
import { SALAS_DEMO, type Mesa } from "./datos";

const OPERARIO = "María Ruiz";

// Vistas sin diseñar aún (Aparcado / Para llevar / Reservas): marco navegable con
// el rail, para poder moverse. Se rellenan por fases.
function VistaSimple({ titulo, vista, onVista, onInicio, onConfig }: Readonly<{ titulo: string; vista: string; onVista: (v: string) => void; onInicio: () => void; onConfig: () => void }>) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 flex-none items-center gap-3 bg-brand px-3 text-white">
        <button type="button" onClick={onInicio} aria-label="Inicio" className="grid h-9 w-9 place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><Home size={18} /></button>
        <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto" draggable={false} />
        <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-bold">{titulo}</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <EnObras titulo={titulo} />
        <RailSalas vista={vista} onVista={onVista} onConfig={onConfig} />
      </div>
    </div>
  );
}

// La OPERATIVA: shell con el rail persistente. `vista` = "ticket" (venta) ·
// "aparcado" · id de sala (plano) · "llevar" · "reservas". El catálogo y el cobro
// son demo (store local); se cablean al nodo por fases (guía 22).
export function Tpv({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [vista, setVista] = useState<string>(SALAS_DEMO[0]!.id); // arranca en el plano de la 1ª sala
  const [cobrado, setCobrado] = useState<string | null>(null);
  const iniciar = useVenta((s) => s.iniciar);
  const vaciar = useVenta((s) => s.vaciar);

  useEffect(() => {
    if (!cobrado) return;
    const t = setTimeout(() => setCobrado(null), 2600);
    return () => clearTimeout(t);
  }, [cobrado]);

  const abrirMesa = (mesa: Mesa) => { iniciar(`Mesa ${mesa.nombre}`, mesa.comensales ?? 1); setVista("ticket"); };
  const nuevaBarra = () => { iniciar("Barra", 1); setVista("ticket"); };
  const cobrar = (total: number) => { setCobrado(`Cobrado ${eur(total)}`); vaciar(); setVista(SALAS_DEMO[0]!.id); };

  const esSala = SALAS_DEMO.some((s) => s.id === vista);

  let contenido;
  if (vista === "ticket") {
    contenido = <Venta operario={OPERARIO} vista={vista} onVista={setVista} onConfig={onVolver} onCobrar={cobrar} />;
  } else if (esSala) {
    contenido = <PlanoMesas vista={vista} onVista={setVista} onConfig={onVolver} onAbrirMesa={abrirMesa} onNuevaBarra={nuevaBarra} onInicio={onVolver} operario={OPERARIO} />;
  } else {
    const titulo = vista === "aparcado" ? "Aparcado" : vista === "llevar" ? "Para llevar" : "Reservas";
    contenido = <VistaSimple titulo={titulo} vista={vista} onVista={setVista} onInicio={onVolver} onConfig={onVolver} />;
  }

  return (
    <>
      {contenido}
      {cobrado && (
        <div className="gl-aparecer fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-mint px-6 py-3 font-bold text-[#053a26] shadow-md">{cobrado}</div>
      )}
    </>
  );
}
