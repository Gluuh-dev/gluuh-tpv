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

// ponytail: textos del visor pendientes de llegar por IPC desde el TPV (sin sesión aquí)
const MENSAJE_REPOSO = "¡Bienvenido!";
const MENSAJE_ESPERA = "Enseguida le atendemos";
const MENSAJE_GRACIAS = "GRACIAS POR SU VISITA";

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
      <div className="dark">
        <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
          <p>El visor de cliente solo funciona dentro de Gluuh Desktop.</p>
        </div>
      </div>
    );
  }

  const vacio = !ticket || ticket.lineas.length === 0;

  return (
    <div className="dark">
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {vacio ? (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <div className="text-5xl font-bold tracking-tight">{MENSAJE_REPOSO}</div>
              <div className="mt-3 text-xl text-muted-foreground">{MENSAJE_ESPERA}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-10">
              <table className="w-full text-2xl">
                <tbody>
                  {ticket.lineas.map((l, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3">{l.cantidad}× {l.nombre}</td>
                      <td className="py-3 text-right tabular-nums">{eur(l.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border bg-card px-10 py-8">
              <span className={`text-3xl ${ticket.cobrado ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {ticket.cobrado ? MENSAJE_GRACIAS : "TOTAL"}
              </span>
              <span className="text-6xl font-bold tabular-nums">{eur(ticket.total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
