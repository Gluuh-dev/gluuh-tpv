"use client";

// LANZADOR DE INICIO (Gluuh Desktop) — tema CLARO, mismo lenguaje visual que el TPV y el
// cobro (paneles blancos, líneas finas, morado Gluuh de acento). Por tiles, táctil.
//
// Dos logins, no confundir:
//  · TERMINAL (credencial del equipo, p.ej. tpv1/121212): el primer arranque del Electron.
//  · OPERARIO (sesión): quién atiende. "Salir" cierra ESTA sesión y vuelve a /login.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque } from "next/font/google";
import { supabaseBrowser } from "../lib/supabaseBrowser";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });

const GLUUH = "#572370";
const ESCUDO = "polygon(50% 0%, 100% 22%, 88% 88%, 50% 100%, 12% 88%, 0% 22%)";

function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 14) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export default function Inicio() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [terminal, setTerminal] = useState("");
  const [nombre, setNombre] = useState("");
  const [reloj, setReloj] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      // Un terminal EMPAREJADO no necesita sesión para ver el lanzador: el
      // emparejado identifica al EQUIPO. La sesión (una vez, usuario+clave con
      // "recordar") se pide al entrar en TPV/Configuración; los trabajadores
      // después solo teclean su PIN. Sin emparejar y sin sesión → /login.
      const emparejado = Boolean(window.gluuh?.device);
      if (!session && !emparejado) { router.replace("/login"); return; }
      if (session) {
        const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
        setEmpresa(t?.nombre ?? "");
        setNombre((session.user?.user_metadata?.nombre as string) ?? session.user?.email?.split("@")[0] ?? "");
      }
      setTerminal(window.gluuh?.device?.nombre ?? "");
      setListo(true);
    })();
  }, [router]);

  useEffect(() => {
    const tic = () => setReloj(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
    tic();
    const id = setInterval(tic, 30_000);
    return () => clearInterval(id);
  }, []);

  async function salir() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (!listo) return <div style={{ ...fondo, display: "grid", placeItems: "center", color: "#8A93A3" }}>Cargando…</div>;

  return (
    <main className={display.variable} style={fondo}>
      <div style={cont}>
        {/* Cabecera */}
        <header style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ ...plate, width: 46, height: 46, background: `linear-gradient(150deg,#7C3D9B,${GLUUH})` }}><Logo /></span>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "-.02em", color: "#1E2430" }}>
                Gluuh <span style={{ color: "#8A93A3", fontWeight: 700 }}>TPV</span>
              </div>
              {empresa && <div style={{ fontSize: 12, color: "#8A93A3", letterSpacing: ".08em", textTransform: "uppercase" }}>{empresa}</div>}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {terminal && (
              <span style={chip}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0E9F6E" }} />
                {terminal}
              </span>
            )}
            <span style={{ ...chip, fontVariantNumeric: "tabular-nums" }}>{reloj}</span>
            <button type="button" onClick={salir} style={{ ...chip, cursor: "pointer", color: "#D64545", borderColor: "#F2CFCF" }} title="Cerrar sesión">
              Salir ↩
            </button>
          </div>
        </header>

        {/* Saludo */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,2.4vw,30px)", fontWeight: 700, letterSpacing: "-.02em", color: "#1E2430" }}>
            {saludo()}{nombre ? <>, <span style={{ color: GLUUH }}>{nombre}</span></> : null}
          </h2>
          <p style={{ color: "#8A93A3", fontSize: 14, paddingBottom: 4 }}>Elige qué quieres abrir en este terminal.</p>
        </div>

        {/* Tiles */}
        <div style={rejilla}>
          <button type="button" onClick={() => router.push("/tpv")} style={{ ...tile, ...hero }}>
            <span style={{ ...plate, width: 74, height: 74, background: "#fff" }}><Carrito color={GLUUH} /></span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,3.2vw,42px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, color: "#fff" }}>TPV</h3>
            <p style={{ color: "rgba(255,255,255,.9)", fontSize: 15, maxWidth: "28ch" }}>Abrir la pantalla de venta y empezar a cobrar.</p>
            <span style={go}>Entrar <span aria-hidden>→</span></span>
          </button>

          <button type="button" onClick={() => router.push("/dashboard")} style={tile}>
            <span style={{ ...plate, background: "linear-gradient(150deg,#EBD7F7,#B98BD6)" }}><Engranaje color={GLUUH} /></span>
            <h3 style={tituloTile}>Configuración</h3>
            <p style={pTile}>Carta, empleados, informes y ajustes del negocio.</p>
          </button>

          <button type="button" onClick={() => router.push("/conectar")} style={tile}>
            <span style={{ ...plate, background: "linear-gradient(150deg,#CFF3E6,#7FD8B6)" }}><Monitor color="#0E9F6E" /></span>
            <h3 style={tituloTile}>Conectar pantalla</h3>
            <p style={pTile}>Vincular otro TPV, comandera o pantalla de cocina.</p>
          </button>
        </div>

        <footer style={{ display: "flex", alignItems: "center", gap: 12, color: "#A6ADBA", fontSize: 12 }}>
          <span>Gluuh TPV</span>
          {terminal && <span>· terminal: {terminal}</span>}
        </footer>
      </div>
    </main>
  );
}

