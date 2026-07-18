"use client";

// EMPLEADOS dentro del TPV (F4.1 de docs/implementacion/17-tpv-perfecto.md).
// Versión táctil del mockup docs/diseño/gluuh-empleados.html: pestañas Lista/Ficha,
// con lo esencial para operar — alta con PIN (RPC crear_empleado), edición de datos,
// perfil, activo, cambio de PIN (RPC cambiar_pin) y pulsera (RPC asignar_pulsera).
// Reutiliza las mutaciones probadas del panel (app/(panel)/empleados). La seguridad
// real la pone la RLS/RPC del servidor; esta pantalla es operativa de local.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, KeyRound, Radio, Check } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { toast } from "@/app/lib/toast";
import { NavbarTPV, NavChip } from "../../components/NavbarTPV";

interface Empleado {
  id: string; nombre: string; codigo: string | null; usr_app: string | null;
  email: string | null; rol: string; activo: boolean; perfil_id: string | null;
  pulsera_hash: string | null;
}
interface Perfil { id: string; nombre: string }

const ROLES = ["CAMARERO", "ENCARGADO", "PROPIETARIO", "COCINA"];
const COLORES = ["#572370", "#0E9F6E", "#2F6FC4", "#F08A1D", "#C43C31"];
const colorDe = (id: string) => COLORES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES.length];
const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

