import { HeaderVenta } from "./venta/HeaderVenta";
import { Ticket } from "./venta/Ticket";
import { BarraTotales } from "./venta/BarraTotales";
import { FilaAcciones } from "./venta/FilaAcciones";
import { Teclado } from "./venta/Teclado";
import { ColumnaFunciones } from "./venta/ColumnaFunciones";
import { PanelProductos } from "./venta/PanelProductos";
import { RailSalas } from "./RailSalas";
import { useVenta } from "./store";

// PANTALLA DE VENTA (vista "Ticket"): cabecera morada + cuerpo [columna izquierda
// (cuenta+ticket+totales+acciones+teclado)+rail de funciones | categorías+productos
// | RAIL de salas]. La barra de estado la pone el shell (común a todo el TPV).
export function Venta({
  operario, vista, zurdo, onVista, onConfig, onCobrar, onFuncion,
}: Readonly<{
  operario: string;
  vista: string;
  zurdo: boolean;
  onVista: (v: string) => void;
  onConfig: () => void;
  onCobrar: (total: number) => void;
  onFuncion: (f: string) => void;
}>) {
  const vaciar = useVenta((s) => s.vaciar);
  const total = useVenta((s) => s.total());

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <HeaderVenta onVolverPlano={() => onVista("salon")} />

      <div className={`flex min-h-0 flex-1 ${zurdo ? "flex-row-reverse" : ""}`}>
        <div className={`flex w-[532px] flex-none ${zurdo ? "border-l" : "border-r"} border-border bg-card`}>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
            <Ticket />
            <BarraTotales />
            <FilaAcciones onFuncion={onFuncion} />
            <Teclado onCobrar={() => onCobrar(total)} />
          </div>
          <ColumnaFunciones onVaciar={vaciar} onFuncion={onFuncion} />
        </div>

        <PanelProductos />

        <RailSalas vista={vista} onVista={onVista} onConfig={onConfig} />
      </div>
    </div>
  );
}
