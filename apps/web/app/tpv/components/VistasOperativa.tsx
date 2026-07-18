"use client";

// Vistas operativas del TPV bajo el rail de salas: RESERVAS, PARA LLEVAR y
// CUENTAS APARCADAS — fieles a docs/diseño/gluuh-reservas.html,
// gluuh-para-llevar.html y gluuh-cuentas-aparcadas.html, pero SIN su cabecera
// propia: el navbar es el rail del TPV (mismo grosor y color), para que parezca
// que no has salido del TPV. Patrón común: toolbar fina + lista (izq) + detalle
// (der). Los datos vienen de Supabase (reservation / sales_order); columnas
// nuevas de la migración 0125. Skill: gluuh-ux-operativa.
import { useEffect, useMemo, useState } from "react";
import {
  Phone, Globe, User, Store, CalendarCheck, Clock, Search, Plus, Printer,
  ChevronLeft, ChevronRight, AlertTriangle, Check, Bike, ShoppingBag, Flame,
  Eye, Users, PencilLine, Trash2, Euro, FileText, RotateCcw, Merge, Grid2x2,
} from "lucide-react";
import { eur } from "@/app/lib/money";
import { toast } from "@/app/lib/toast";

/* ═════════ helpers comunes ═════════ */

const HH = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const hm = (min: number) => { const m = Math.abs(Math.round(min)); return (m >= 60 ? `${Math.floor(m / 60)} h ` : "") + `${m % 60} min`; };

function Chip({ texto, tono }: Readonly<{ texto: string; tono: "gris" | "verde" | "ambar" | "rojo" | "brand" | "azul" }>) {
  const c = {
    gris: "bg-surface text-muted-foreground",
    verde: "bg-success/15 text-success",
    ambar: "bg-warning/15 text-warning",
    rojo: "bg-danger/15 text-danger",
    brand: "bg-brand/15 text-brand",
    azul: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  }[tono];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${c}`}>{texto}</span>;
}

function IconoCanal({ canal, size = 14 }: Readonly<{ canal: string | null; size?: number }>) {
  const c = (canal ?? "").toUpperCase();
  if (c.includes("TEL")) return <Phone size={size} />;
  if (c.includes("WEB") || c.includes("ONLINE")) return <Globe size={size} />;
  if (c.includes("PERSONA")) return <User size={size} />;
  return <Store size={size} />;
}

function Buscador({ q, setQ, placeholder }: Readonly<{ q: string; setQ: (v: string) => void; placeholder: string }>) {
  return (
    <label className="flex min-h-10 min-w-52 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 lg:max-w-72">
      <Search size={15} className="flex-none text-muted-foreground" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
  );
}

/* Estructura común: toolbar + lista/detalle. Cabeceras como banda gris cuadrada
   (estilo mockup) y, con `listaPlana`, la lista va a ras de bordes (tabla). */
function Marco({ toolbar, lista, detalle, tituloLista, nLista, tituloDetalle, listaPlana }: Readonly<{
  toolbar: React.ReactNode; lista: React.ReactNode; detalle: React.ReactNode; tituloLista: string; nLista: string; tituloDetalle: string; listaPlana?: boolean;
}>) {
  const banda = "flex flex-none items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5">{toolbar}</div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 p-2.5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className={banda}>
            {tituloLista} <span className="ml-auto text-[11px] font-semibold normal-case tracking-normal">{nLista}</span>
          </h2>
          <div className={`min-h-0 flex-1 overflow-y-auto ${listaPlana ? "" : "px-3 pb-3 pt-2"}`}>{lista}</div>
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className={banda}>{tituloDetalle}</h2>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{detalle}</div>
        </section>
      </div>
    </div>
  );
}

const Vacio = ({ titulo, texto }: { titulo: string; texto: string }) => (
  <div className="grid h-full place-items-center p-8 text-center text-muted-foreground">
    <div><b className="block text-sm text-foreground">{titulo}</b><span className="text-xs">{texto}</span></div>
  </div>
);

function BotonAccion({ onClick, tono = "gris", children, title }: Readonly<{ onClick: () => void; tono?: "gris" | "verde" | "ambar" | "rojo" | "brand"; children: React.ReactNode; title?: string }>) {
  const c = {
    gris: "border-border bg-card hover:bg-accent",
    verde: "border-success bg-success/10 text-success hover:bg-success/20",
    ambar: "border-warning bg-warning/10 text-warning hover:bg-warning/20",
    rojo: "border-danger bg-danger/10 text-danger hover:bg-danger/20",
    brand: "border-brand bg-brand text-white hover:bg-brand-hover",
  }[tono];
  return (
    <button type="button" onClick={onClick} title={title} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-bold transition-all active:scale-[.98] ${c}`}>
      {children}
    </button>
  );
}

/* ═════════════════════════ RESERVAS ═════════════════════════ */

interface Rsv {
  id: string; fecha_hora: string; comensales: number; estado: string; notas: string | null;
  nombre: string | null; table_id: string | null; telefono: string | null; canal: string | null; alergias: string | null;
}
interface MesaMin { id: string; nombre: string; capacidad?: number | null }

const RSV_ESTADOS: Record<string, { nombre: string; tono: "gris" | "verde" | "ambar" | "rojo" | "brand" | "azul" }> = {
  PENDIENTE: { nombre: "Sin confirmar", tono: "ambar" },
  CONFIRMADA: { nombre: "Confirmada", tono: "verde" },
  SENTADA: { nombre: "Sentada", tono: "brand" },
  NO_SHOW: { nombre: "No vino", tono: "rojo" },
  CANCELADA: { nombre: "Cancelada", tono: "gris" },
  TERMINADA: { nombre: "Terminada", tono: "gris" },
};
const rsvActiva = (r: Rsv) => ["PENDIENTE", "CONFIRMADA", "SENTADA"].includes(r.estado);
/* Lo que se estima que ocupan la mesa, para detectar solapes. */
const durRsv = (r: Rsv) => (r.comensales > 6 ? 150 : r.comensales > 4 ? 120 : 90);

