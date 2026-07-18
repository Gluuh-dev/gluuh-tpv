import { useEffect, useState } from "react";
import { MarcoApartado } from "../../ui";
import { APARTADOS } from "../meta";
import { eur } from "../../lib/dinero";
import { PlanoMesas } from "./PlanoMesas";
import { Venta } from "./Venta";
import type { Mesa } from "./datos";

type SubVista =
  | { tipo: "plano" }
  | { tipo: "venta"; contexto: string; comensales?: number };

// La OPERATIVA: plano de mesas ↔ pantalla de venta. Estado local demo; se cablea
// al catálogo y cobro reales del nodo por fases (guía 22). El login por operario
// (dentro del TPV, por acción) se añade al integrar la sesión del nodo.
export function Tpv({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.tpv;
  const [sub, setSub] = useState<SubVista>({ tipo: "plano" });
  const [cobrado, setCobrado] = useState<string | null>(null);

  useEffect(() => {
    if (!cobrado) return;
    const t = setTimeout(() => setCobrado(null), 2600);
    return () => clearTimeout(t);
  }, [cobrado]);

  const abrirMesa = (mesa: Mesa) => setSub({ tipo: "venta", contexto: `Mesa ${mesa.nombre}`, comensales: mesa.comensales });
  const nuevaBarra = () => setSub({ tipo: "venta", contexto: "Barra" });
  const cobrar = (total: number) => { setCobrado(`Cobrado ${eur(total)}`); setSub({ tipo: "plano" }); };

  return (
    <div className="relative">
      <MarcoApartado titulo={m.titulo} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
        {sub.tipo === "plano"
          ? <PlanoMesas onAbrirMesa={abrirMesa} onNuevaBarra={nuevaBarra} />
          : <Venta contexto={sub.contexto} comensales={sub.comensales} onVolver={() => setSub({ tipo: "plano" })} onCobrar={cobrar} />}
      </MarcoApartado>

      {/* Aviso de cobro (demo). El cobro real abrirá su modal con desglose/VERIFACTU. */}
      {cobrado && (
        <div className="gl-aparecer fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-mint px-6 py-3 font-bold text-[#053a26] shadow-md">
          {cobrado}
        </div>
      )}
    </div>
  );
}