export default function EmpleadosTPV() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [lista, setLista] = useState<Empleado[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<"lista" | "ficha">("lista");
  const [selId, setSelId] = useState<string | null>(null);
  const [alta, setAlta] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Borrador de la ficha (alta o edición).
  const [b, setB] = useState({ nombre: "", usr_app: "", email: "", rol: "CAMARERO", activo: true, perfil_id: null as string | null });
  const [pin, setPin] = useState("");
  const [pulsera, setPulsera] = useState("");

  const sel = useMemo(() => lista.find((e) => e.id === selId) ?? null, [lista, selId]);

  async function cargar() {
    const [emps, perf] = await Promise.all([
      sb.from("app_user").select("id,nombre,codigo,usr_app,email,rol,activo,perfil_id,pulsera_hash").order("nombre"),
      sb.from("perfil").select("id,nombre").order("nombre"),
    ]);
    setLista((emps.data as Empleado[]) ?? []);
    setPerfiles(perf.error ? [] : ((perf.data as Perfil[]) ?? []));
    setCargando(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, []);

  function abrirFicha(e: Empleado) {
    setSelId(e.id); setAlta(false);
    setB({ nombre: e.nombre, usr_app: e.usr_app ?? "", email: e.email ?? "", rol: e.rol, activo: e.activo, perfil_id: e.perfil_id });
    setPin(""); setPulsera("");
    setTab("ficha");
  }
  function abrirAlta() {
    setSelId(null); setAlta(true);
    setB({ nombre: "", usr_app: "", email: "", rol: "CAMARERO", activo: true, perfil_id: null });
    setPin(""); setPulsera("");
    setTab("ficha");
  }

  async function guardar() {
    if (!b.nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    try {
      if (alta) {
        if (pin.trim().length < 4) { toast.error("El PIN debe tener al menos 4 dígitos."); return; }
        const { data: nuevoId, error } = await sb.rpc("crear_empleado", {
          p_nombre: b.nombre.trim(), p_email: b.email.trim(), p_rol: b.rol, p_pin: pin.trim(),
        });
        if (error) { toast.error(error.message); return; }
        if (nuevoId && (b.usr_app.trim() || b.perfil_id)) {
          const extra: Record<string, unknown> = {};
          if (b.usr_app.trim()) extra.usr_app = b.usr_app.trim();
          if (b.perfil_id) extra.perfil_id = b.perfil_id;
          await sb.from("app_user").update(extra).eq("id", nuevoId as string);
        }
        toast.success(`Empleado «${b.nombre.trim()}» creado con su PIN.`);
      } else if (sel) {
        const { error } = await sb.from("app_user").update({
          nombre: b.nombre.trim(), usr_app: b.usr_app.trim() || null, email: b.email.trim() || null,
          rol: b.rol, activo: b.activo, perfil_id: b.perfil_id,
        }).eq("id", sel.id);
        if (error) { toast.error(error.message); return; }
        // Cambio de PIN opcional en edición (el hash lo hace el servidor).
        if (pin.trim()) {
          const { error: e2 } = await sb.rpc("cambiar_pin", { p_user_id: sel.id, p_pin: pin.trim() });
          if (e2) { toast.error(`Datos guardados, pero el PIN no: ${e2.message}`); await cargar(); return; }
        }
        toast.success(`Cambios de «${b.nombre.trim()}» guardados.`);
      }
      await cargar();
      setTab("lista"); setAlta(false); setPin("");
    } finally { setGuardando(false); }
  }

  async function guardarPulsera(quitar: boolean) {
    if (!sel) return;
    const { error } = await sb.rpc("asignar_pulsera", { p_user_id: sel.id, p_codigo: quitar ? "" : pulsera.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(quitar ? "Pulsera quitada." : "Pulsera asignada.");
    setPulsera("");
    await cargar();
  }

  const activos = lista.filter((e) => e.activo).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <NavbarTPV operario="Configuración" subtitulo="Empleados">
        <h1 className="flex-none whitespace-nowrap text-lg font-bold tracking-tight">Empleados</h1>
        <NavChip label="Activos">{activos} de {lista.length}</NavChip>
        <span className="flex-1" />
        <button type="button" onClick={() => router.push("/tpv")}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <ArrowLeft size={16} /> Volver al TPV
        </button>
      </NavbarTPV>

      {/* Pestañas Lista / Ficha (mockup) */}
      <div className="flex flex-none items-center gap-1 border-b border-border bg-card px-3 py-1.5">
        {(["lista", "ficha"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-selected={tab === t} role="tab"
            className={`min-h-11 rounded-md px-5 text-sm font-bold capitalize transition-colors ${tab === t ? "bg-brand text-white" : "text-muted-foreground hover:bg-accent"}`}>
            {t}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={abrirAlta}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-brand bg-brand px-4 text-sm font-bold text-white transition-all hover:bg-brand-hover active:scale-[.98]">
          <Plus size={16} /> Nuevo empleado
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "lista" ? (
          /* ══ LISTA: tabla como el mockup ══ */
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[70px_1fr_140px_130px_90px] gap-2 border-b border-border bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Código</span><span>Nombre</span><span>Rol</span><span>Perfil</span><span className="text-center">Estado</span>
            </div>
            {cargando && <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>}
            {!cargando && lista.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sin empleados. Crea el primero con «Nuevo empleado».</div>}
            <div className="divide-y divide-border">
              {lista.map((e) => (
                <button key={e.id} type="button" onClick={() => abrirFicha(e)}
                  className="grid w-full grid-cols-[70px_1fr_140px_130px_90px] items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent">
                  <span className="font-black tabular-nums text-muted-foreground">{e.codigo ?? "—"}</span>
                  <span className="flex min-w-0 items-center gap-2 font-bold">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-[10px] font-black text-white" style={{ background: colorDe(e.id) }}>{iniciales(e.nombre)}</span>
                    <span className="truncate">{e.nombre}</span>
                    {e.pulsera_hash && <Radio size={13} className="flex-none text-brand" aria-label="Con pulsera" />}
                  </span>
                  <span className="text-muted-foreground">{e.rol}</span>
                  <span className="truncate text-muted-foreground">{perfiles.find((p) => p.id === e.perfil_id)?.nombre ?? "—"}</span>
                  <span className="text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${e.activo ? "bg-success/15 text-success" : "bg-surface text-muted-foreground"}`}>{e.activo ? "Activo" : "Baja"}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ══ FICHA: datos + identificación ══ */
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full text-sm font-black text-white" style={{ background: sel ? colorDe(sel.id) : "#572370" }}>
                {alta ? "+" : iniciales(b.nombre || "?")}
              </span>
              <div>
                <b className="text-lg">{alta ? "Nuevo empleado" : b.nombre}</b>
                <div className="text-sm text-muted-foreground">{alta ? "Alta con PIN de acceso al TPV" : `Código ${sel?.codigo ?? "—"}`}</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Datos generales</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input value={b.nombre} onChange={(e) => setB((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nombre *" className="min-h-12 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand sm:col-span-2" />
                <input value={b.usr_app} onChange={(e) => setB((s) => ({ ...s, usr_app: e.target.value }))} placeholder="Usuario (opcional)" className="min-h-12 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                <input value={b.email} onChange={(e) => setB((s) => ({ ...s, email: e.target.value }))} placeholder="Email (opcional)" inputMode="email" className="min-h-12 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                <select value={b.rol} onChange={(e) => setB((s) => ({ ...s, rol: e.target.value }))} className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={b.perfil_id ?? ""} onChange={(e) => setB((s) => ({ ...s, perfil_id: e.target.value || null }))} className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                  <option value="">Perfil de permisos…</option>
                  {perfiles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <label className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm sm:col-span-2">
                  <input type="checkbox" checked={b.activo} onChange={(e) => setB((s) => ({ ...s, activo: e.target.checked }))} className="h-4 w-4 accent-(--brand)" />
                  <span className="font-semibold">Activo</span>
                  <span className="text-xs text-muted-foreground">— desmarcado no puede entrar al TPV</span>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><KeyRound size={13} /> Identificación</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder={alta ? "PIN (mín. 4 dígitos) *" : "Nuevo PIN (vacío = no cambiar)"} inputMode="numeric" maxLength={8}
                  className="min-h-12 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-brand" />
                {!alta && sel && (
                  <div className="flex gap-2">
                    <input value={pulsera} onChange={(e) => setPulsera(e.target.value)} placeholder={sel.pulsera_hash ? "Pulsera asignada · escanea otra" : "Escanea la pulsera…"}
                      className="min-h-12 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                    {pulsera.trim()
                      ? <button type="button" onClick={() => { void guardarPulsera(false); }} className="min-h-12 rounded-md border border-brand bg-brand/10 px-3 text-sm font-bold text-brand">Asignar</button>
                      : sel.pulsera_hash && <button type="button" onClick={() => { void guardarPulsera(true); }} className="min-h-12 rounded-md border border-danger bg-card px-3 text-sm font-bold text-danger">Quitar</button>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => { setTab("lista"); setAlta(false); }} className="min-h-13 rounded-md border border-border bg-card px-5 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">Cancelar</button>
              <span className="flex-1" />
              <button type="button" disabled={guardando} onClick={() => { void guardar(); }}
                className="flex min-h-13 items-center gap-2 rounded-md bg-brand px-8 text-base font-bold text-white transition-all hover:bg-brand-hover active:scale-[.98] disabled:opacity-50">
                <Check size={18} /> {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
