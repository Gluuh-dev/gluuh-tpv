"use client";

import { useEffect, useState } from "react";

/**
 * Cartelería digital de ofertas (digital signage) para pantallas del local.
 * Rota promociones automáticamente. En producción, las promos vienen de Supabase
 * y se pueden programar por franja horaria. Ver docs/14.
 */
const OFERTAS = [
  { emoji: "🍔", titulo: "Menú Clásico", desc: "Hamburguesa + patatas + bebida", precio: "9,90 €", bg: "#e11d48" },
  { emoji: "🍺", titulo: "Hora feliz", desc: "2ª cerveza al 50% · de 18 a 20 h", precio: "", bg: "#f59e0b" },
  { emoji: "🍦", titulo: "Postre gratis", desc: "En menús dobles, hoy", precio: "0 €", bg: "#7c3aed" },
  { emoji: "🥤", titulo: "Refill de refresco", desc: "Rellena tu vaso sin coste", precio: "", bg: "#0ea5e9" },
];

export default function Ofertas() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % OFERTAS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const o = OFERTAS[i]!;
  return (
    <main style={{ ...S.wrap, background: o.bg }}>
      <div style={S.card}>
        <div style={{ fontSize: 140 }}>{o.emoji}</div>
        <h1 style={S.titulo}>{o.titulo}</h1>
        <p style={S.desc}>{o.desc}</p>
        {o.precio && <div style={S.precio}>{o.precio}</div>}
      </div>
      <div style={S.dots}>
        {OFERTAS.map((_, k) => (
          <span key={k} style={{ ...S.dot, opacity: k === i ? 1 : 0.4 }} />
        ))}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.6s",
  },
  card: { textAlign: "center" },
  titulo: { fontSize: 64, margin: "8px 0", fontWeight: 900 },
  desc: { fontSize: 28 },
  precio: { fontSize: 80, fontWeight: 900, marginTop: 16 },
  dots: { display: "flex", gap: 12, position: "absolute", bottom: 40 },
  dot: { width: 16, height: 16, borderRadius: 999, background: "#fff", display: "inline-block" },
};
