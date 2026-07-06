"use client";

// Pantalla de inicio de Gluuh Desktop: al abrir la app en el PC, elegir entre
// ir a CONFIGURACIÓN (backoffice) o al TPV (venta). Son dos experiencias
// distintas que comparten datos y sesión.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Settings, MonitorSmartphone, LogOut } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function Inicio() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState("");
  const [terminal, setTerminal] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
      setEmpresa(t?.nombre ?? "");
      setTerminal(window.gluuh?.device?.nombre ?? "");
      setListo(true);
    })();
  }, [router]);

  async function salir() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (!listo) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>;

  return (
    <main className="flex min-h-screen flex-col bg-background p-6 text-foreground">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-bold text-white">G</span>
          Gluuh <span className="text-muted-foreground">TPV</span>
          {empresa && <span className="ml-2 text-sm text-muted-foreground">· {empresa}</span>}
        </div>
        <button type="button" onClick={salir} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <LogOut size={15} /> Salir
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/tpv")}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 shadow-sm transition-colors hover:border-brand hover:bg-brand/5"
          >
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-brand text-white transition-transform group-hover:scale-105">
              <ShoppingCart size={38} strokeWidth={1.5} />
            </span>
            <span className="text-xl font-semibold">TPV</span>
            <span className="text-center text-sm text-muted-foreground">Abrir la pantalla de venta y empezar a cobrar.</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 shadow-sm transition-colors hover:border-brand hover:bg-brand/5"
          >
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-surface-overlay text-foreground transition-transform group-hover:scale-105">
              <Settings size={38} strokeWidth={1.5} />
            </span>
            <span className="text-xl font-semibold">Configuración</span>
            <span className="text-center text-sm text-muted-foreground">Carta, empleados, informes y ajustes del negocio.</span>
          </button>
        </div>
      </div>

      <footer className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        {terminal && <span className="flex items-center gap-1.5"><MonitorSmartphone size={14} /> {terminal}</span>}
        <button type="button" onClick={() => router.push("/conectar")} className="hover:text-foreground">Conectar otra pantalla</button>
      </footer>
    </main>
  );
}
