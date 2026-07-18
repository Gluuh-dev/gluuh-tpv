import { MarcoApartado, EnObras } from "../../ui";
import { APARTADOS } from "../meta";

// La OPERATIVA: mesas, barra, comandas y cobros. Es el corazón del TPV; se moverá
// aquí desde apps/web/app/tpv por fases (guía 22), sin big-bang. Placeholder de momento.
export function Tpv({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.tpv;
  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <EnObras titulo={m.titulo} />
    </MarcoApartado>
  );
}
