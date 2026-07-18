"use client";

// MANTENIMIENTO DE TERMINALES dentro del TPV (mockup gluuh-mantenimiento-terminales):
// lista de dispositivos (`device`) con su estado (en línea = latido < 2 min), y
// edición de nombre/estación. El ALTA de terminales (código de vinculación) se hace
// desde el panel — depende de /api/dispositivos/generar (ver AHORA.md: hook de
// claims pendiente), así que aquí no se duplica un camino roto.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MonitorSmartphone, Wifi, WifiOff } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { toast } from "@/app/lib/toast";
import { NavbarTPV, NavChip } from "../../components/NavbarTPV";

interface Disp {
  id: string; nombre: string | null; tipo: string | null; modulo: string | null;
  estacion: string | null; vinculado_at: string | null; ultima_conexion: string | null; version: string | null;
}

const enLinea = (d: Disp) => !!d.ultima_conexion && Date.now() - new Date(d.ultima_conexion).getTime() < 2 * 60_000;

export default function TerminalesTPV() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [lista, setLista] = useState<Disp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<Disp | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await sb.from("device")
      .select("id,nombre,tipo,modulo,estacion,vinculado_at,ultima_conexion,version")
      .order("nombre");
    setLista((data as Disp[]) ?? []);
    setCargando(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); const t = setInterval(() => { void cargar(); }, 30_000); return () => clearInterval(t); }, []);

  async function guardar() {
    if (!sel) return;
    setGuardando(true);
    const { error } = await sb.from("device").update({ nombre: sel.nombre?.trim() || null, estacion: sel.estacion || null }).eq("id", sel.id);
    setGuardando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Terminal guardado.");
    setSel(null);
    await cargar();
  }

  const conectados = lista.filter(enLinea).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <NavbarTPV operario="Configuración" subtitulo="Terminales">
        <h1 className="flex-none text-lg font-bold tracking-tight">Terminales</h1>
        <NavChip label="En línea">{conectados} de {lista.length}</NavChip>
        <span className="flex-1" />
        <button type="button" onClick={() => router.push("/tpv/config")}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <ArrowLeft size={16} /> Configuración
        </button>
      </NavbarTPV>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-3">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[36px_1fr_120px_110px_110px] gap-2 border-b border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span /><span>Nombre</span><span>Módulo</span><span>Estación</span><span className="text-center">Estado</span>
          </div>
          {cargando && <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>}
          {!cargando && lista.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sin dispositivos vinculados. El alta se hace desde el panel (Dispositivos).</div>}
          <div className="divide-y divide-border">
            {lista.map((d) => (
              <button key={d.id} type="button" onClick={() => setSel({ ...d })}
                className={`grid w-full grid-cols-[36px_1fr_120px_110px_110px] items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${sel?.id === d.id ? "bg-brand/5" : ""}`}>
                <MonitorSmartphone size={18} className="text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{d.nombre ?? "Sin nombre"}</span>
                  <span className="text-xs text-muted-foreground">{d.tipo ?? "—"}{d.version ? ` · v${d.version}` : ""}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{d.modulo ?? "—"}</span>
                <span className="truncate text-xs text-muted-foreground">{d.estacion ?? "—"}</span>
                <span className="text-center">
                  {enLinea(d)
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase text-success"><Wifi size={11} /> En línea</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground"><WifiOff size={11} /> {d.ultima_conexion ? new Date(d.ultima_conexion).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Nunca"}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {sel && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
            <input value={sel.nombre ?? ""} onChange={(e) => setSel((s) => s && { ...s, nombre: e.target.value })} placeholder="Nombre del terminal"
              className="min-h-12 min-w-48 flex-1 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-brand" />
            <select value={sel.estacion ?? ""} onChange={(e) => setSel((s) => s && { ...s, estacion: e.target.value })}
              className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
              <option value="">Sin estación</option>
              <option value="COCINA">Cocina</option>
              <option value="BARRA">Barra</option>
            </select>
            <button type="button" onClick={() => setSel(null)} className="min-h-12 rounded-md border border-border bg-card px-4 text-sm font-semibold hover:bg-accent">Cancelar</button>
            <button type="button" disabled={guardando} onClick={() => { void guardar(); }}
              className="flex min-h-12 items-center gap-2 rounded-md bg-brand px-5 text-sm font-bold text-white transition-all hover:bg-brand-hover disabled:opacity-50">
              <Check size={16} /> Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
