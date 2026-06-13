"use client";

import { useEffect, useState } from "react";
import type { EstadoPrep } from "../lib/estados";

interface Pedido {
  id: string;
  numero: number;
  estado: EstadoPrep;
}

/**
 * Display para el cliente (pantalla grande del local), estilo fast-food:
 * columna "En preparación" y columna "Listos para recoger".
 * Demo con polling; en producción → Supabase Realtime (docs/14).
 */
export default function PantallaCliente() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    const cargar = async () => {
      const res = await fetch("/api/pedidos", { cache: "no-store" });
      setPedidos(await res.json());
    };
    cargar();
    const t = setInterval(cargar, 2000);
    return () => clearInterval(t);
  }, []);

  const preparando = pedidos.filter((p) => p.estado === "PENDIENTE" || p.estado === "EN_PREPARACION");
  const listos = pedidos.filter((p) => p.estado === "LISTO");

  return (
    <main style={S.wrap}>
      <header style={S.header}>🍔 Servio — Estado de tu pedido</header>
      <div style={S.cols}>
        <section style={S.col}>
          <h2 style={{ ...S.colTitle, color: "#f59e0b" }}>⏳ En preparación</h2>
          <div style={S.nums}>
            {preparando.length === 0 && <span style={S.vacio}>—</span>}
            {preparando.map((p) => (
              <div key={p.id} style={{ ...S.num, background: "#1e293b", color: "#f59e0b" }}>
                A-{p.numero}
              </div>
            ))}
          </div>
        </section>
        <section style={{ ...S.col, borderLeft: "2px solid #334155" }}>
          <h2 style={{ ...S.colTitle, color: "#22c55e" }}>✅ Listos para recoger</h2>
          <div style={S.nums}>
            {listos.length === 0 && <span style={S.vacio}>—</span>}
            {listos.map((p) => (
              <div key={p.id} style={{ ...S.num, background: "#16a34a", color: "#fff" }}>
                A-{p.numero}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#0f172a", color: "#fff", fontFamily: "system-ui, sans-serif" },
  header: { textAlign: "center", fontSize: 32, fontWeight: 800, padding: "20px 0", background: "#1e293b" },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 88px)" },
  col: { padding: 24 },
  colTitle: { textAlign: "center", fontSize: 30, marginBottom: 20 },
  nums: { display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" },
  num: { fontSize: 44, fontWeight: 900, padding: "14px 28px", borderRadius: 14, minWidth: 120, textAlign: "center" },
  vacio: { fontSize: 40, color: "#475569" },
};
