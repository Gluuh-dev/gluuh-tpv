import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { EnObras, Modal } from "../../ui";
import { eur } from "../../lib/dinero";
import { PlanoMesas } from "./PlanoMesas";
import { Venta } from "./Venta";
import { RailSalas } from "./RailSalas";
import { BarraEstado } from "./venta/BarraEstado";
import { CobrarModal } from "./venta/CobrarModal";
import { useVenta } from "./store";
import { SALAS_DEMO, type Mesa } from "./datos";

const OPERARIO = "María Ruiz";

// Título del modal aún-en-obras según la función pulsada.
const TITULO_FUNCION: Record<string, string> = {
  cliente: "Cliente", aparcar: "Aparcar cuenta", pasar: "Pasar a mesa", consumo: "Consumo propio",
  dividir: "Dividir cuenta", utilidades: "Utilidades", bloquear: "Bloquear terminal",
  menu: "Componer menú", extra: "Comentarios y extras",
};

function VistaSimple({ titulo, vista, onVista, onInicio, onConfig }: Readonly<{ titulo: string; vista: string; onVista: (v: string) => void; onInicio: () => void; onConfig: () => void }>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

// La OPERATIVA: shell con la barra de estado COMÚN a todas las páginas y el rail
// persistente. `vista` = "ticket" (venta) · "aparcado" · id de sala (plano) ·
// "llevar" · "reservas". Catálogo y cobro demo; se cablean al nodo por fases.
export function Tpv({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [vista, setVista] = useState<string>(SALAS_DEMO[0]!.id);
  const [zurdo, setZurdo] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("gluuh_zurdo") === "1"));
  const [modal, setModal] = useState<string | null>(null);
  const [cobrado, setCobrado] = useState<string | null>(null);
  const iniciar = useVenta((s) => s.iniciar);
  const vaciar = useVenta((s) => s.vaciar);
  const contexto = useVenta((s) => s.contexto);
  const total = useVenta((s) => s.total());

  useEffect(() => {
    if (!cobrado) return;
    const t = setTimeout(() => setCobrado(null), 2600);
    return () => clearTimeout(t);
  }, [cobrado]);

  const cambiarZurdo = (v: boolean) => { setZurdo(v); localStorage.setItem("gluuh_zurdo", v ? "1" : "0"); };
  const abrirMesa = (mesa: Mesa) => { iniciar(`Mesa ${mesa.nombre}`, mesa.comensales ?? 1); setVista("ticket"); };
  const nuevaBarra = () => { iniciar("Barra", 1); setVista("ticket"); };
  const cobrar = (metodo: string) => { setCobrado(`Cobrado ${eur(total)} · ${metodo === "EFECTIVO" ? "Contado" : metodo}`); vaciar(); setModal(null); setVista(SALAS_DEMO[0]!.id); };
  const onFuncion = (f: string) => setModal(f);

  const esSala = SALAS_DEMO.some((s) => s.id === vista);

  let contenido;
  if (vista === "ticket") {
    contenido = <Venta operario={OPERARIO} vista={vista} zurdo={zurdo} onVista={setVista} onConfig={onVolver} onCobrar={() => setModal("cobrar")} onFuncion={onFuncion} />;
  } else if (esSala) {
    contenido = <PlanoMesas vista={vista} onVista={setVista} onConfig={onVolver} onAbrirMesa={abrirMesa} onNuevaBarra={nuevaBarra} onInicio={onVolver} operario={OPERARIO} />;
  } else {
    const titulo = vista === "aparcado" ? "Aparcado" : (vista === "llevar" ? "Para llevar" : "Reservas");
    contenido = <VistaSimple titulo={titulo} vista={vista} onVista={setVista} onInicio={onVolver} onConfig={onVolver} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{contenido}</div>
      <BarraEstado operario={OPERARIO} terminal="TERMINAL 01" contexto={contexto} zurdo={zurdo} onZurdo={cambiarZurdo} />

      {modal === "cobrar" && <CobrarModal total={total} contexto={contexto} onCerrar={() => setModal(null)} onCobrado={cobrar} />}
      {modal && modal !== "cobrar" && (
        <Modal onCerrar={() => setModal(null)} ancho="md" className="p-7">
          <div className="flex min-h-[220px] flex-col">
            <h2 className="mb-1 font-display text-xl font-bold">{TITULO_FUNCION[modal] ?? modal}</h2>
            <EnObras titulo={TITULO_FUNCION[modal] ?? modal} />
            <button type="button" onClick={() => setModal(null)} className="btn-ghost mt-4">Cerrar</button>
          </div>
        </Modal>
      )}

      {cobrado && (
        <div className="gl-aparecer fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-full bg-mint px-6 py-3 font-bold text-[#053a26] shadow-md">{cobrado}</div>
      )}
    </div>
  );
}
