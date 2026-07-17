"use client";

// Modal CLIENTE (fiel a docs/diseño/gluuh-cliente.html): dos paneles —
//  · IZQUIERDA: buscador (tel/nombre/NIF/email) + filtros + lista de resultados.
//  · DERECHA:   ficha del cliente elegido, o formulario de alta.
// Footer: Cancelar · Quitar del ticket · Cliente nuevo · Asignar al ticket.
// Cableado a la tabla `customer` real (RLS por tenant). Los campos tarifa/descuento del
// mockup no existen aún en BD → se omiten (se añadirán con columnas si hacen falta).
import { useEffect, useMemo, useState } from "react";
import { Search, X, UserPlus, Check, TriangleAlert, ArrowLeft, Keyboard, Pencil, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { eur } from "@/app/lib/money";
import { abrirTeclado } from "@/components/teclado-en-pantalla";
import { ModalTPV } from "./ModalTPV";
import { useConfirmar } from "@/components/dialogo-confirmar";
import { useClientesStore, CLI_COLS, type Cli } from "../hooks/useClientesStore";
import { toast } from "@/app/lib/toast";

export type { Cli };

const iniciales = (n: string | null) => (n ?? "?").trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
// Color del avatar derivado del NOMBRE (como el mockup): mismo nombre → siempre mismo color.
function colorAvatar(n: string | null): React.CSSProperties {
  const s = n ?? "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return { backgroundColor: `hsl(${h} 60% 50% / .18)`, color: `hsl(${h} 55% 42%)` };
}
// Para factura COMPLETA (F1) hacen falta NIF + dirección fiscal.
const facturable = (c: Cli) => !!(c.nif && c.direccion && c.codigo_postal && c.poblacion);
// ¿Es empresa? Se DEDUCE del CIF (empieza por letra de sociedad) o del nombre (S.L., Bar…).
// No hay columna: en España el CIF de empresa empieza por A-H/J/N/P-W; DNI = 8 díg.+letra, NIE = X/Y/Z.
function esEmpresa(c: Cli): boolean {
  const nif = (c.nif ?? "").trim().toUpperCase();
  if (/^[ABCDEFGHJNPQRSUVW]\d/.test(nif)) return true;
  return /\b(S\.?\s?L|S\.?\s?A|S\.?\s?C|C\.?\s?B|BAR|RESTAURANTE|CAFETER|HOTEL|PEÑA|COMUNIDAD|ASOC|CLUB)\b/i.test(c.nombre ?? "");
}
// Fecha relativa corta ("Hoy" · "Ayer" · "Hace N días" · "Hace N sem." · "dd/mm/aa").
function relativa(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso), ahora = new Date();
  const dias = Math.floor((new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return `Hace ${Math.floor(dias / 7)} sem.`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
// "Tiene datos" = algo más que el nombre. Un cliente con SOLO nombre se puede borrar; en
// cuanto tiene datos, se edita (no se borra). Con facturas emitidas, ni editar ni borrar.
const tieneDatos = (c: Cli) => !!(c.nif || c.email || c.direccion || c.codigo_postal || c.poblacion || c.provincia || c.notas);
const aForm = (c: Cli) => ({
  nombre: c.nombre ?? "", nif: c.nif ?? "", telefono: c.telefono ?? "", email: c.email ?? "",
  direccion: c.direccion ?? "", codigo_postal: c.codigo_postal ?? "", poblacion: c.poblacion ?? "",
  provincia: c.provincia ?? "", notas: c.notas ?? "", consentimiento_marketing: c.consentimiento_marketing,
  tarifa_id: c.tarifa_id ?? "", descuento_pct: String(c.descuento_pct ?? 0),
});

const FORM0 = { nombre: "", nif: "", telefono: "", email: "", direccion: "", codigo_postal: "", poblacion: "", provincia: "", notas: "", consentimiento_marketing: false, tarifa_id: "", descuento_pct: "0" };

export function ClienteModal({
  mesaNombre, comensales, total, clienteActual, onAsignar, onQuitar, onClose,
}: Readonly<{
  mesaNombre: string | null; comensales: number; total: number;
  clienteActual: { id: string | null; nombre: string } | null;
  onAsignar: (c: Cli) => void; onQuitar: () => void; onClose: () => void;
}>) {
  const sb = supabaseBrowser();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "hoy" | "deuda">("todos");
  const [tarifas, setTarifas] = useState<{ id: string; nombre: string }[]>([]);
  const [stats, setStats] = useState<Record<string, { visitas: number; ultima: string | null }>>({});
  const [sel, setSel] = useState<Cli | null>(null);
  const [alta, setAlta] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM0);
  // ¿El cliente elegido tiene facturas emitidas? null = comprobando. Con facturas se bloquea
  // editar/borrar (integridad fiscal: no se cambia el titular de una factura ya emitida).
  const [facturas, setFacturas] = useState<boolean | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  // Lista PERSISTENTE (caché): no se recarga al abrir el modal; se revalida en 2º plano.
  const clientes = useClientesStore((s) => s.clientes);
  const cargado = useClientesStore((s) => s.cargado);
  const cargarClientes = useClientesStore((s) => s.cargar);
  const upsert = useClientesStore((s) => s.upsert);
  const quitar = useClientesStore((s) => s.quitar);
  useEffect(() => { void cargarClientes(sb); }, [cargarClientes, sb]);
  useEffect(() => { sb.from("tarifa").select("id,nombre").order("nombre").then(({ data }) => setTarifas((data as { id: string; nombre: string }[]) ?? [])); }, [sb]);
  useEffect(() => {
    sb.rpc("clientes_stats").then(({ data }) => {
      const m: Record<string, { visitas: number; ultima: string | null }> = {};
      for (const r of (data as { customer_id: string; visitas: number; ultima: string | null }[] | null) ?? []) m[r.customer_id] = { visitas: Number(r.visitas), ultima: r.ultima };
      setStats(m);
    });
  }, [sb]);
  const tarifaNombre = (id: string | null) => (id ? tarifas.find((t) => t.id === id)?.nombre : null) ?? "General";

  // Filtrado LOCAL (sin pegarle a la BD en cada tecla): nombre/teléfono/NIF/email + "hoy".
  const lista = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const qq = norm(q.replace(/[,()%]/g, "").trim());
    const iniHoy = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    return clientes.filter((c) => {
      if (filtro === "hoy" && new Date(c.created_at).getTime() < iniHoy) return false;
      if (filtro === "deuda" && !(Number(c.saldo) > 0)) return false;
      if (!qq) return true;
      return norm(c.nombre ?? "").includes(qq) || norm(c.telefono ?? "").includes(qq) || norm(c.nif ?? "").includes(qq) || norm(c.email ?? "").includes(qq);
    });
  }, [clientes, q, filtro]);

  // Comprueba si el cliente elegido tiene facturas (invoice → sales_order.customer_id).
  useEffect(() => {
    if (!sel) { setFacturas(null); return; }
    let vivo = true;
    setFacturas(null);
    (async () => {
      const { data: ords } = await sb.from("sales_order").select("id").eq("customer_id", sel.id);
      const ids = ((ords as { id: string }[] | null) ?? []).map((o) => o.id);
      let hay = false;
      if (ids.length) {
        const { count } = await sb.from("invoice").select("id", { count: "exact", head: true }).in("order_id", ids);
        hay = (count ?? 0) > 0;
      }
      if (vivo) setFacturas(hay);
    })();
    return () => { vivo = false; };
  }, [sel, sb]);

  async function guardar() {
    if (!form.nombre.trim()) return;
    const payload = {
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
      tarifa_id: form.tarifa_id || null,
      descuento_pct: Number(String(form.descuento_pct).replace(",", ".")) || 0,
    };
    const { data, error } = editId
      ? await sb.from("customer").update(payload).eq("id", editId).select(CLI_COLS).single()
      : await sb.from("customer").insert(payload).select(CLI_COLS).single();
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
    upsert(data as Cli);                                     // caché al instante, sin recargar
    setAlta(false); setEditId(null); setForm(FORM0); setSel(data as Cli);
    toast.success(editId ? "Cliente actualizado" : "Cliente creado");
  }

  async function eliminar() {
    if (!sel) return;
    if (!(await confirmar({ titulo: `¿Eliminar a ${sel.nombre}?`, mensaje: "No se puede deshacer.", textoConfirmar: "Eliminar", peligroso: true }))) return;
    const { error } = await sb.from("customer").delete().eq("id", sel.id);
    if (error) { toast.error(`No se pudo eliminar: ${error.message}`); return; }
    quitar(sel.id);
    toast.success("Cliente eliminado");
    setSel(null);
  }
  const editarSel = () => { if (!sel) return; setForm(aForm(sel)); setEditId(sel.id); setAlta(true); };

  const sub = `${mesaNombre ?? "Barra"} · ${comensales} pax`;

  return (
    <>
    {dialogo}
    <ModalTPV
      titulo="Cliente"
      subtitulo={sub}
      ancho={1160}
      alto={760}
      onClose={onClose}
      derecha={<div className="text-right"><div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ticket</div><b className="text-lg tabular-nums">{eur(total)}</b></div>}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_372px] gap-2 p-2">
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
              {([["todos", "Todos"], ["hoy", "Hoy"], ["deuda", "Con deuda"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setFiltro(v)} aria-pressed={filtro === v}
                  className={`h-9 rounded-md border px-3 text-xs font-bold ${filtro === v ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>{l}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!cargado && clientes.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Cargando…</p>}
              {cargado && lista.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Sin resultados. Usa «Cliente nuevo».</p>}
              {lista.map((c) => {
                const activo = sel?.id === c.id;
                const st = stats[c.id];
                const emp = esEmpresa(c);
                return (
                  <button type="button" key={c.id} onClick={() => { setSel(c); setAlta(false); }}
                    className={`flex w-full items-center gap-2.5 border-b border-border px-2.5 py-1.5 text-left transition-colors ${activo ? "bg-brand/10 shadow-[inset_3px_0_0_var(--brand)]" : "hover:bg-accent"}`}>
                    <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full text-xs font-bold" style={colorAvatar(c.nombre)}>{iniciales(c.nombre)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-bold">{c.nombre}</span>
                        {emp && <span className="flex-none rounded-sm bg-sky-500/15 px-1 py-px text-[8.5px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">Empresa</span>}
                        {c.notas && <span title={c.notas} className="flex-none rounded-sm bg-amber-500/15 px-1 py-px text-[8.5px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-500">Alergias</span>}
                      </span>
                      <span className="mt-px block truncate text-[10.5px] font-medium text-muted-foreground">
                        {c.telefono ?? "sin teléfono"} · {c.nif || "sin NIF"}{st ? ` · ${st.visitas} visita${st.visitas === 1 ? "" : "s"} · ${relativa(st.ultima)}` : ""}
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      <span className="block text-[12.5px] font-bold">{tarifaNombre(c.tarifa_id)}</span>
                      {Number(c.descuento_pct) > 0 && <span className="block text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">−{Number(c.descuento_pct)}%</span>}
                    </span>
                    {Number(c.saldo) > 0
                      ? <span title="Debe" className="flex-none rounded-sm bg-rose-500/15 px-1 py-0.5 text-[8.5px] font-bold text-rose-600 dark:text-rose-400">DEBE {eur(Number(c.saldo))}</span>
                      : facturable(c) && <span title="Facturable" className="flex-none rounded-sm bg-emerald-500/15 px-1 py-0.5 text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400">FACTURA</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Panel derecho: ficha o alta ── */}
          <section className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
            <h3 className="flex flex-none items-center gap-2 border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>{alta ? (editId ? "Editar cliente" : "Cliente nuevo") : "Ficha del cliente"}</span>
              {!alta && sel && (
                <span className="ml-auto flex items-center gap-1.5">
                  {stats[sel.id] && <span className="mr-1 text-[11px] font-semibold normal-case tracking-normal text-muted-foreground">{stats[sel.id]!.visitas} visitas</span>}
                  <button type="button" onClick={editarSel} disabled={facturas !== false}
                    title={facturas === true ? "Tiene facturas emitidas: no se puede editar" : facturas === null ? "Comprobando…" : "Editar datos"}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-foreground hover:bg-accent disabled:opacity-40">
                    <Pencil size={13} /> Editar
                  </button>
                  {/* Borrar SOLO si es un cliente "pelado" (solo nombre) y sin facturas. */}
                  {!tieneDatos(sel) && facturas === false && (
                    <button type="button" onClick={eliminar}
                      className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-rose-600 hover:bg-rose-500/20">
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                </span>
              )}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {alta ? (
                <Alta form={form} setForm={setForm} tarifas={tarifas} />
              ) : sel ? (
                <Ficha c={sel} tarifa={tarifaNombre(sel.tarifa_id)} empresa={esEmpresa(sel)} st={stats[sel.id]} />
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
              <button type="button" onClick={() => { setAlta(false); setEditId(null); }} className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent"><ArrowLeft size={16} /> Volver</button>
              <button type="button" onClick={guardar} disabled={!form.nombre.trim()} className="ml-auto flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-bold text-brand-foreground hover:bg-brand-hover disabled:opacity-40"><Check size={17} /> Guardar cliente</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setAlta(true); setEditId(null); setSel(null); setForm(FORM0); }} className="flex h-11 items-center gap-2 rounded-md border border-brand/40 bg-brand/10 px-4 text-sm font-bold text-brand hover:bg-brand/20"><UserPlus size={17} /> Cliente nuevo</button>
              {clienteActual &&<button type="button" onClick={onQuitar} className="flex h-11 items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-500/20"><X size={16} /> Quitar del ticket</button>}
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={onClose} className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent">Cancelar</button>
                <button type="button" onClick={() => sel && onAsignar(sel)} disabled={!sel} className="flex h-11 items-center gap-2 rounded-md bg-brand px-5 text-sm font-bold text-brand-foreground hover:bg-brand-hover disabled:opacity-40"><Check size={17} /> Asignar al ticket</button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalTPV>
    </>
  );
}

// ── Ficha (solo lectura) del cliente elegido ──
function Ficha({ c, tarifa, empresa, st }: Readonly<{ c: Cli; tarifa: string; empresa: boolean; st?: { visitas: number; ultima: string | null } }>) {
  const fac = facturable(c);
  const falta = [!c.nif && "el NIF", !(c.direccion && c.codigo_postal && c.poblacion) && "la dirección fiscal"].filter(Boolean).join(" y ");
  const deuda = Number(c.saldo);
  // Compacto (TPV): TODAS las filas; si no hay valor, sale el texto gris (placeholder).
  const dato = (l: string, v: React.ReactNode, placeholder: string) => (
    <div className="flex items-baseline gap-2.5 border-b border-border-muted py-1.5 text-[12.5px]">
      <span className="w-[84px] flex-none text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{l}</span>
      {v ? <span className="flex-1 font-bold">{v}</span> : <span className="flex-1 italic text-muted-foreground/70">{placeholder}</span>}
    </div>
  );
  const dirFiscal = [c.direccion, [c.codigo_postal, c.poblacion].filter(Boolean).join(" "), c.provincia].filter(Boolean).join(", ");
  return (
    <div className="text-sm">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-sm font-bold" style={colorAvatar(c.nombre)}>{iniciales(c.nombre)}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold leading-tight">{c.nombre}</span>
            {empresa && <span className="flex-none rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">Empresa</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">{empresa ? "Empresa" : "Particular"}{st?.ultima ? ` · última visita: ${relativa(st.ultima)}` : ""}</div>
        </div>
      </div>
      {/* Alergias / avisos de cocina */}
      {c.notas && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-500">
          <TriangleAlert size={13} className="mt-0.5 flex-none" /><span>{c.notas}. Sale impreso en la comanda de cocina.</span>
        </div>
      )}
      {/* Deuda (solo si debe) */}
      {deuda > 0 && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
          <TriangleAlert size={13} className="mt-0.5 flex-none" /><span>Cuenta pendiente de {eur(deuda)}. Puedes cobrarla junto con este ticket.</span>
        </div>
      )}
      {/* Facturable → verde; si no, amber */}
      {fac ? (
        <div className="mb-2.5 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><Check size={13} className="flex-none" /> Datos completos: se le puede hacer factura.</div>
      ) : (
        <div className="mb-2.5 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-500"><TriangleAlert size={13} className="flex-none" /> Le falta {falta}: solo ticket, no factura.</div>
      )}
      {dato("NIF / CIF", c.nif, "sin poner")}
      {dato("Teléfono", c.telefono, "sin poner")}
      {dato("Mail", c.email, "sin poner")}
      {dato("Dirección", dirFiscal, "sin poner")}
      {dato("Tarifa", tarifa, "General")}
      {dato("Descuento", Number(c.descuento_pct) > 0 ? `${Number(c.descuento_pct)} %` : null, "sin descuento")}
      {dato("Cuenta", deuda > 0 ? <span className="text-rose-600 dark:text-rose-400">{eur(deuda)} pendientes</span> : null, "al día")}
      {dato("Promociones", c.consentimiento_marketing ? "acepta que le escribáis" : null, "no ha dado permiso")}
    </div>
  );
}

// ── Alta / edición de cliente ──
function Alta({ form, setForm, tarifas }: Readonly<{ form: typeof FORM0; setForm: React.Dispatch<React.SetStateAction<typeof FORM0>>; tarifas: { id: string; nombre: string }[] }>) {
  const campo = (k: keyof typeof FORM0, label: string, opts?: { placeholder?: string; upper?: boolean; wide?: boolean }) => (
    <label className={`flex flex-col gap-1 ${opts?.wide ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={form[k] as string} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        placeholder={opts?.placeholder} className={`h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand ${opts?.upper ? "uppercase" : ""}`} />
    </label>
  );
  const tit = "col-span-2 mt-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={tit}>Datos</div>
      {campo("nombre", "Nombre / Razón social", { placeholder: "Nombre", wide: true })}
      {campo("nif", "NIF / CIF", { upper: true })}
      {campo("telefono", "Teléfono")}
      {campo("email", "Email", { wide: true })}
      {campo("direccion", "Dirección", { wide: true })}
      {campo("codigo_postal", "C. Postal")}
      {campo("poblacion", "Población")}
      {campo("provincia", "Provincia", { wide: true })}

      {/* Cómo se le vende */}
      <div className={tit}>Cómo se le vende</div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tarifa</span>
        <select value={form.tarifa_id} onChange={(e) => setForm((f) => ({ ...f, tarifa_id: e.target.value }))}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand">
          <option value="">General</option>
          {tarifas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Descuento fijo %</span>
        <input value={form.descuento_pct} inputMode="decimal" onChange={(e) => setForm((f) => ({ ...f, descuento_pct: e.target.value }))}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Alergias y avisos para cocina</span>
        <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} rows={2}
          placeholder="Ej.: celíaco, alérgico a los frutos secos" className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" />
      </label>
      <label className="col-span-2 flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
        <input type="checkbox" checked={form.consentimiento_marketing} onChange={(e) => setForm((f) => ({ ...f, consentimiento_marketing: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-(--brand)" />
        <span><b>Acepta recibir promociones</b><br /><span className="text-xs text-muted-foreground">Sin esta casilla marcada no se le puede escribir. Lo dice el RGPD.</span></span>
      </label>
    </div>
  );
}
