import { MarcoApartado, EnObras } from "../../ui";
import { APARTADOS } from "../meta";

// Análisis: ventas por hora, platos más vendidos, tickets medios, cierres de caja.
export function Analisis({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.analisis;
  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <EnObras titulo={m.titulo} />
    </MarcoApartado>
  );
}
