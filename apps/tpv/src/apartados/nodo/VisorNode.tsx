import { MarcoApartado, EnObras } from "../../ui";
import { APARTADOS } from "../meta";

// Visor Node: estado del servidor del bar, dispositivos conectados, colas de
// impresión y registro. Muy visual y con datos reales del nodo (se cablea después).
export function VisorNode({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.nodo;
  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <EnObras titulo={m.titulo} />
    </MarcoApartado>
  );
}
