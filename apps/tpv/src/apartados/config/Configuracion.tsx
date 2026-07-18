import { MarcoApartado, EnObras } from "../../ui";
import { APARTADOS } from "../meta";

// Configuración DENTRO del TPV (carta, precios, salas, impresoras, pagos,
// impuestos). El panel Next queda para el modo online. Se diseña aquí por fases.
export function Configuracion({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.config;
  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <EnObras titulo={m.titulo} />
    </MarcoApartado>
  );
}
