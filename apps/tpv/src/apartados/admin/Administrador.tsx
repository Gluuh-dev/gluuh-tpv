import { MarcoApartado, EnObras } from "../../ui";
import { APARTADOS } from "../meta";

// Administrador: empleados, turnos, permisos, licencias, ajustes avanzados.
export function Administrador({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.admin;
  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <EnObras titulo={m.titulo} />
    </MarcoApartado>
  );
}
