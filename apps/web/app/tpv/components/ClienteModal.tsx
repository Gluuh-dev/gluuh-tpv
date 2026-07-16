"use client";

// Modal CLIENTE (fiel a docs/diseño/gluuh-cliente.html): dos paneles —
//  · IZQUIERDA: buscador (tel/nombre/NIF/email) + filtros + lista de resultados.
//  · DERECHA:   ficha del cliente elegido, o formulario de alta.
// Footer: Cancelar · Quitar del ticket · Cliente nuevo · Asignar al ticket.
// Cableado a la tabla `customer` real (RLS por tenant). Los campos tarifa/descuento del
// mockup no existen aún en BD → se omiten (se añadirán con columnas si hacen falta).
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, UserPlus, Check, TriangleAlert, ArrowLeft, Keyboard } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { eur } from "@/app/lib/money";
import { abrirTeclado } from "@/components/teclado-en-pantalla";
import { ModalTPV } from "./ModalTPV";
import { toast } from "@/app/lib/toast";

export interface Cli {
  id: string; nombre: string | null; telefono: string | null; nif: string | null; email: string | null;
  direccion: string | null; codigo_postal: string | null; poblacion: string | null; provincia: string | null;
  notas: string | null; consentimiento_marketing: boolean; puntos_fidelidad: number;
}
const COLS = "id,nombre,telefono,nif,email,direccion,codigo_postal,poblacion,provincia,notas,consentimiento_marketing,puntos_fidelidad";

const iniciales = (n: string | null) => (n ?? "?").trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
// Para factura COMPLETA (F1) hacen falta NIF + dirección fiscal.
const facturable = (c: Cli) => !!(c.nif && c.direccion && c.codigo_postal && c.poblacion);

const FORM0 = { nombre: "", nif: "", telefono: "", email: "", direccion: "", codigo_postal: "", poblacion: "", provincia: "", notas: "", consentimiento_marketing: false };

