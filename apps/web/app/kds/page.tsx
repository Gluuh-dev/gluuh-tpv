"use client";

import { useEffect, useState } from "react";
import { COLOR, LABEL, SIGUIENTE, type EstadoPrep } from "../lib/estados";

interface Item {
  nombre: string;
  cantidad: number;
}
interface Pedido {
  id: string;
  numero: number;
  estado: EstadoPrep;
  tipoConsumo: "LOCAL" | "PARA_LLEVAR";
  items: Item[];
  creadoEn: number;
}

const minutos = (ts: number) => Math.max(0, Math.floor((Date.now() - ts) / 60000));

export default function KDS() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  async function cargar() {
    const res = await fetch("/api/pedidos", { cache: "no-store" });
    const todos: Pedido[] = await res.json();
    setPedidos(todos.filter((p) => p.estado !== "ENTREGADO"));
  }

  async function avanzar(p: Pedido) {
    const siguiente = SIGUIENTE[p.estado];
    if (!siguiente) return;
    await fetch(`/api/pedidos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: siguiente }),
    });
    cargar();
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <main style={S.wrap}>
      <header style={S.header}>
        <strong>👨‍🍳 Cocina (KDS)</strong>
        <span style={{ color: "#9ca3af" }}>{pedidos.length} pedidos activos · actualiza solo</span>
      </header>
      <div style={S.grid}>
        {pedidos.length === 0 && <p style={{ color: "#9ca3af" }}>No hay comandas pendientes.</p>}
        {pedidos.map((p) => (
          <div key={p.id} style={{ ...S.card, borderTopColor: COLOR[p.estado] }}>
            <div style={S.cardHead}>
              <strong style={{ fontSize: 22 }}>A-{p.numero}</strong>
              <span style={{ ...S.estado, background: COLOR[p.estado] }}>{LABEL[p.estado]}</span>
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
              {p.tipoConsumo === "LOCAL" ? "🍽️ Comer aquí" : "🛍️ Para llevar"} · hace {minutos(p.creadoEn)} min
            </div>
            <ul style={S.items}>
              {p.items.map((it, i) => (
                <li key={i}>
                  <strong>{it.cantidad}×</strong> {it.nombre}
                </li>
              ))}
            </ul>
            {SIGUIENTE[p.estado] && (
              <button style={{ ...S.btn, background: COLOR[SIGUIENTE[p.estado]!] }} onClick={() => avanzar(p)}>
                → {LABEL[SIGUIENTE[p.estado]!]}
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", background: "#0f172a", color: "#fff", fontFamily: "system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", padding: "14px 20px", background: "#1e293b", fontSize: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, padding: 16 },
  card: { background: "#1e293b", borderRadius: 12, borderTop: "5px solid", padding: 14 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  estado: { fontSize: 11, padding: "3px 8px", borderRadius: 999, fontWeight: 700 },
  items: { listStyle: "none", padding: 0, margin: "8px 0", fontSize: 15, lineHeight: 1.6 },
  btn: { width: "100%", border: "none", borderRadius: 8, color: "#fff", padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: 15 },
};
