"use client";

import { useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setError(error.message);
    else window.location.href = "/panel";
  }

  return (
    <main style={S.wrap}>
      <form style={S.card} onSubmit={onSubmit}>
        <h1 style={S.h1}>Iniciar sesión</h1>
        <p style={S.sub}>Gluuh TPV</p>
        <label style={S.label}>Email
          <input style={S.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={S.label}>Contraseña
          <input style={S.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button style={S.btn} disabled={cargando}>{cargando ? "Entrando…" : "Entrar"}</button>
        {error && <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>}
        <p style={S.foot}>¿No tienes cuenta? <a href="/registro">Crea tu empresa</a></p>
      </form>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 24 },
  card: { display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 360, border: "1px solid #e5e5e5", borderRadius: 16, padding: 24 },
  h1: { margin: 0, fontSize: 22 },
  sub: { margin: "0 0 8px", color: "#666", fontSize: 14 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "#333" },
  input: { padding: 10, border: "1px solid #ccc", borderRadius: 8, fontSize: 15 },
  btn: { padding: 12, border: "none", borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 700, cursor: "pointer", marginTop: 4 },
  foot: { fontSize: 13, color: "#666", textAlign: "center", margin: 0 },
};
