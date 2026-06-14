"use client";

import { useMemo, useState } from "react";
import { CATALOGO, CATEGORIAS, productoPorId } from "../lib/catalogo";

type Paso = "inicio" | "carta" | "pago" | "confirmado";
const eur = (n: number) => n.toFixed(2) + " €";

export default function Kiosko() {
  const [paso, setPaso] = useState<Paso>("inicio");
  const [tipoConsumo, setTipoConsumo] = useState<"LOCAL" | "PARA_LLEVAR">("LOCAL");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [numero, setNumero] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const total = useMemo(
    () =>
      Object.entries(carrito).reduce((s, [id, q]) => s + (productoPorId(id)?.precio ?? 0) * q, 0),
    [carrito],
  );
  const unidades = Object.values(carrito).reduce((s, q) => s + q, 0);

  const add = (id: string) => setCarrito((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) =>
    setCarrito((c) => {
      const n = (c[id] ?? 0) - 1;
      const { [id]: _, ...r } = c;
      return n > 0 ? { ...c, [id]: n } : r;
    });

  async function pagar(metodo: string) {
    setEnviando(true);
    try {
      const items = Object.entries(carrito).map(([id, cantidad]) => {
        const p = productoPorId(id)!;
        return { nombre: p.nombre, cantidad, precio: p.precio, tipo: p.tipo };
      });
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, tipoConsumo, canal: "KIOSKO" }),
      });
      const pedido = await res.json();
      setNumero(pedido.numero);
      setPaso("confirmado");
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setCarrito({});
    setNumero(null);
    setTipoConsumo("LOCAL");
    setPaso("inicio");
  }

  // ---- INICIO ----
  if (paso === "inicio") {
    return (
      <div style={S.kiosk}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 80 }}>🍔</div>
          <h1 style={S.bigTitle}>Bienvenido</h1>
          <p style={{ fontSize: 22, color: "#fff" }}>Toca para empezar tu pedido</p>
          <div style={{ display: "flex", gap: 24, marginTop: 40, justifyContent: "center" }}>
            <button
              style={S.choiceBtn}
              onClick={() => {
                setTipoConsumo("LOCAL");
                setPaso("carta");
              }}
            >
              <div style={{ fontSize: 56 }}>🍽️</div>
              Comer aquí
            </button>
            <button
              style={S.choiceBtn}
              onClick={() => {
                setTipoConsumo("PARA_LLEVAR");
                setPaso("carta");
              }}
            >
              <div style={{ fontSize: 56 }}>🛍️</div>
              Para llevar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- CONFIRMADO ----
  if (paso === "confirmado") {
    return (
      <div style={{ ...S.kiosk, background: "#16a34a" }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 80 }}>✅</div>
          <h1 style={S.bigTitle}>¡Pedido confirmado!</h1>
          <p style={{ fontSize: 22 }}>Tu número de pedido es</p>
          <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1 }}>A-{numero}</div>
          <p style={{ fontSize: 20, marginTop: 16 }}>
            Recógelo cuando aparezca en la pantalla. {tipoConsumo === "LOCAL" ? "Comer aquí" : "Para llevar"}.
          </p>
          <button style={{ ...S.payBtn, marginTop: 32 }} onClick={reiniciar}>
            Nuevo pedido
          </button>
        </div>
      </div>
    );
  }

  const productos = CATALOGO.filter((p) => p.categoria === categoria);

  // ---- PAGO ----
  if (paso === "pago") {
    return (
      <div style={{ ...S.kiosk, background: "#111", justifyContent: "flex-start", paddingTop: 40 }}>
        <div style={{ width: "100%", maxWidth: 560, color: "#fff", textAlign: "center" }}>
          <h1 style={S.bigTitle}>Pago</h1>
          <div style={{ fontSize: 64, fontWeight: 900, margin: "16px 0" }}>{eur(total)}</div>
          <p style={{ color: "#bbb" }}>{unidades} producto(s) · {tipoConsumo === "LOCAL" ? "Comer aquí" : "Para llevar"}</p>
          <p style={{ color: "#888", fontSize: 13 }}>
            (Pago simulado en la demo · integración Stripe/Redsys en docs/08)
          </p>
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            {["💳 Tarjeta", "📱 Bizum", "💶 Efectivo"].map((m) => (
              <button key={m} style={S.payBtn} disabled={enviando} onClick={() => pagar(m)}>
                {enviando ? "Procesando…" : m}
              </button>
            ))}
          </div>
          <button style={S.linkBtn} onClick={() => setPaso("carta")}>
            ← Volver a la carta
          </button>
        </div>
      </div>
    );
  }

  // ---- CARTA ----
  return (
    <div style={S.cartaWrap}>
      <header style={S.header}>
        <strong style={{ fontSize: 20 }}>🍔 Gluppo Kiosko</strong>
        <span>{tipoConsumo === "LOCAL" ? "🍽️ Comer aquí" : "🛍️ Para llevar"}</span>
      </header>

      <div style={S.cartaBody}>
        {/* Categorías */}
        <nav style={S.cats}>
          {CATEGORIAS.map((c) => (
            <button
              key={c}
              style={{ ...S.catBtn, ...(c === categoria ? S.catBtnActive : {}) }}
              onClick={() => setCategoria(c)}
            >
              {c}
            </button>
          ))}
        </nav>

        {/* Productos */}
        <section style={S.prodGrid}>
          {productos.map((p) => (
            <button key={p.id} style={S.prodCard} onClick={() => add(p.id)}>
              <div style={{ fontSize: 48 }}>{p.emoji}</div>
              <strong>{p.nombre}</strong>
              <span style={{ color: "#e11d48", fontWeight: 700 }}>{eur(p.precio)}</span>
              {carrito[p.id] ? <span style={S.badge}>{carrito[p.id]}</span> : null}
            </button>
          ))}
        </section>

        {/* Carrito */}
        <aside style={S.cart}>
          <h2 style={{ margin: "0 0 8px" }}>Tu pedido</h2>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {unidades === 0 && <p style={{ color: "#888" }}>Añade productos…</p>}
            {Object.entries(carrito).map(([id, q]) => {
              const p = productoPorId(id)!;
              return (
                <div key={id} style={S.cartLine}>
                  <span>
                    {p.emoji} {p.nombre}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    <button style={S.mini} onClick={() => sub(id)}>
                      −
                    </button>
                    {q}
                    <button style={S.mini} onClick={() => add(id)}>
                      +
                    </button>
                  </span>
                  <span>{eur(p.precio * q)}</span>
                </div>
              );
            })}
          </div>
          <div style={S.cartTotal}>
            <span>TOTAL</span>
            <span>{eur(total)}</span>
          </div>
          <button
            style={{ ...S.payBtn, opacity: unidades ? 1 : 0.5 }}
            disabled={!unidades}
            onClick={() => setPaso("pago")}
          >
            Pagar →
          </button>
        </aside>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  kiosk: {
    minHeight: "100vh",
    background: "#e11d48",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  },
  bigTitle: { fontSize: 48, color: "#fff", margin: "8px 0" },
  choiceBtn: {
    width: 220,
    height: 220,
    borderRadius: 24,
    border: "none",
    background: "#fff",
    color: "#e11d48",
    fontSize: 26,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtn: {
    padding: "18px 24px",
    fontSize: 22,
    fontWeight: 800,
    border: "none",
    borderRadius: 14,
    background: "#facc15",
    color: "#111",
    cursor: "pointer",
  },
  linkBtn: {
    marginTop: 20,
    background: "none",
    border: "none",
    color: "#bbb",
    fontSize: 16,
    cursor: "pointer",
  },
  cartaWrap: { minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#f4f4f5" },
  header: {
    background: "#e11d48",
    color: "#fff",
    padding: "14px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartaBody: { display: "grid", gridTemplateColumns: "160px 1fr 320px", gap: 0, height: "calc(100vh - 52px)" },
  cats: { display: "flex", flexDirection: "column", background: "#fff", borderRight: "1px solid #e5e5e5", overflowY: "auto" },
  catBtn: { padding: "18px 12px", border: "none", borderBottom: "1px solid #eee", background: "#fff", cursor: "pointer", fontSize: 15, textAlign: "left" },
  catBtnActive: { background: "#e11d48", color: "#fff", fontWeight: 700 },
  prodGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, padding: 16, overflowY: "auto", alignContent: "start" },
  prodCard: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
    padding: 16,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 16,
    cursor: "pointer",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    background: "#16a34a",
    color: "#fff",
    borderRadius: 999,
    width: 26,
    height: 26,
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
  },
  cart: { background: "#fff", borderLeft: "1px solid #e5e5e5", padding: 16, display: "flex", flexDirection: "column" },
  cartLine: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 },
  cartTotal: { display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 20, borderTop: "2px solid #111", padding: "10px 0", margin: "8px 0" },
  mini: { width: 26, height: 26, margin: "0 4px", borderRadius: 6, cursor: "pointer", border: "1px solid #ccc", background: "#fafafa" },
};
