"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { escucharCambios } from "../lib/cambios";
import { COLOR, LABEL, SIGUIENTE, type EstadoPrep } from "../lib/estados";
import { estacionDe } from "../lib/estaciones";
import { CONFIG_COCINA_DEF, configCon, leerConfigModulo, type ConfigCocina } from "../lib/modulos";

interface Linea { nombre: string; cantidad: number; estacion: string | null; notas: string | null }
type Filtro = "COCINA" | "BARRA" | "CAMARERO" | "TODAS";
const FILTROS: { k: Filtro; label: string }[] = [
  { k: "COCINA", label: "Cocina" }, { k: "BARRA", label: "Barra" },
  { k: "CAMARERO", label: "Camarero" }, { k: "TODAS", label: "Todas" },
];
interface Pedido {
  id: string;
  numero_pedido: number | null;
  canal: string;
  estado_preparacion: EstadoPrep;
  created_at: string;
  order_line: Linea[];
  restaurant_table: { nombre: string } | null;
}

const minutos = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

// Beep corto (WebAudio, sin ficheros) al entrar una comanda nueva.
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => { void ctx.close(); };
  } catch {
    // Sin interacción previa el navegador puede bloquear el audio: silencio.
  }
}

export default function Cocina() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("COCINA");
  const [cfg, setCfg] = useState<ConfigCocina>(CONFIG_COCINA_DEF);
  // Refs para que `cargar` (capturada por el canal realtime) no quede obsoleta.
  const sonidoRef = useRef(CONFIG_COCINA_DEF.sonido);
  const idsRef = useRef<Set<string> | null>(null);
  // Re-render periódico para que los minutos y sus umbrales avancen solos.
  const [, setTick] = useState(0);

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from("sales_order")
      .select("id,numero_pedido,canal,estado_preparacion,created_at,order_line(nombre,cantidad,estacion,notas),restaurant_table(nombre)")
      .eq("estado", "ENVIADA_COCINA")
      .neq("estado_preparacion", "ENTREGADO")
      .order("created_at", { ascending: true });
    const rows = (data as unknown as Pedido[]) ?? [];
    setPedidos(rows);
    const previos = idsRef.current;
    if (previos && sonidoRef.current && rows.some((r) => !previos.has(r.id))) beep();
    idsRef.current = new Set(rows.map((r) => r.id));
  }, [sb]);

  useEffect(() => {
    let dejarDeEscuchar: (() => void) | undefined;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const c = configCon(CONFIG_COCINA_DEF, await leerConfigModulo(sb, "COCINA"));
      setCfg(c);
      sonidoRef.current = c.sonido;
      setFiltro(c.estacionDefecto);
      // Estación PROPIA del monitor (device.estacion, 0068): si esta pantalla se
      // emparejó (/conectar guarda gluuh_device), su estación manda sobre la global.
      try {
        const cred = JSON.parse(localStorage.getItem("gluuh_device") ?? "null") as { device_id?: string } | null;
        if (cred?.device_id) {
          const { data: dev } = await sb.from("device").select("estacion").eq("id", cred.device_id).maybeSingle();
          const est = (dev as { estacion: string | null } | null)?.estacion;
          if (est === "COCINA" || est === "BARRA" || est === "CAMARERO" || est === "TODAS") setFiltro(est);
        }
      } catch { /* sin identidad o sin la 0068: se queda la estación global */ }
      await cargar();
      setLoading(false);
      // SIN filtro de estado a propósito: con `filter: "estado=eq.ENVIADA_COCINA"` los
      // UPDATE que sacan un pedido de ese estado (COBRADA/ANULADA) no llegarían y la
      // comanda quedaría "zombi" en pantalla. El debounce ya colapsa la tormenta
      // (una venta dispara pedido + líneas + pago seguidos).
      dejarDeEscuchar = escucharCambios(sb, {
        nombre: "cocina",
        tablas: ["sales_order"],
        debounceMs: 500,
        onCambio: () => { void cargar(); },
      });
    })();
    return () => { dejarDeEscuchar?.(); };
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function avanzar(p: Pedido) {
    const sig = SIGUIENTE[p.estado_preparacion];
    if (!sig) return;
    await sb.from("sales_order").update({ estado_preparacion: sig }).eq("id", p.id);
    cargar();
  }

  if (loading) return (
    <div className="dark grid min-h-screen place-items-center bg-background text-muted-foreground">
      Cargando…
    </div>
  );

  const visibles = pedidos.filter((p) => filtro === "TODAS" || p.order_line.some((l) => estacionDe(l.estacion) === filtro));

  return (
    <div className={cfg.tema === "claro" ? "" : "dark"}>
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card px-6 py-3">
          <div className="flex items-center justify-between">
            <strong className="text-lg font-semibold tracking-tight">Preparación</strong>
            <span className="text-sm text-muted-foreground tabular-nums">{visibles.length} comandas · tiempo real</span>
          </div>
          <div className="mt-2 flex gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.k}
                onClick={() => setFiltro(f.k)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${filtro === f.k ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.length === 0 && (
            <p className="col-span-full text-muted-foreground">No hay comandas en {FILTROS.find((f) => f.k === filtro)?.label.toLowerCase()}.</p>
          )}
          {visibles.map((p) => {
            const titulo = p.restaurant_table?.nombre ?? (p.numero_pedido ? `A-${p.numero_pedido}` : "Pedido");
            const sig = SIGUIENTE[p.estado_preparacion];
            const lineas = filtro === "TODAS" ? p.order_line : p.order_line.filter((l) => estacionDe(l.estacion) === filtro);
            // Umbrales de espera (config): ámbar al avisar, rojo en crítico —
            // el borde entero cambia para leerse a 2 metros.
            const min = minutos(p.created_at);
            const nivel = min >= cfg.criticoMin ? "critico" : min >= cfg.avisoMin ? "aviso" : null;
            return (
              <div
                key={p.id}
                className={`rounded-lg border bg-card p-4 shadow-sm ${
                  nivel === "critico" ? "border-2 border-red-500"
                    : nivel === "aviso" ? "border-2 border-amber-500"
                    : "border-border"
                }`}
                style={nivel ? undefined : { borderTopColor: COLOR[p.estado_preparacion], borderTopWidth: 4 }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <strong className="text-lg font-semibold">{titulo}</strong>
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: COLOR[p.estado_preparacion] }}
                  >
                    {LABEL[p.estado_preparacion]}
                  </span>
                </div>
                <div className="mb-2 text-xs text-muted-foreground tabular-nums">
                  {p.canal} ·{" "}
                  <span
                    className={
                      nivel === "critico" ? "text-sm font-bold text-red-500"
                        : nivel === "aviso" ? "text-sm font-bold text-amber-500"
                        : undefined
                    }
                  >
                    hace {min} min
                  </span>
                </div>
                <ul className="mb-3 space-y-0.5 text-sm">
                  {lineas.map((l, i) => (
                    <li key={i}>
                      <b>{l.cantidad}×</b> {l.nombre}
                      {l.notas && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">✎ {l.notas}</span>}
                    </li>
                  ))}
                </ul>
                {sig && (
                  <button
                    onClick={() => avanzar(p)}
                    className="w-full rounded-md py-2 text-sm font-medium text-white"
                    style={{ background: COLOR[sig] }}
                  >
                    → {LABEL[sig]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
