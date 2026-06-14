"use client";

import { useMemo, useState } from "react";

interface Producto {
  id: string;
  nombre: string;
  precio: number; // PVP, IGIC incluido
  tipo: number; // % impositivo
}

// Catálogo de ejemplo (Canarias · IGIC). Mezcla 7 % (servicio) y 15 % (alcohol para llevar).
const CATALOGO: Producto[] = [
  { id: "cana", nombre: "Caña", precio: 2.5, tipo: 7 },
  { id: "cafe", nombre: "Café", precio: 1.4, tipo: 7 },
  { id: "agua", nombre: "Agua", precio: 1.5, tipo: 7 },
  { id: "pulpo", nombre: "Ración de pulpo", precio: 14.0, tipo: 7 },
  { id: "tarta", nombre: "Tarta", precio: 4.5, tipo: 7 },
  { id: "vino", nombre: "Botella de vino (llevar)", precio: 12.0, tipo: 15 },
];

interface LineaTicket {
  emisor: { nif: string; nombre: string };
  numSerieFactura: string;
  fecha: string;
  impuestos: {
    impuesto: string;
    desglose: { tipo: number; base: number; cuota: number }[];
    baseTotal: number;
    cuotaTotal: number;
    importeTotal: number;
  };
  verifactu: { leyenda: string; huella: string; qrUrl: string; qrDataUrl: string };
}

const eur = (n: number) => n.toFixed(2) + " €";

export default function TpvPage() {
  const [cuenta, setCuenta] = useState<Record<string, number>>({});
  const [ticket, setTicket] = useState<LineaTicket | null>(null);
  const [cargando, setCargando] = useState(false);

  const total = useMemo(
    () =>
      Object.entries(cuenta).reduce((s, [id, qty]) => {
        const p = CATALOGO.find((c) => c.id === id)!;
        return s + p.precio * qty;
      }, 0),
    [cuenta],
  );

  const añadir = (id: string) =>
    setCuenta((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const quitar = (id: string) =>
    setCuenta((c) => {
      const n = (c[id] ?? 0) - 1;
      const { [id]: _, ...resto } = c;
      return n > 0 ? { ...c, [id]: n } : resto;
    });

  const lineas = Object.entries(cuenta).map(([id, cantidad]) => {
    const p = CATALOGO.find((c) => c.id === id)!;
    return { ...p, cantidad };
  });

  async function cerrarCuenta() {
    if (!lineas.length) return;
    setCargando(true);
    try {
      const res = await fetch("/api/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          territorio: "CANARIAS",
          lineas: lineas.map((l) => ({
            nombre: l.nombre,
            precio: l.precio,
            tipo: l.tipo,
            cantidad: l.cantidad,
          })),
        }),
      });
      setTicket(await res.json());
    } finally {
      setCargando(false);
    }
  }

  function nuevaCuenta() {
    setCuenta({});
    setTicket(null);
  }

  return (
    <main style={S.main}>
      <h1 style={{ gridColumn: "1 / -1", margin: 0 }}>Gluuh TPV — demo</h1>

      {/* Catálogo */}
      <section style={S.panel}>
        <h2 style={S.h2}>Carta</h2>
        <div style={S.grid}>
          {CATALOGO.map((p) => (
            <button key={p.id} style={S.prod} onClick={() => añadir(p.id)}>
              <strong>{p.nombre}</strong>
              <span>{eur(p.precio)}</span>
              <small style={{ color: "#888" }}>IGIC {p.tipo}%</small>
            </button>
          ))}
        </div>
      </section>

      {/* Cuenta */}
      <section style={S.panel}>
        <h2 style={S.h2}>Cuenta</h2>
        {lineas.length === 0 && <p style={{ color: "#888" }}>Añade productos…</p>}
        {lineas.map((l) => (
          <div key={l.id} style={S.linea}>
            <span>
              {l.cantidad}× {l.nombre}
            </span>
            <span>{eur(l.precio * l.cantidad)}</span>
            <span>
              <button style={S.mini} onClick={() => quitar(l.id)}>
                −
              </button>
              <button style={S.mini} onClick={() => añadir(l.id)}>
                +
              </button>
            </span>
          </div>
        ))}
        <div style={S.total}>
          <span>TOTAL</span>
          <span>{eur(total)}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.cobrar} disabled={!lineas.length || cargando} onClick={cerrarCuenta}>
            {cargando ? "Generando…" : "Cerrar cuenta y emitir ticket"}
          </button>
          <button style={S.secundario} onClick={nuevaCuenta}>
            Nueva
          </button>
        </div>
      </section>

      {/* Ticket */}
      {ticket && (
        <section style={{ ...S.panel, ...S.ticket }}>
          <h2 style={S.h2}>Ticket</h2>
          <div style={S.ticketBody}>
            <strong>{ticket.emisor.nombre}</strong>
            <div>NIF: {ticket.emisor.nif}</div>
            <hr />
            {ticket.impuestos.desglose.map((d) => (
              <div key={d.tipo} style={S.linea}>
                <span>
                  {ticket.impuestos.impuesto} {d.tipo}%
                </span>
                <span>base {eur(d.base)}</span>
                <span>cuota {eur(d.cuota)}</span>
              </div>
            ))}
            <div style={S.total}>
              <span>TOTAL</span>
              <span>{eur(ticket.impuestos.importeTotal)}</span>
            </div>
            <hr />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.verifactu.qrDataUrl} alt="QR VERIFACTU" width={160} height={160} />
            <strong>{ticket.verifactu.leyenda}</strong>
            <small>Nº {ticket.numSerieFactura} · {ticket.fecha}</small>
            <small style={S.huella}>Huella: {ticket.verifactu.huella.slice(0, 24)}…</small>
          </div>
        </section>
      )}
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    padding: 24,
    fontFamily: "system-ui, sans-serif",
    alignItems: "start",
  },
  panel: { border: "1px solid #ddd", borderRadius: 12, padding: 16 },
  h2: { marginTop: 0, fontSize: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  prod: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: 12,
    border: "1px solid #ccc",
    borderRadius: 10,
    background: "#fafafa",
    cursor: "pointer",
    textAlign: "left",
  },
  linea: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0" },
  total: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 700,
    borderTop: "2px solid #333",
    marginTop: 8,
    paddingTop: 8,
  },
  cobrar: {
    flex: 1,
    padding: 12,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 12,
  },
  secundario: {
    padding: 12,
    border: "1px solid #ccc",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    marginTop: 12,
  },
  mini: { width: 28, height: 28, marginLeft: 4, cursor: "pointer", borderRadius: 6 },
  ticket: { background: "#fff" },
  ticketBody: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontFamily: "ui-monospace, monospace",
    fontSize: 13,
  },
  huella: { color: "#999", wordBreak: "break-all" },
};