export function ClienteModal({
  mesaNombre, comensales, total, clienteActual, onAsignar, onQuitar, onClose,
}: Readonly<{
  mesaNombre: string | null; comensales: number; total: number;
  clienteActual: { id: string | null; nombre: string } | null;
  onAsignar: (c: Cli) => void; onQuitar: () => void; onClose: () => void;
}>) {
  const sb = supabaseBrowser();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "hoy">("todos");
  const [lista, setLista] = useState<Cli[]>([]);
  const [sel, setSel] = useState<Cli | null>(null);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(FORM0);
  const [cargando, setCargando] = useState(true);
  const busca = useRef(0);

  const cargar = useCallback(async (texto: string, f: "todos" | "hoy") => {
    const id = ++busca.current;
    const limpio = texto.replace(/[,()%]/g, "").trim();
    let query = sb.from("customer").select(COLS).order("nombre").limit(60);
    if (limpio) query = query.or(`nombre.ilike.%${limpio}%,telefono.ilike.%${limpio}%,nif.ilike.%${limpio}%,email.ilike.%${limpio}%`);
    if (f === "hoy") { const d = new Date(); d.setHours(0, 0, 0, 0); query = query.gte("created_at", d.toISOString()); }
    const { data } = await query;
    if (id === busca.current) { setLista((data as Cli[]) ?? []); setCargando(false); }
  }, [sb]);

  useEffect(() => { void cargar(q, filtro); }, [q, filtro, cargar]);

  async function guardar() {
    if (!form.nombre.trim()) return;
    const { data, error } = await sb.from("customer").insert({
      nombre: form.nombre.trim(),
      nif: form.nif.trim().toUpperCase() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      codigo_postal: form.codigo_postal.trim() || null,
      poblacion: form.poblacion.trim() || null,
      provincia: form.provincia.trim() || null,
      notas: form.notas.trim() || null,
      consentimiento_marketing: form.consentimiento_marketing,
    }).select(COLS).single();
    if (error) { toast.error(`No se pudo crear: ${error.message}`); return; }
    setAlta(false); setForm(FORM0); setSel(data as Cli);
    toast.success("Cliente creado");
    void cargar(q, filtro);
  }

  const sub = `${mesaNombre ?? "Barra"} · ${comensales} pax`;

  return (
    <ModalTPV
      titulo="Cliente"
      subtitulo={sub}
      ancho={920}
      alto={640}
      onClose={onClose}
      derecha={<div className="text-right"><div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ticket</div><b className="text-lg tabular-nums">{eur(total)}</b></div>}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-3">
          {/* ── Panel izquierdo: buscar + filtros + resultados ── */}
          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
            <div className="flex flex-none items-center gap-2 border-b border-border p-2">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 focus-within:border-brand">
                <Search size={17} className="flex-none text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
                  placeholder="Teléfono, nombre, NIF o email…"
                  className="h-11 flex-1 bg-transparent text-sm outline-none" />
                {q && <button type="button" onClick={() => setQ("")} aria-label="Borrar" className="text-muted-foreground hover:text-foreground"><X size={15} /></button>}
              </div>
              <button type="button" onClick={abrirTeclado} title="Teclado en pantalla"
                className="grid h-11 w-11 flex-none place-items-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent"><Keyboard size={18} /></button>
            </div>
            <div className="flex flex-none gap-1.5 p-2">
              {([["todos", "Todos"], ["hoy", "Hoy"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setFiltro(v)} aria-pressed={filtro === v}
                  className={`h-9 rounded-md border px-3 text-xs font-bold ${filtro === v ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>{l}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {cargando && <p className="p-4 text-center text-sm text-muted-foreground">Cargando…</p>}
              {!cargando && lista.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Sin resultados. Usa «Cliente nuevo».</p>}
              {lista.map((c) => {
                const activo = sel?.id === c.id;
                return (
                  <button type="button" key={c.id} onClick={() => { setSel(c); setAlta(false); }}
                    className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors ${activo ? "bg-brand/10" : "hover:bg-accent"}`}>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{iniciales(c.nombre)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{c.telefono ?? "sin teléfono"}{c.nif ? ` · ${c.nif}` : " · sin NIF"}</span>
                    </span>
                    {facturable(c) && <span title="Facturable" className="flex-none rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">FACT.</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Panel derecho: ficha o alta ── */}
          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
            <h3 className="flex flex-none items-center gap-2 border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {alta ? "Cliente nuevo" : "Ficha del cliente"}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {alta ? (
                <Alta form={form} setForm={setForm} />
              ) : sel ? (
                <Ficha c={sel} />
              ) : (
                <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                  <div><b className="mb-1 block text-foreground">Ningún cliente elegido</b>Toca uno de la lista para ver su ficha, o crea uno nuevo.</div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Footer de acciones ── */}
        <div className="flex flex-none items-center gap-2 border-t border-border bg-surface px-3 py-2.5">
          {alta ? (
            <>
              <button type="button" onClick={() => setAlta(false)} className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent"><ArrowLeft size={16} /> Volver</button>
              <button type="button" onClick={guardar} disabled={!form.nombre.trim()} className="ml-auto flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-bold text-brand-foreground hover:bg-brand-hover disabled:opacity-40"><Check size={17} /> Guardar cliente</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent"><ArrowLeft size={16} /> Cancelar</button>
              {clienteActual && <button type="button" onClick={onQuitar} className="flex h-11 items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-500/20"><X size={16} /> Quitar del ticket</button>}
              <button type="button" onClick={() => { setAlta(true); setSel(null); setForm(FORM0); }} className="flex h-11 items-center gap-2 rounded-md border border-brand/40 bg-brand/10 px-4 text-sm font-bold text-brand hover:bg-brand/20"><UserPlus size={17} /> Cliente nuevo</button>
              <button type="button" onClick={() => sel && onAsignar(sel)} disabled={!sel} className="ml-auto flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-bold text-brand-foreground hover:bg-brand-hover disabled:opacity-40"><Check size={17} /> Asignar al ticket</button>
            </>
          )}
        </div>
      </div>
    </ModalTPV>
  );
}

// ── Ficha (solo lectura) del cliente elegido ──
function Ficha({ c }: Readonly<{ c: Cli }>) {
  const fac = facturable(c);
  const falta = [!c.nif && "el NIF", !(c.direccion && c.codigo_postal && c.poblacion) && "la dirección fiscal"].filter(Boolean).join(" y ");
  const dato = (l: string, v: string | null, no?: string) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-muted py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</span>
      <span className={`text-right text-sm ${v ? "font-medium" : "text-muted-foreground"}`}>{v || no || "—"}</span>
    </div>
  );
  const dirFiscal = [c.direccion, [c.codigo_postal, c.poblacion].filter(Boolean).join(" "), c.provincia].filter(Boolean).join(", ");
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-brand/15 text-base font-bold text-brand">{iniciales(c.nombre)}</span>
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{c.nombre}</div>
          <div className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${fac ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-500"}`}>
            {fac ? <><Check size={11} /> Facturable</> : <><TriangleAlert size={11} /> No facturable</>}
          </div>
        </div>
      </div>
      {!fac && <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-500">Le falta {falta} para poder emitir factura completa.</div>}
      {dato("NIF / CIF", c.nif, "sin poner")}
      {dato("Teléfono", c.telefono)}
      {dato("Email", c.email)}
      {dato("Dirección fiscal", dirFiscal || null, "sin dirección")}
      {dato("Notas", c.notas)}
      {dato("Puntos fidelidad", c.puntos_fidelidad ? String(c.puntos_fidelidad) : null, "0")}
      {dato("Marketing (RGPD)", c.consentimiento_marketing ? "Sí, consiente" : null, "no consiente")}
    </div>
  );
}

// ── Alta de cliente nuevo ──
function Alta({ form, setForm }: Readonly<{ form: typeof FORM0; setForm: React.Dispatch<React.SetStateAction<typeof FORM0>> }>) {
  const campo = (k: keyof typeof FORM0, label: string, opts?: { placeholder?: string; upper?: boolean; wide?: boolean }) => (
    <label className={`flex flex-col gap-1 ${opts?.wide ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={form[k] as string} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        placeholder={opts?.placeholder} className={`h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand ${opts?.upper ? "uppercase" : ""}`} />
    </label>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {campo("nombre", "Nombre / Razón social", { placeholder: "Nombre", wide: true })}
      {campo("nif", "NIF / CIF", { upper: true })}
      {campo("telefono", "Teléfono")}
      {campo("email", "Email", { wide: true })}
      {campo("direccion", "Dirección", { wide: true })}
      {campo("codigo_postal", "C. Postal")}
      {campo("poblacion", "Población")}
      {campo("provincia", "Provincia", { wide: true })}
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Notas</span>
        <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} rows={2}
          placeholder="Alergias, preferencias…" className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.consentimiento_marketing} onChange={(e) => setForm((f) => ({ ...f, consentimiento_marketing: e.target.checked }))} className="h-4 w-4 accent-[var(--brand)]" />
        Consiente marketing (RGPD)
      </label>
    </div>
  );
}
