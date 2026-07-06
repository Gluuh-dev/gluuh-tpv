"use client";

// Fila de acciones sobre la línea/extra (bajo los totales): Anular línea ·
// Comp. menú · Com. y extra · Invitar. Usa el mismo BotonAccionTPV que el rail
// (icono encima del label), sin borde ni padding vertical en el contenedor.
// Presentacional puro: callbacks + flags de disabled desde page.tsx.
// Extraído de app/tpv/page.tsx (guía docs/implementacion/02-refactor-tpv.md).
import { Ban, Combine, MessageSquarePlus, Gift } from "lucide-react";
import { BotonAccionTPV } from "./BotonAccionTPV";

export interface FilaAccionesLineaProps {
  /** Hay una línea seleccionada (habilita Anular / Com. y extra). */
  haySeleccion: boolean;
  /** Hay líneas invitadas (resalta el botón Invitar). */
  hayInvitadas: boolean;
  /** Hay unidades en la cuenta (habilita Invitar). */
  hayUnidades: boolean;
  onAnular: () => void;
  onCompMenu: () => void;
  onComExtra: () => void;
  onInvitar: () => void;
}

export function FilaAccionesLinea({ haySeleccion, hayInvitadas, hayUnidades, onAnular, onCompMenu, onComExtra, onInvitar }: FilaAccionesLineaProps) {
  return (
    <div className="flex items-stretch gap-[.28rem] px-2">
      <BotonAccionTPV icon={Ban} label="Anular línea" onClick={onAnular} disabled={!haySeleccion} className="flex-1" />
      <BotonAccionTPV icon={Combine} label="Comp. menú" onClick={onCompMenu} className="flex-1" />
      <BotonAccionTPV icon={MessageSquarePlus} label="Com. y extra" onClick={onComExtra} disabled={!haySeleccion} className="flex-1" />
      <BotonAccionTPV icon={Gift} label="Invitar" onClick={onInvitar} disabled={!hayUnidades} activo={hayInvitadas} className="flex-1" />
    </div>
  );
}
