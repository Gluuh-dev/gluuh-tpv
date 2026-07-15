"use client";

// LANZADOR DE INICIO (Gluuh Desktop) — estilo del mockup del cliente: oscuro morado, por
// tiles, táctil. Al abrir la app: elegir TPV (venta) o Configuración (backoffice). Son dos
// experiencias que comparten datos y SESIÓN.
//
// Dos logins, no confundir:
//  · TERMINAL (credencial del equipo, p.ej. tpv1/121212): el primer arranque del Electron.
//    Se hace una vez y queda recordado. Identifica el EQUIPO.
//  · OPERARIO (sesión): quién atiende. "Salir" cierra ESTA sesión y vuelve a /login.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bricolage_Grotesque } from "next/font/google";
import { supabaseBrowser } from "../lib/supabaseBrowser";

// next/font descarga y AUTO-ALOJA la fuente al compilar → no se baja de internet en el bar.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });

const MORADO = "#572370";
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
      if (!session) { router.replace("/login"); return; }
      const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
      setEmpresa(t?.nombre ?? "");
      setTerminal(window.gluuh?.device?.nombre ?? "");
      setNombre((session.user?.user_metadata?.nombre as string) ?? session.user?.email?.split("@")[0] ?? "");
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

  if (!listo) {
    return <div style={{ ...fondo, display: "grid", placeItems: "center", color: "#B9A5C6" }}>Cargando…</div>;
  }

  return (
    <main className={display.variable} style={fondo}>
      <div style={cont}>
        {/* Barra superior */}
        <header style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ ...plate, width: 46, height: 46 }}><Logo /></span>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "-.02em" }}>
                Gluuh <span style={{ color: "#B9A5C6", fontWeight: 600 }}>TPV</span>
              </div>
              {empresa && <div style={{ fontSize: 12, color: "#B9A5C6", letterSpacing: ".1em", textTransform: "uppercase" }}>{empresa}</div>}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {terminal && (
              <span style={chip}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3FD8A4", boxShadow: "0 0 0 4px rgba(63,216,164,.16)" }} />
                {terminal}
              </span>
            )}
            <span style={{ ...chip, fontVariantNumeric: "tabular-nums" }}>{reloj}</span>
            <button type="button" onClick={salir} style={{ ...chip, cursor: "pointer" }} title="Cerrar sesión">
              Salir ↩
            </button>
          </div>
        </header>

        {/* Saludo */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,2.4vw,30px)", fontWeight: 600, letterSpacing: "-.02em" }}>
            {saludo()}{nombre ? <>, <span style={{ color: "#D9BCEB" }}>{nombre}</span></> : null}
          </h2>
          <p style={{ color: "#B9A5C6", fontSize: 14, paddingBottom: 4 }}>Elige qué quieres abrir en este terminal.</p>
        </div>

        {/* Tiles */}
        <div style={rejilla}>
          {/* HERO: TPV */}
          <button type="button" onClick={() => router.push("/tpv")} style={{ ...tile, ...hero }}>
            <span style={{ ...plate, width: 74, height: 74, background: "rgba(255,255,255,.92)" }}><Carrito color={MORADO} /></span>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,3.2vw,42px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}>TPV</h3>
            <p style={{ color: "rgba(255,255,255,.82)", fontSize: 15, maxWidth: "28ch" }}>Abrir la pantalla de venta y empezar a cobrar.</p>
            <span style={go}>Entrar <span aria-hidden>→</span></span>
          </button>

          {/* Configuración */}
          <button type="button" onClick={() => router.push("/dashboard")} style={tile}>
            <span style={{ ...plate, background: "linear-gradient(150deg,#E3B7FF,#9A5BBE)" }}><Engranaje /></span>
            <h3 style={tituloTile}>Configuración</h3>
            <p style={pTile}>Carta, empleados, informes y ajustes del negocio.</p>
          </button>

          {/* Conectar otra pantalla */}
          <button type="button" onClick={() => router.push("/conectar")} style={tile}>
            <span style={{ ...plate, background: "linear-gradient(150deg,#54E3B1,#159C6E)" }}><Monitor /></span>
            <h3 style={tituloTile}>Conectar pantalla</h3>
            <p style={pTile}>Vincular otro TPV, comandera o pantalla de cocina.</p>
          </button>
        </div>

        <footer style={{ display: "flex", alignItems: "center", gap: 12, color: "#8C7599", fontSize: 12 }}>
          <span>Gluuh TPV</span>
          {terminal && <span>· terminal: {terminal}</span>}
        </footer>
      </div>
    </main>
  );
}

// ── iconos (línea, heredan color) ─────────────────────────────────────────────
const Ico = ({ children, color = "#fff" }: { children: React.ReactNode; color?: string }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Logo = () => <Ico><path d="M6 4h12v6a6 6 0 0 1-12 0V4z" /><path d="M12 16v4" /></Ico>;
const Carrito = ({ color }: { color: string }) => <Ico color={color}><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h2l2.4 12.4a1 1 0 0 0 1 .6h9.2a1 1 0 0 0 1-.8L21 7H5" /></Ico>;
const Engranaje = () => <Ico><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Ico>;
const Monitor = () => <Ico><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Ico>;

// ── estilos ───────────────────────────────────────────────────────────────────
const fondo: React.CSSProperties = {
  minHeight: "100vh",
  color: "#F6F1F9",
  fontFamily: 'var(--font-sans), system-ui, "Segoe UI", sans-serif',
  background: `radial-gradient(1100px 620px at 12% -8%, rgba(124,61,155,.45), transparent 60%), radial-gradient(900px 700px at 105% 110%, rgba(87,35,112,.55), transparent 62%), #150A1B`,
};
const cont: React.CSSProperties = {
  maxWidth: 1400, margin: "0 auto", minHeight: "100vh",
  display: "flex", flexDirection: "column", gap: 22, padding: "22px clamp(18px,3vw,40px)",
};
const plate: React.CSSProperties = {
  width: 52, height: 52, display: "grid", placeItems: "center", flex: "none",
  background: `linear-gradient(150deg,#7C3D9B,${MORADO})`, clipPath: ESCUDO,
};
const chip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 999,
  background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.10)",
  fontSize: 13, color: "#E9DEF1", whiteSpace: "nowrap",
};
const rejilla: React.CSSProperties = {
  flex: 1, display: "grid", gap: 16, gridTemplateColumns: "repeat(2, 1fr)", gridAutoRows: "minmax(180px, 1fr)",
};
const tile: React.CSSProperties = {
  position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer",
  borderRadius: 18, border: "1px solid rgba(255,255,255,.10)",
  background: "linear-gradient(165deg,#37194A,#200E2B)", color: "#F6F1F9",
  padding: 22, display: "flex", flexDirection: "column", gap: 10, font: "inherit",
};
const hero: React.CSSProperties = {
  gridColumn: "1 / -1", padding: 30,
  background: `linear-gradient(150deg,#8B45AC 0%, ${MORADO} 52%, #3B1650 100%)`,
  borderColor: "rgba(255,255,255,.18)",
};
const tituloTile: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-.01em" };
const pTile: React.CSSProperties = { fontSize: 13.5, color: "#B9A5C6", lineHeight: 1.45, maxWidth: "34ch" };
const go: React.CSSProperties = {
  alignSelf: "flex-start", marginTop: 8, display: "flex", alignItems: "center", gap: 10,
  background: "#fff", color: MORADO, padding: "12px 22px", borderRadius: 999, fontWeight: 700, fontSize: 15,
};