// ── iconos ────────────────────────────────────────────────────────────────────
const Ico = ({ children, color = "#fff" }: { children: React.ReactNode; color?: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Logo = () => <Ico><path d="M6 4h12v6a6 6 0 0 1-12 0V4z" /><path d="M12 16v4" /></Ico>;
const Carrito = ({ color }: { color: string }) => <Ico color={color}><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.4 12.4a1 1 0 0 0 1 .6h9.2a1 1 0 0 0 1-.8L21 7H5" /></Ico>;
const Engranaje = ({ color }: { color: string }) => <Ico color={color}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Ico>;
const Monitor = ({ color }: { color: string }) => <Ico color={color}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Ico>;

// ── estilos (tema CLARO, paleta del cobro) ────────────────────────────────────
const fondo: React.CSSProperties = {
  minHeight: "100vh",
  color: "#1E2430",
  fontFamily: 'var(--font-sans), system-ui, "Segoe UI", sans-serif',
  background: "radial-gradient(1100px 620px at 12% -8%, rgba(124,61,155,.08), transparent 60%), radial-gradient(900px 700px at 105% 110%, rgba(87,35,112,.07), transparent 62%), #F1F2F5",
};
const cont: React.CSSProperties = {
  maxWidth: 1400, margin: "0 auto", minHeight: "100vh",
  display: "flex", flexDirection: "column", gap: 22, padding: "22px clamp(18px,3vw,40px)",
};
const plate: React.CSSProperties = {
  width: 52, height: 52, display: "grid", placeItems: "center", flex: "none",
  background: `linear-gradient(150deg,#7C3D9B,${GLUUH})`, clipPath: ESCUDO,
};
const chip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 999,
  background: "#fff", border: "1px solid #E1E5EA", fontSize: 13, color: "#4A5262", whiteSpace: "nowrap",
};
const rejilla: React.CSSProperties = {
  flex: 1, display: "grid", gap: 16, gridTemplateColumns: "repeat(2, 1fr)", gridAutoRows: "minmax(180px, 1fr)",
};
const tile: React.CSSProperties = {
  position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer",
  borderRadius: 16, border: "1px solid #E1E5EA", background: "#fff", color: "#1E2430",
  padding: 22, display: "flex", flexDirection: "column", gap: 10, font: "inherit",
  boxShadow: "0 1px 2px rgba(30,36,48,.04)",
};
const hero: React.CSSProperties = {
  gridColumn: "1 / -1", padding: 30,
  background: `linear-gradient(150deg,#8B45AC 0%, ${GLUUH} 55%, #3B1650 100%)`,
  borderColor: "transparent",
};
const tituloTile: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-.01em", color: "#1E2430" };
const pTile: React.CSSProperties = { fontSize: 13.5, color: "#8A93A3", lineHeight: 1.45, maxWidth: "34ch" };
const go: React.CSSProperties = {
  alignSelf: "flex-start", marginTop: 8, display: "flex", alignItems: "center", gap: 10,
  background: "#fff", color: GLUUH, padding: "12px 22px", borderRadius: 999, fontWeight: 700, fontSize: 15,
};
