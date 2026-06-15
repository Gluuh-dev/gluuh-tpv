"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

interface Info {
  email: string;
  empresa: string | null;
  plan: string | null;
  rol: string | null;
}

export default function Panel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setCargando(false); return; }
      // RLS: estas consultas solo devuelven datos de SU empresa.
      const { data: tenant } = await sb.from("tenant").select("nombre,plan").limit(1).maybeSingle();
      const { data: user } = await sb.from("app_user").select("rol").eq("auth_user_id", session.user.id).maybeSingle();
      setInfo({
        email: session.user.email ?? "",
        empresa: tenant?.nombre ?? null,
        plan: tenant?.plan ?? null,
        rol: user?.rol ?? null,
      });
      setCargando(false);
    })();
  }, []);

  async function salir() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  if (cargando) return <main style={S.wrap}><p>Cargando…</p></main>;
  if (!info) return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h1 style={S.h1}>No has iniciado sesión</h1>
        <a style={S.btn} href="/login">Iniciar sesión</a>
      </div>
    </main>
  );

  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h1 style={S.h1}>Panel de {info.empresa ?? "tu empresa"}</h1>
        <p style={S.row}><b>Empresa:</b> {info.empresa ?? "—"} ({info.plan ?? "—"})</p>
        <p style={S.row}><b>Usuario:</b> {info.email}</p>
        <p style={S.row}><b>Rol:</b> {info.rol ?? "—"}</p>
        <p style={{ color: "#16a34a", fontSize: 14 }}>✅ Sesión activa · solo ves los datos de tu empresa (RLS).</p>
        <button style={S.btnSec} onClick={salir}>Cerrar sesión</button>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 24 },
  card: { display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 420, border: "1px solid #e5e5e5", borderRadius: 16, padding: 24 },
  h1: { margin: "0 0 8px", fontSize: 22 },
  row: { margin: 0, fontSize: 15 },
  btn: { padding: 12, border: "none", borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 700, textAlign: "center", textDecoration: "none", marginTop: 8 },
  btnSec: { padding: 10, border: "1px solid #ccc", borderRadius: 10, background: "#fff", cursor: "pointer", marginTop: 12 },
};
