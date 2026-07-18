import { useState } from "react";
import { HeaderVenta } from "./venta/HeaderVenta";
import { CabeceraCuenta } from "./venta/CabeceraCuenta";
import { Ticket } from "./venta/Ticket";
import { BarraTotales } from "./venta/BarraTotales";
import { FilaAcciones } from "./venta/FilaAcciones";
import { Teclado } from "./venta/Teclado";
import { ColumnaFunciones } from "./venta/ColumnaFunciones";
import { PanelProductos } from "./venta/PanelProductos";
import { BarraEstado } from "./venta/BarraEstado";
import { RailSalas } from "./RailSalas";
import { useVenta } from "./store";

// PANTALLA DE VENTA (vista "Ticket"), layout fiel al TPV de Next: cabecera morada
// (full width) · cuerpo [columna izquierda (cuenta+ticket+totales+acciones+teclado)
// + rail de funciones | categorías+productos | RAIL de salas] · barra de estado.
// El modo zurdo invierte los lados.
export function Venta({
  operario, vista, onVista, onConfig, onCobrar,
}: Readonly<{
  operario: string;
  vista: string;
  onVista: (v: string) => void;
  onConfig: () => void;
  onCobrar: (total: number) => void;
}>) {
  const [zurdo, setZurdo] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("gluuh_zurdo") === "1"));
  const cambiarZurdo = (v: boolean) => { setZurdo(v); localStorage.setItem("gluuh_zurdo", v ? "1" : "0"); };

  const vaciar = useVenta((s) => s.vaciar);
  const total = useVenta((s) => s.total());
  const contexto = useVenta((s) => s.contexto);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <HeaderVenta operario={operario} onVolverPlano={() => onVista("salon")} />

      <div className={`flex min-h-0 flex-1 ${zurdo ? "flex-row-reverse" : ""}`}>
        {/* Columna izquierda: cuenta + ticket + teclado + funciones */}
        <div className={`flex w-[532px] flex-none ${zurdo ? "border-l" : "border-r"} border-border bg-card`}>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
            <CabeceraCuenta />
            <Ticket />
            <BarraTotales />
            <FilaAcciones />
            <Teclado onCobrar={() => onCobrar(total)} />
          </div>
          <ColumnaFunciones onVaciar={vaciar} />
        </div>

        {/* Categorías + productos */}
        <PanelProductos />

        {/* Rail de salas (derecha, persistente) */}
        <RailSalas vista={vista} onVista={onVista} onConfig={onConfig} />
      </div>

      <BarraEstado operario={operario} terminal="TERMINAL 01" contexto={contexto} zurdo={zurdo} onZurdo={cambiarZurdo} />
    </div>
  );
}
