import { useEffect, useState } from "react";
import { MarcoApartado } from "../../ui";
import { APARTADOS } from "../meta";
import { eur } from "../../lib/dinero";
import { PlanoMesas } from "./PlanoMesas";
import { Venta } from "./Venta";
import { useVenta } from "./store";
import type { Mesa } from "./datos";

// La OPERATIVA: plano de mesas (dentro del marco del apartado) ↔ pantalla de venta
// (a pantalla completa, con su cabecera morada propia, fiel al TPV de Next). El
// catálogo y el cobro son demo (store local); se cablean al nodo por fases.
export function Tpv({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.tpv;
  const [venta, setVenta] = useState(false);
  const [cobrado, setCobrado] = useState<string | null>(null);
  const iniciar = useVenta((s) => s.iniciar);
  const vaciar = useVenta((s) => s.vaciar);

  useEffect(() => {
    if (!cobrado) return;
    const t = setTimeout(() => setCobrado(null), 2600);
    return () => clearTimeout(t);
  }, [cobrado]);

  const abrirMesa = (mesa: Mesa) => { iniciar(`Mesa ${mesa.nombre}`, mesa.comensales ?? 1); setVenta(true); };
  const nuevaBarra = () => { iniciar("Barra", 1); setVenta(true); };
  const cobrar = (total: number) => { setCobrado(`Cobrado ${eur(total)}`); vaciar(); setVenta(false); };

  const toast = cobrado && (
    <div className="gl-aparecer fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-mint px-6 py-3 font-bold text-[#053a26] shadow-md">{cobrado}</div>
  );

  if (venta) {
    return <>
      <Venta operario="María Ruiz" onVolverPlano={() => setVenta(false)} onCobrar={cobrar} />
      {toast}
    </>;
  }

  return <>
    <MarcoApartado titulo={m.titulo} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      <PlanoMesas onAbrirMesa={abrirMesa} onNuevaBarra={nuevaBarra} />
    </MarcoApartado>
    {toast}
  </>;
}
