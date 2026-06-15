"use client";

import { useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function Registro() {
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; msg: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setEstado(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { empresa_nombre: empresa } },
    });
    setCargando(false);
    if (error) setEstado({ tipo: "error", msg: error.message });
    else
      setEstado({
        tipo: "ok",
        msg: "¡Empresa creada! Si la confirmación de correo está activada, revisa tu email; si no, ya puedes iniciar sesión.",
      });
  }

  return (
    <main style={S.wrap}>
      <form style={S.card} onSubmit={onSubmit}>
        <h1 style={S.h1}>Crear cuenta de empresa</h1>
        <p style={S.sub}>Gluuh TPV · una cuenta por restaurante</p>
        <label style={S.label}>Nombre de la empresa
          <input style={S.input} value={empresa} onChange={(e) => setEmpresa(e.target.value)} required placeholder="Bar La Palma" />
        </label>
        <label style={S.label}>Email
          <input style={S.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@tubar.com" />
        </label>
        <label style={S.label}>Contraseña
          <input style={S.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <button style={S.btn} disabled={cargando}>{cargando ? "Creando…" : "Crear empresa"}</button>
        {estado && <p style={{ color: estado.tipo === "ok" ? "#16a34a" : "#dc2626", fontSize: 14 }}>{estado.msg}</p>}
        <p style={S.foot}>¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
      </form>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 24 },
  card: { display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 380, border: "1px solid #e5e5e5", borderRadius: 16, padding: 24 },
  h1: { margin: 0, fontSize: 22 },
  sub: { margin: "0 0 8px", color: "#666", fontSize: 14 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "#333" },
  input: { padding: 10, border: "1px solid #ccc", borderRadius: 8, fontSize: 15 },
  btn: { padding: 12, border: "none", borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 700, cursor: "pointer", marginTop: 4 },
  foot: { fontSize: 13, color: "#666", textAlign: "center", margin: 0 },
};