export function ReservasVista({ sb, locationId, mesas, onCambio }: Readonly<{
  sb: any; locationId: string | null; mesas: MesaMin[]; onCambio?: () => void;
}>) {
  const [dia, setDia] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [turno, setTurno] = useState<"comida" | "cena" | "todo">(() => (new Date().getHours() < 17 ? "comida" : "cena"));
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Rsv[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Rsv> & { hora?: string } | null>(null);
  const [confBorrar, setConfBorrar] = useState(false);

  const esHoy = dia.toDateString() === new Date().toDateString();
  const aforo = useMemo(() => mesas.reduce((s, m) => s + (Number(m.capacidad) || 0), 0), [mesas]);
  const mesaDe = (id: string | null) => mesas.find((m) => m.id === id);

  async function cargar() {
    const fin = new Date(dia); fin.setDate(fin.getDate() + 1);
    const { data } = await sb.from("reservation")
      .select("id,fecha_hora,comensales,estado,notas,nombre,table_id,telefono,canal,alergias")
      .gte("fecha_hora", dia.toISOString()).lt("fecha_hora", fin.toISOString())
      .order("fecha_hora");
    setLista((data as Rsv[]) ?? []);
  }
  // Reservas de días ANTERIORES sin cerrar: se cierran solas al abrir la vista
  // (no se quedan puestas). Sentada → Terminada; sin sentar → No vino. Idempotente.
  useEffect(() => {
    void (async () => {
      const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
      await sb.from("reservation").update({ estado: "TERMINADA" })
        .lt("fecha_hora", hoy0.toISOString()).eq("estado", "SENTADA");
      await sb.from("reservation").update({ estado: "NO_SHOW" })
        .lt("fecha_hora", hoy0.toISOString()).in("estado", ["PENDIENTE", "CONFIRMADA"]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); setSelId(null); setForm(null); }, [dia]);

  const turnoDe = (r: Rsv) => (new Date(r.fecha_hora).getHours() < 17 ? "comida" : "cena");
  const filtradas = lista.filter((r) => {
    if (turno !== "todo" && turnoDe(r) !== turno) return false;
    const t = q.trim().toLowerCase();
    if (t) return (r.nombre ?? "").toLowerCase().includes(t) || (r.telefono ?? "").replace(/\s/g, "").includes(t.replace(/\s/g, ""));
    return true;
  });
  const sel = filtradas.find((r) => r.id === selId) ?? lista.find((r) => r.id === selId) ?? null;

  /* Aforo del turno visible */
  const activas = filtradas.filter(rsvActiva);
  const cubiertos = activas.reduce((s, r) => s + r.comensales, 0);
  const sentados = activas.filter((r) => r.estado === "SENTADA").reduce((s, r) => s + r.comensales, 0);

  /* Avisos por reserva */
  const tarde = (r: Rsv) => esHoy && r.estado === "CONFIRMADA" && (Date.now() - new Date(r.fecha_hora).getTime()) / 60000 > 15;
  const corta = (r: Rsv) => { const m = mesaDe(r.table_id); return !!m && (Number(m.capacidad) || 99) < r.comensales; };
  const solapa = (r: Rsv) => {
    if (!r.table_id || !rsvActiva(r)) return false;
    const a1 = new Date(r.fecha_hora).getTime(), a2 = a1 + durRsv(r) * 60000;
    return lista.some((o) => o.id !== r.id && o.table_id === r.table_id && rsvActiva(o)
      && a1 < new Date(o.fecha_hora).getTime() + durRsv(o) * 60000 && a2 > new Date(o.fecha_hora).getTime());
  };

  // OPTIMISTA: el cambio se pinta al toque; si el servidor falla, se revierte.
  async function cambiarEstado(r: Rsv, estado: string) {
    const antes = lista;
    setLista((prev) => prev.map((x) => (x.id === r.id ? { ...x, estado } : x)));
    const { error } = await sb.from("reservation").update({ estado }).eq("id", r.id);
    if (error) { setLista(antes); toast.error("No se pudo actualizar la reserva."); return; }
    onCambio?.();
  }
  async function borrar(r: Rsv) {
    await sb.from("reservation").delete().eq("id", r.id);
    setSelId(null); setConfBorrar(false);
    await cargar(); onCambio?.();
  }
  async function guardarForm() {
    if (!form) return;
    const [h, m] = (form.hora ?? "20:00").split(":").map(Number);
    const fh = new Date(dia); fh.setHours(h ?? 20, m ?? 0, 0, 0);
    const datos = {
      nombre: form.nombre?.trim() || null,
      telefono: form.telefono?.trim() || null,
      comensales: Math.max(1, Number(form.comensales) || 2),
      table_id: form.table_id || null,
      canal: form.canal || null,
      alergias: form.alergias?.trim() || null,
      notas: form.notas?.trim() || null,
      fecha_hora: fh.toISOString(),
    };
    const { error } = form.id
      ? await sb.from("reservation").update(datos).eq("id", form.id)
      : await sb.from("reservation").insert({ location_id: locationId, estado: "CONFIRMADA", ...datos });
    if (error) { toast.error("No se pudo guardar la reserva."); return; }
    setForm(null);
    await cargar(); onCambio?.();
  }

  const fechaLarga = dia.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Marco
      tituloLista="Reservas del turno"
      nLista={`${filtradas.length} ${filtradas.length === 1 ? "reserva" : "reservas"}`}
      tituloDetalle={form ? (form.id ? "Editar reserva" : "Nueva reserva") : "Detalle"}
      toolbar={<>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          <button type="button" aria-label="Día anterior" onClick={() => setDia((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })} className="grid h-9 w-9 place-items-center rounded transition-colors hover:bg-accent"><ChevronLeft size={16} /></button>
          <b className="px-2 text-sm capitalize">{esHoy ? "Hoy · " : ""}{fechaLarga}</b>
          <button type="button" aria-label="Día siguiente" onClick={() => setDia((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })} className="grid h-9 w-9 place-items-center rounded transition-colors hover:bg-accent"><ChevronRight size={16} /></button>
          {!esHoy && <button type="button" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDia(d); }} className="rounded px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand/10">Hoy</button>}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {(["comida", "cena", "todo"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTurno(t)} aria-pressed={turno === t}
              className={`rounded px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${turno === t ? "bg-brand text-white" : "text-muted-foreground hover:bg-accent"}`}>{t}</button>
          ))}
        </div>
        <Buscador q={q} setQ={setQ} placeholder="Nombre o teléfono…" />
        {/* Aforo del turno */}
        {aforo > 0 && (
          <div className="flex min-w-44 items-center gap-2" title={`Sentados ${sentados} · por venir ${cubiertos - sentados} · aforo ${aforo}`}>
            <Users size={15} className="flex-none text-muted-foreground" />
            <div className="h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-border">
              <div className="flex h-full">
                <div className="bg-brand" style={{ width: `${Math.min(100, (sentados / aforo) * 100)}%` }} />
                <div className="bg-warning" style={{ width: `${Math.min(100 - (sentados / aforo) * 100, ((cubiertos - sentados) / aforo) * 100)}%` }} />
              </div>
            </div>
            <b className="text-xs tabular-nums">{cubiertos}/{aforo}</b>
          </div>
        )}
        <BotonAccion tono="brand" onClick={() => { setForm({ hora: "20:00", comensales: 2 }); setSelId(null); }}><Plus size={16} /> Nueva reserva</BotonAccion>
      </>}
      lista={<>
        {filtradas.length === 0 && <Vacio titulo="Sin reservas" texto="No hay reservas con ese filtro para este día." />}
        <div className="flex flex-col gap-1.5">
          {filtradas.map((r) => {
            const e = RSV_ESTADOS[r.estado] ?? { nombre: r.estado, tono: "gris" as const };
            const inactiva = !rsvActiva(r);
            return (
              <button key={r.id} type="button" onClick={() => { setSelId(r.id); setForm(null); setConfBorrar(false); }}
                className={`grid grid-cols-[52px_1fr_auto] items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all active:scale-[.995] ${selId === r.id ? "border-brand bg-brand/5" : "border-border bg-background hover:border-border-strong hover:bg-accent"} ${inactiva ? "opacity-55" : ""}`}>
                <span className="rounded bg-surface px-1.5 py-1 text-center text-sm font-black tabular-nums">{HH(r.fecha_hora)}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 truncate text-sm font-bold">
                    <IconoCanal canal={r.canal} /> {r.nombre ?? "Sin nombre"}
                    <span className="font-medium text-muted-foreground">· {r.comensales} pax</span>
                    {r.table_id && <span className="font-semibold text-brand">· {mesaDe(r.table_id)?.nombre ?? "Mesa"}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1">
                    {tarde(r) && <Chip texto={`Tarde ${hm((Date.now() - new Date(r.fecha_hora).getTime()) / 60000)}`} tono="rojo" />}
                    {corta(r) && <Chip texto="Mesa pequeña" tono="ambar" />}
                    {solapa(r) && <Chip texto="Se solapa" tono="ambar" />}
                    {r.alergias && <Chip texto="Alergias" tono="rojo" />}
                  </span>
                </span>
                <Chip texto={e.nombre} tono={e.tono} />
              </button>
            );
          })}
        </div>
      </>}
      detalle={form ? (
        /* ── Alta / edición ── */
        <div className="flex flex-col gap-2.5 pt-1">
          <input value={form.nombre ?? ""} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
          <div className="grid grid-cols-2 gap-2.5">
            <input value={form.telefono ?? ""} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="Teléfono" inputMode="tel" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
            <input type="number" min={1} value={form.comensales ?? 2} onChange={(e) => setForm((f) => ({ ...f, comensales: Number(e.target.value) }))} placeholder="Personas" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input type="time" value={form.hora ?? "20:00"} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
            <select value={form.table_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, table_id: e.target.value || null }))} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
              <option value="">Sin mesa asignada</option>
              {mesas.map((m) => <option key={m.id} value={m.id}>{m.nombre}{m.capacidad ? ` (${m.capacidad})` : ""}</option>)}
            </select>
          </div>
          <select value={form.canal ?? ""} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value || null }))} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
            <option value="">Canal…</option>
            <option value="TELEFONO">Teléfono</option><option value="WEB">Web</option>
            <option value="EN_PERSONA">En persona</option><option value="TPV">Mostrador</option>
          </select>
          <input value={form.alergias ?? ""} onChange={(e) => setForm((f) => ({ ...f, alergias: e.target.value }))} placeholder="Alergias (ej. celíaco, frutos secos…)" className="min-h-11 rounded-md border border-danger/40 bg-background px-3 text-sm outline-none focus:border-danger" />
          <textarea value={form.notas ?? ""} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Notas (trona, tarta sorpresa…)" rows={3} className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
          <div className="grid grid-cols-2 gap-2.5">
            <BotonAccion onClick={() => setForm(null)}>Cancelar</BotonAccion>
            <BotonAccion tono="brand" onClick={() => { void guardarForm(); }}>Guardar</BotonAccion>
          </div>
        </div>
      ) : !sel ? (
        <Vacio titulo="Elige una reserva" texto="Toca una reserva de la lista para ver su detalle." />
      ) : (
        /* ── Detalle ── */
        <div className="flex flex-col gap-3 pt-1">
          <div>
            <div className="flex items-center gap-2 text-lg font-extrabold">{sel.nombre ?? "Sin nombre"} <Chip texto={(RSV_ESTADOS[sel.estado] ?? { nombre: sel.estado, tono: "gris" as const }).nombre} tono={(RSV_ESTADOS[sel.estado] ?? { tono: "gris" as const }).tono} /></div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {HH(sel.fecha_hora)} · {sel.comensales} pax{sel.table_id ? ` · ${mesaDe(sel.table_id)?.nombre ?? "Mesa"}` : " · sin mesa"}
              {sel.telefono ? ` · ${sel.telefono}` : ""}
            </div>
          </div>
          {sel.alergias && <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm font-semibold text-danger"><AlertTriangle size={16} className="mt-0.5 flex-none" /> {sel.alergias}</div>}
          {sel.notas && <div className="rounded-md border border-border bg-surface p-2.5 text-sm">{sel.notas}</div>}

          <div className="grid grid-cols-2 gap-2">
            {sel.estado === "PENDIENTE" && <BotonAccion tono="verde" onClick={() => { void cambiarEstado(sel, "CONFIRMADA"); }}><Check size={15} /> Confirmar</BotonAccion>}
            {["PENDIENTE", "CONFIRMADA"].includes(sel.estado) && <BotonAccion tono="brand" onClick={() => { void cambiarEstado(sel, "SENTADA"); }}><Users size={15} /> Sentar</BotonAccion>}
            {sel.estado === "SENTADA" && <BotonAccion tono="verde" onClick={() => { void cambiarEstado(sel, "TERMINADA"); }}><Check size={15} /> Terminada</BotonAccion>}
            {["PENDIENTE", "CONFIRMADA"].includes(sel.estado) && <BotonAccion tono="ambar" onClick={() => { void cambiarEstado(sel, "NO_SHOW"); }}><Eye size={15} /> No vino</BotonAccion>}
            {rsvActiva(sel) && <BotonAccion tono="rojo" onClick={() => { void cambiarEstado(sel, "CANCELADA"); }}>Cancelar reserva</BotonAccion>}
            <BotonAccion onClick={() => { setForm({ ...sel, hora: HH(sel.fecha_hora) }); }}><PencilLine size={15} /> Editar</BotonAccion>
            <BotonAccion tono={confBorrar ? "rojo" : "gris"} onClick={() => { if (confBorrar) void borrar(sel); else setConfBorrar(true); }}>
              <Trash2 size={15} /> {confBorrar ? "¿Seguro? Borrar" : "Borrar"}
            </BotonAccion>
          </div>
        </div>
      )}
    />
  );
}

