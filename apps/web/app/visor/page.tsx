"use client";

// Visor de cliente (2º monitor del PC, abierto por Gluuh Desktop).
// Recibe el ticket en curso por IPC (window.gluuh.onEvento tipo "visor");
// no necesita red ni sesión propia.
import { useEffect, useState } from "react";

interface TicketVisor {
  lineas: { nombre: string; cantidad: number; importe: number }[];
  total: number;
  cobrado?: boolean;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Visor() {
  const [ticket, setTicket] = useState<TicketVisor | null>(null);
  const [enDesktop, setEnDesktop] = useState(true);

  useEffect(() => {
    if (!window.gluuh) { setEnDesktop(false); return; }
    return window.gluuh.onEvento((e) => {
      if (e.tipo === "visor") setTicket(e.datos as TicketVisor);
    });
  }, []);

  if (!enDesktop) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-950 text-neutral-400">
        <p>El visor de cliente solo funciona dentro de Gluuh Desktop.</p>
      </div>
    );
  }

  const vacio = !ticket || ticket.lineas.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-50">
      {vacio ? (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <div className="text-5xl font-bold">¡Bienvenido!</div>
            <div className="mt-3 text-xl text-neutral-400">Enseguida le atendemos</div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-10">
            <table className="w-full text-2xl">
              <tbody>
                {ticket.lineas.map((l, i) => (
                  <tr key={i} className="border-b border-neutral-800">
                    <td className="py-3">{l.cantidad}× {l.nombre}</td>
                    <td className="py-3 text-right tabular-nums">{eur(l.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-700 bg-neutral-900 px-10 py-8">
            <span className="text-3xl text-neutral-300">{ticket.cobrado ? "GRACIAS POR SU VISITA" : "TOTAL"}</span>
            <span className="text-6xl font-bold tabular-nums">{eur(ticket.total)}</span>
          </div>
        </>
      )}
    </div>
  );
}