/* ═════════════════════════ PARA LLEVAR ═════════════════════════ */

interface Ped {
  id: string; cliente_nombre: string; cliente_telefono: string | null; total: number; created_at: string;
  estado: string; estado_preparacion: string; notas: string | null;
  entrega_at: string | null; direccion: string | null; canal_pedido: string | null;
}
const PED_ESTADOS: Record<string, { nombre: string; tono: "gris" | "verde" | "ambar" | "rojo" | "brand" | "azul" }> = {
  PENDIENTE: { nombre: "Sin marchar", tono: "ambar" },
  EN_PREPARACION: { nombre: "En cocina", tono: "azul" },
  LISTO: { nombre: "Listo", tono: "verde" },
  EN_CAMINO: { nombre: "En camino", tono: "brand" },
  ENTREGADO: { nombre: "Entregado", tono: "gris" },
};
const pedActivo = (p: Ped) => p.estado !== "COBRADA" && p.estado_preparacion !== "ENTREGADO";

export function ParaLlevarVista({ sb, abrirLlevar, nuevoParaLlevar }: Readonly<{
  sb: any;
  abrirLlevar: (o: { id: string; cliente_nombre: string; cliente_telefono: string | null }) => void;
  nuevoParaLlevar: (nombre: string, telefono: string) => void;
}>) {
  const [pedidos, setPedidos] = useState<Ped[]>([]);
  const [filtro, setFiltro] = useState<"activos" | "PENDIENTE" | "EN_PREPARACION" | "LISTO" | "todos">("activos");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [lineasSel, setLineasSel] = useState<{ nombre: string; cantidad: number; precio_unitario: number; notas: string | null }[]>([]);
  const [nuevo, setNuevo] = useState<{ nombre: string; telefono: string } | null>(null);
  const [editEntrega, setEditEntrega] = useState<{ hora: string; direccion: string; canal: string } | null>(null);
  const [, tic] = useState(0);

  // Reloj: la urgencia cambia sola con el tiempo.
  useEffect(() => { const t = setInterval(() => tic((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  async function cargar() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const cols = "id,cliente_nombre,cliente_telefono,total,created_at,estado,estado_preparacion,notas,entrega_at,direccion,canal_pedido";
    const [abiertos, cerrados] = await Promise.all([
      sb.from("sales_order").select(cols).is("table_id", null).not("cliente_nombre", "is", null)
        .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"]).order("created_at", { ascending: false }),
      sb.from("sales_order").select(cols).is("table_id", null).not("cliente_nombre", "is", null)
        .eq("estado", "COBRADA").gte("created_at", hoy.toISOString()).order("created_at", { ascending: false }),
    ]);
    setPedidos(([...(abiertos.data ?? []), ...(cerrados.data ?? [])]) as Ped[]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, []);

  const sel = pedidos.find((p) => p.id === selId) ?? null;
  useEffect(() => {
    if (!selId) { setLineasSel([]); return; }
    void (async () => {
      const { data } = await sb.from("order_line").select("nombre,cantidad,precio_unitario,notas").eq("order_id", selId);
      setLineasSel((data as typeof lineasSel) ?? []);
    })();
    setEditEntrega(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  const bucket = (p: Ped) => (p.estado === "COBRADA" ? "ENTREGADO" : p.estado_preparacion);
  const faltaMin = (p: Ped) => (p.entrega_at ? (new Date(p.entrega_at).getTime() - Date.now()) / 60000 : null);

  const filtrados = pedidos.filter((p) => {
    if (filtro === "activos" && !pedActivo(p)) return false;
    if (!["activos", "todos"].includes(filtro) && bucket(p) !== filtro) return false;
    const t = q.trim().toLowerCase();
    if (t) return p.cliente_nombre.toLowerCase().includes(t) || (p.cliente_telefono ?? "").replace(/\s/g, "").includes(t.replace(/\s/g, ""));
    return true;
  }).sort((a, b) => {
    if (pedActivo(a) !== pedActivo(b)) return pedActivo(a) ? -1 : 1;
    const fa = a.entrega_at ? new Date(a.entrega_at).getTime() : new Date(a.created_at).getTime() + 8.64e7;
    const fb = b.entrega_at ? new Date(b.entrega_at).getTime() : new Date(b.created_at).getTime() + 8.64e7;
    return fa - fb;   // lo que antes sale, primero
  });

  const nDe = (k: typeof filtro) => (k === "todos" ? pedidos.length : k === "activos" ? pedidos.filter(pedActivo).length : pedidos.filter((p) => bucket(p) === k).length);

  // OPTIMISTA: el estado se pinta al toque; si el servidor falla, se revierte.
  async function cambiarPrep(p: Ped, prep: string) {
    const datos: Record<string, unknown> = { estado_preparacion: prep };
    if (p.estado === "ABIERTA" && prep === "EN_PREPARACION") datos.estado = "ENVIADA_COCINA";
    const antes = pedidos;
    setPedidos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...datos } as Ped : x)));
    const { error } = await sb.from("sales_order").update(datos).eq("id", p.id);
    if (error) { setPedidos(antes); toast.error("No se pudo actualizar el pedido."); return; }
  }
  async function guardarEntrega() {
    if (!sel || !editEntrega) return;
    const [h, m] = editEntrega.hora.split(":").map(Number);
    let entrega: string | null = null;
    if (editEntrega.hora) { const d = new Date(); d.setHours(h ?? 0, m ?? 0, 0, 0); entrega = d.toISOString(); }
    const { error } = await sb.from("sales_order").update({
      entrega_at: entrega,
      direccion: editEntrega.direccion.trim() || null,
      canal_pedido: editEntrega.canal || null,
    }).eq("id", sel.id);
    if (error) { toast.error("No se pudo guardar la entrega."); return; }
    setEditEntrega(null);
    await cargar();
  }

  const FILTROS: [typeof filtro, string][] = [["activos", "Activos"], ["PENDIENTE", "Sin marchar"], ["EN_PREPARACION", "En cocina"], ["LISTO", "Listos"], ["todos", "Todos"]];

  return (
    <Marco
      tituloLista="Pedidos · por orden de urgencia"
      nLista={`${filtrados.length} ${filtrados.length === 1 ? "pedido" : "pedidos"}`}
      tituloDetalle="Pedido"
      toolbar={<>
        <span className="flex items-center gap-1.5 text-sm font-bold"><Clock size={15} className="text-muted-foreground" /> {new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
        <div className="flex items-center gap-1 overflow-x-auto rounded-md border border-border bg-background p-0.5">
          {FILTROS.map(([k, nm]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)} aria-pressed={filtro === k}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-semibold transition-colors ${filtro === k ? "bg-brand text-white" : "text-muted-foreground hover:bg-accent"}`}>
              {nm} <span className={`rounded-full px-1.5 text-[10px] font-black ${filtro === k ? "bg-white/25" : "bg-surface"}`}>{nDe(k)}</span>
            </button>
          ))}
        </div>
        <Buscador q={q} setQ={setQ} placeholder="Nombre o teléfono…" />
        <BotonAccion tono="brand" onClick={() => setNuevo({ nombre: "", telefono: "" })}><Plus size={16} /> Nuevo pedido</BotonAccion>
      </>}
      lista={<>
        {nuevo && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 p-2.5">
            <input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo((s) => s && { ...s, nombre: e.target.value })} placeholder="Nombre del cliente" className="min-h-11 min-w-40 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
            <input value={nuevo.telefono} onChange={(e) => setNuevo((s) => s && { ...s, telefono: e.target.value })} placeholder="Teléfono" inputMode="tel" className="min-h-11 w-36 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
            <BotonAccion onClick={() => setNuevo(null)}>Cancelar</BotonAccion>
            <BotonAccion tono="brand" onClick={() => { if (nuevo.nombre.trim()) { nuevoParaLlevar(nuevo.nombre, nuevo.telefono); setNuevo(null); } }}>Crear y comandar</BotonAccion>
          </div>
        )}
        {filtrados.length === 0 && <Vacio titulo="Nada por aquí" texto="No hay pedidos con ese filtro." />}
        <div className="flex flex-col gap-1.5">
          {filtrados.map((p) => {
            const e = PED_ESTADOS[bucket(p)] ?? { nombre: bucket(p), tono: "gris" as const };
            const f = faltaMin(p);
            const urgente = f !== null && f <= 10 && pedActivo(p) && bucket(p) !== "LISTO";
            return (
              <button key={p.id} type="button" onClick={() => setSelId(p.id)}
                className={`grid grid-cols-[56px_1fr_auto] items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all active:scale-[.995] ${selId === p.id ? "border-brand bg-brand/5" : "border-border bg-background hover:border-border-strong hover:bg-accent"} ${pedActivo(p) ? "" : "opacity-55"}`}>
                <span className={`rounded px-1.5 py-1 text-center text-sm font-black tabular-nums ${urgente ? "bg-danger/15 text-danger" : "bg-surface"}`}>
                  {p.entrega_at ? HH(p.entrega_at) : "—"}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 truncate text-sm font-bold">
                    <IconoCanal canal={p.canal_pedido} />
                    {p.direccion ? <Bike size={14} className="flex-none text-brand" /> : <ShoppingBag size={14} className="flex-none text-muted-foreground" />}
                    {p.cliente_nombre}
                    {p.cliente_telefono && <span className="font-medium text-muted-foreground">· {p.cliente_telefono}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1">
                    {urgente && <Chip texto={f! <= 0 ? `Tarde ${hm(f!)}` : `En ${hm(f!)}`} tono="rojo" />}
                    {bucket(p) === "LISTO" && p.direccion && <Chip texto="Sacar a reparto" tono="ambar" />}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Chip texto={e.nombre} tono={e.tono} />
                  <b className="text-sm tabular-nums">{eur(Number(p.total))}</b>
                </span>
              </button>
            );
          })}
        </div>
      </>}
      detalle={!sel ? (
        <Vacio titulo="Elige un pedido" texto="Toca un pedido de la lista para ver su detalle." />
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          <div>
            <div className="flex items-center gap-2 text-lg font-extrabold">
              {sel.cliente_nombre} <Chip texto={(PED_ESTADOS[bucket(sel)] ?? { nombre: bucket(sel), tono: "gris" as const }).nombre} tono={(PED_ESTADOS[bucket(sel)] ?? { tono: "gris" as const }).tono} />
            </div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {sel.direccion ? "Reparto" : "Recogida"}{sel.entrega_at ? ` · ${HH(sel.entrega_at)}` : " · sin hora"}
              {sel.cliente_telefono ? ` · ${sel.cliente_telefono}` : ""}
            </div>
            {sel.direccion && <div className="mt-1 flex items-start gap-1.5 text-sm"><Bike size={15} className="mt-0.5 flex-none text-brand" /> {sel.direccion}</div>}
            {sel.notas && <div className="mt-1.5 rounded-md border border-border bg-surface p-2 text-sm">{sel.notas}</div>}
          </div>

          {/* Artículos */}
          <div className="rounded-lg border border-border">
            {lineasSel.map((l, i) => (
              <div key={`${sel.id}-${i}`} className="flex items-start justify-between gap-2 border-b border-border px-3 py-1.5 text-sm last:border-0">
                <span className="min-w-0"><b className="tabular-nums">{l.cantidad}×</b> {l.nombre}{l.notas && <span className="block text-xs text-muted-foreground">{l.notas}</span>}</span>
                <span className="font-bold tabular-nums">{eur(l.cantidad * l.precio_unitario)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 text-sm font-black"><span>Total</span><span className="tabular-nums">{eur(Number(sel.total))}</span></div>
          </div>

          {/* Entrega: hora / dirección / canal */}
          {editEntrega ? (
            <div className="flex flex-col gap-2 rounded-lg border border-brand/40 bg-brand/5 p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={editEntrega.hora} onChange={(e) => setEditEntrega((s) => s && { ...s, hora: e.target.value })} className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                <select value={editEntrega.canal} onChange={(e) => setEditEntrega((s) => s && { ...s, canal: e.target.value })} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                  <option value="">Canal…</option><option value="TELEFONO">Teléfono</option><option value="WEB">Web</option><option value="MOSTRADOR">Mostrador</option>
                </select>
              </div>
              <input value={editEntrega.direccion} onChange={(e) => setEditEntrega((s) => s && { ...s, direccion: e.target.value })} placeholder="Dirección (vacío = recogida en local)" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
              <div className="grid grid-cols-2 gap-2">
                <BotonAccion onClick={() => setEditEntrega(null)}>Cancelar</BotonAccion>
                <BotonAccion tono="brand" onClick={() => { void guardarEntrega(); }}>Guardar entrega</BotonAccion>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {bucket(sel) === "PENDIENTE" && <BotonAccion tono="ambar" onClick={() => { void cambiarPrep(sel, "EN_PREPARACION"); }}><Flame size={15} /> A cocina</BotonAccion>}
              {bucket(sel) === "EN_PREPARACION" && <BotonAccion tono="verde" onClick={() => { void cambiarPrep(sel, "LISTO"); }}><Check size={15} /> Listo</BotonAccion>}
              {bucket(sel) === "LISTO" && sel.direccion && <BotonAccion tono="brand" onClick={() => { void cambiarPrep(sel, "EN_CAMINO"); }}><Bike size={15} /> En camino</BotonAccion>}
              {pedActivo(sel) && <BotonAccion tono="verde" onClick={() => abrirLlevar(sel)}><Check size={15} /> Entregar y cobrar</BotonAccion>}
              <BotonAccion onClick={() => setEditEntrega({ hora: sel.entrega_at ? HH(sel.entrega_at) : "", direccion: sel.direccion ?? "", canal: sel.canal_pedido ?? "" })}><PencilLine size={15} /> Entrega…</BotonAccion>
              {pedActivo(sel) && <BotonAccion onClick={() => abrirLlevar(sel)}>Abrir en TPV</BotonAccion>}
            </div>
          )}
        </div>
      )}
    />
  );
}

/* ═════════════════════════ CUENTAS APARCADAS ═════════════════════════ */

interface Apk {
  id: string; aparcado_como: string | null; total: number; created_at: string;
  user_id?: string | null; numero_pedido?: number | null;
}

const COLORES_AV = ["#572370", "#2C6BBF", "#EA8118", "#0B8F62", "#B33A66"];
const colorDe = (id: string) => COLORES_AV[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES_AV.length];

export function AparcadasVista({ sb, aparcados, lineasPor, operarioId, filtro, q, recuperarAparcado, cobrarAparcado, pasarAMesa, imprimir, onCambio }: Readonly<{
  sb: any;
  aparcados: Apk[];
  lineasPor: Record<string, { nombre: string; cantidad: number; total: number }[]>;
  operarioId: string | null;
  /** Filtro y búsqueda CONTROLADOS: viven en el navbar morado (PlanoSalas). */
  filtro: "todas" | "mias" | "viejas";
  q: string;
  recuperarAparcado: (o: Apk) => void;
  cobrarAparcado: (o: Apk) => void;
  pasarAMesa: (o: Apk) => void;
  imprimir: (o: Apk) => void;
  onCambio: () => void;
}>) {
  const [selId, setSelId] = useState<string | null>(null);
  const [camareros, setCamareros] = useState<Record<string, string>>({});
  const [aliasEdit, setAliasEdit] = useState<string | null>(null);
  const [confAnular, setConfAnular] = useState(false);

  // Nombres de quien aparcó cada cuenta (best-effort: si la RLS no deja, sin avatar).
  useEffect(() => {
    const ids = [...new Set(aparcados.map((o) => o.user_id).filter(Boolean))] as string[];
    if (!ids.length) { setCamareros({}); return; }
    void (async () => {
      const { data } = await sb.from("app_user").select("id,nombre").in("id", ids);
      const m: Record<string, string> = {};
      for (const u of (data ?? []) as { id: string; nombre: string }[]) m[u.id] = u.nombre;
      setCamareros(m);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aparcados]);

  const edadMin = (o: Apk) => (Date.now() - new Date(o.created_at).getTime()) / 60000;
  const vieja = (o: Apk) => edadMin(o) > 120;
  const mia = (o: Apk) => !!operarioId && o.user_id === operarioId;
  const nombreCam = (o: Apk) => (o.user_id ? camareros[o.user_id] : undefined);
  const ticketDe = (o: Apk) => (o.numero_pedido ? String(o.numero_pedido).padStart(6, "0") : o.id.slice(0, 6));
  const etiqueta = (o: Apk) => o.aparcado_como || `Sin alias · ticket ${ticketDe(o)}`;

  const filtradas = aparcados.filter((o) => {
    if (filtro === "mias" && !mia(o)) return false;
    if (filtro === "viejas" && !vieja(o)) return false;
    const t = q.trim().toLowerCase();
    if (t) return etiqueta(o).toLowerCase().includes(t) || ticketDe(o).includes(t);
    return true;
  }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());   // la más vieja arriba: es la que se pierde

  const sel = aparcados.find((o) => o.id === selId) ?? null;
  const totalAparcado = aparcados.reduce((s, o) => s + Number(o.total), 0);
  const viejas = aparcados.filter(vieja);
  const totalViejas = viejas.reduce((s, o) => s + Number(o.total), 0);

  async function guardarAlias() {
    if (!sel || aliasEdit === null) return;
    const { error } = await sb.from("sales_order").update({ aparcado_como: aliasEdit.trim() || null }).eq("id", sel.id);
    if (error) { toast.error("No se pudo guardar el alias."); return; }
    setAliasEdit(null);
    onCambio();
  }

  // Anular la cuenta aparcada (dos toques): pasa a ANULADA y desaparece de la lista.
  async function anular() {
    if (!sel) return;
    const { error } = await sb.from("sales_order").update({ estado: "ANULADA" }).eq("id", sel.id);
    if (error) { toast.error("No se pudo anular la cuenta."); return; }
    setSelId(null); setConfAnular(false);
    toast.success("Cuenta anulada");
    onCambio();
  }

  const numFmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Tarjetas KPI a lo ancho, como el mockup: icono · número grande · etiqueta.
  const KPIS = [
    { icono: FileText, b: String(aparcados.length), s: "Aparcadas", caja: "border-border bg-card", num: "", ic: "text-muted-foreground" },
    { icono: Euro, b: numFmt(totalAparcado), s: "En el aire", caja: "border-border bg-card", num: "", ic: "text-muted-foreground" },
    {
      icono: Clock, b: numFmt(totalViejas), s: "Más de 2 h",
      caja: viejas.length ? "border-danger/40 bg-danger/10" : "border-success/40 bg-success/10",
      num: viejas.length ? "text-danger" : "text-success",
      ic: viejas.length ? "text-danger" : "text-success",
    },
    ...(operarioId ? [{ icono: User, b: `${aparcados.filter(mia).length} de ${aparcados.length}`, s: "Tuyas", caja: "border-border bg-card", num: "", ic: "text-muted-foreground" }] : []),
  ];

  return (
    <Marco
      listaPlana
      tituloLista="Aparcadas · de la más vieja a la más nueva"
      nLista={`${filtradas.length} ${filtradas.length === 1 ? "cuenta" : "cuentas"}`}
      tituloDetalle={sel ? `Cuenta · ticket ${ticketDe(sel)}` : "Cuenta"}
      toolbar={<>
        {/* Filtros y buscador viven en el NAVBAR morado (PlanoSalas). Aquí: las
            tarjetas KPI a lo ancho, como el mockup, + la acción. */}
        {KPIS.map((k) => (
          <div key={k.s} className={`flex min-h-13 min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 py-1.5 ${k.caja}`}>
            <k.icono size={18} className={`flex-none ${k.ic}`} />
            <span className="min-w-0">
              <b className={`block truncate text-lg font-extrabold leading-tight tabular-nums ${k.num}`}>{k.b}</b>
              <small className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{k.s}</small>
            </span>
          </div>
        ))}
      </>}
      lista={<>
        {filtradas.length === 0 && <Vacio titulo="Nada aparcado" texto={filtro === "viejas" ? "Ninguna cuenta lleva más de 2 h. Bien." : "La barra está limpia."} />}
        {/* Tabla plana como el mockup: filas a ras del borde, separadas por líneas
            finas, barra de color a la izquierda (roja >2 h; morada la elegida). */}
        {filtradas.length > 0 && (
          <div className="divide-y divide-border">
            {filtradas.map((o) => {
              const e = edadMin(o), v = vieja(o), on = selId === o.id;
              const lineas = lineasPor[o.id] ?? [];
              const uds = lineas.reduce((s, l) => s + l.cantidad, 0);
              const cam = nombreCam(o);
              let borde = "border-l-transparent hover:bg-accent";
              if (on) borde = "border-l-brand bg-brand/5";
              else if (v) borde = "border-l-danger bg-danger/5 hover:bg-danger/10";
              return (
                <button key={o.id} type="button" onClick={() => { setSelId(on ? null : o.id); setAliasEdit(null); setConfAnular(false); }}
                  className={`grid w-full grid-cols-[96px_1fr_90px_40px_40px] items-center gap-2 border-l-4 px-2.5 py-2 text-left transition-colors ${borde}`}>
                  <span className={`text-center ${v ? "text-danger" : e > 60 ? "text-warning" : ""}`}>
                    <b className="block whitespace-nowrap text-[14px] font-black leading-tight">{hm(e)}</b>
                    <small className="text-[11px] font-semibold tabular-nums text-muted-foreground">{HH(o.created_at)}</small>
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                      {o.aparcado_como ? o.aparcado_como : <span className="font-medium italic text-muted-foreground">sin alias · ticket {ticketDe(o)}</span>}
                      {v && <Chip texto="Más de 2 h" tono="rojo" />}
                      {operarioId && o.user_id && !mia(o) && cam && <Chip texto={`De ${cam.split(" ")[0]}`} tono="azul" />}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Store size={12} /> Aparcado · ticket {ticketDe(o)}</span>
                  </span>
                  <b className="text-right text-sm tabular-nums">{eur(Number(o.total))}</b>
                  <span className="text-center text-sm font-black tabular-nums text-muted-foreground" title={`${uds} artículos`}>{uds}</span>
                  <span className="grid h-8 w-8 place-items-center justify-self-center rounded-full text-[10px] font-black text-white" title={cam ?? "Camarero"} style={{ background: colorDe(o.user_id ?? o.id) }}>
                    {(cam ?? "?").trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </>}
      detalle={!sel ? (
        <Vacio titulo="Ninguna cuenta elegida" texto="Toca una de la lista para recuperarla, cobrarla o pasarla a mesa." />
      ) : (
        <div className="flex flex-col gap-2.5 pt-2.5">
          {/* Cabecera: bloque de edad en color sólido + quién la aparcó */}
          <div className="flex items-center gap-3">
            <span className={`rounded-md px-2.5 py-1.5 text-center ${vieja(sel) ? "bg-danger text-white" : edadMin(sel) > 60 ? "bg-warning text-white" : "bg-surface"}`}>
              <b className="block text-base font-black leading-tight">{hm(edadMin(sel))}</b>
              <small className="text-[9px] font-bold uppercase tracking-wide opacity-85">desde {HH(sel.created_at)}</small>
            </span>
            <div className="min-w-0">
              <div className="truncate text-lg font-extrabold">{sel.aparcado_como || `Ticket ${ticketDe(sel)}`}</div>
              <div className="text-sm text-muted-foreground">Aparcado · la aparcó {mia(sel) ? "tú" : (nombreCam(sel) ?? "—")}</div>
            </div>
          </div>

          {/* Avisos */}
          {vieja(sel) && (
            <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm font-semibold text-danger">
              <AlertTriangle size={16} className="mt-0.5 flex-none" />
              Lleva {hm(edadMin(sel))} aparcada desde las {HH(sel.created_at)}. O están todavía ahí, o se fueron sin pagar: mírala antes del cierre.
            </div>
          )}
          {!vieja(sel) && edadMin(sel) > 60 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-sm font-semibold text-warning">
              <Clock size={16} className="mt-0.5 flex-none" /> Lleva {hm(edadMin(sel))} abierta.
            </div>
          )}
          {operarioId && sel.user_id && !mia(sel) && nombreCam(sel) && (
            <div className="flex items-start gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 p-2.5 text-sm">
              <Eye size={16} className="mt-0.5 flex-none text-sky-500" /> La aparcó {nombreCam(sel)}. Si la cobras tú, la venta pasa a tu nombre.
            </div>
          )}

          {/* Datos: tabla minimalista (como el mockup) */}
          <div className="divide-y divide-border border-y border-border text-sm">
            {([
              ["Alias", sel.aparcado_como, "sin poner"],
              ["Cliente", null, "sin cliente"],
              ["Sitio", "Aparcado", ""],
              ["Ticket", ticketDe(sel), ""],
            ] as [string, string | null, string][]).map(([l, v, vacio]) => (
              <div key={l} className="grid grid-cols-[80px_1fr] items-center py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{l}</span>
                {v ? <span className="font-semibold">{v}</span> : <span className="italic text-muted-foreground">{vacio}</span>}
              </div>
            ))}
          </div>

          {/* Artículos */}
          <div className="divide-y divide-border border-y border-border text-sm">
            {(lineasPor[sel.id] ?? []).map((l, i) => (
              <div key={`${sel.id}-${i}`} className="grid grid-cols-[30px_1fr_auto] items-center gap-2 py-1.5">
                <b className="text-center tabular-nums">{l.cantidad}</b>
                <span className="min-w-0 truncate">{l.nombre}</span>
                <span className="font-bold tabular-nums">{eur(l.total)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5"><span className="text-base font-black">Total</span><span className="text-base font-black tabular-nums">{eur(Number(sel.total))}</span></div>
          </div>

          {/* Acciones (mockup): cobrar · recuperar · 2×2 · anular */}
          {aliasEdit !== null && (
            <div className="flex gap-2">
              <input autoFocus value={aliasEdit} onChange={(e) => setAliasEdit(e.target.value)} placeholder="Alias («el del sombrero»…)"
                onKeyDown={(e) => { if (e.key === "Enter") void guardarAlias(); }}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
              <BotonAccion tono="brand" onClick={() => { void guardarAlias(); }}>Guardar</BotonAccion>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => cobrarAparcado(sel)}
              className="flex min-h-13 items-center justify-center gap-2 rounded-lg bg-warning text-base font-extrabold text-white shadow-md shadow-warning/25 transition-all hover:brightness-105 active:scale-[.98]">
              <Euro size={18} /> Cobrar {eur(Number(sel.total))}
            </button>
            <button type="button" onClick={() => recuperarAparcado(sel)}
              className="flex min-h-13 items-center justify-center gap-2 rounded-lg bg-brand text-[15px] font-bold text-white transition-all hover:bg-brand-hover active:scale-[.98]">
              <RotateCcw size={17} /> Recuperar en el TPV
            </button>
            <div className="grid grid-cols-2 gap-2">
              <BotonAccion onClick={() => pasarAMesa(sel)}><Grid2x2 size={15} /> Pasar a mesa</BotonAccion>
              <BotonAccion onClick={() => setAliasEdit(sel.aparcado_como ?? "")}><PencilLine size={15} /> {sel.aparcado_como ? "Cambiar alias" : "Poner alias"}</BotonAccion>
              <BotonAccion onClick={() => imprimir(sel)}><Printer size={15} /> Imprimir cuenta</BotonAccion>
              {/* ponytail: "Juntar con otra" aún sin flujo de fusión — deshabilitado a propósito */}
              <button type="button" disabled title="Próximamente"
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-bold text-muted-foreground opacity-60">
                <Merge size={15} /> Juntar con otra
              </button>
            </div>
            <button type="button"
              onClick={() => { if (confAnular) void anular(); else setConfAnular(true); }}
              onBlur={() => setConfAnular(false)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-bold transition-all active:scale-[.98] ${confAnular ? "border-danger bg-danger text-white" : "border-danger bg-card text-danger hover:bg-danger/10"}`}>
              <Trash2 size={15} /> {confAnular ? "¿Seguro? Anular" : "Anular"}
            </button>
          </div>
        </div>
      )}
    />
  );
}
