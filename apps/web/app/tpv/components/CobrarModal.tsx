"use client";

// Modal COBRAR (estilo Ágora): reparto de pagos (mixto), propina, descuento,
// "A devolver" en grande y atajos F10/F11/F12.
import { useEffect, useMemo, useState } from "react";
import { Delete, Pencil, Mail, Printer, X, Banknote } from "lucide-react";
import { sugerenciasEfectivo, desglosarCambio } from "../efectivo";
import { eur } from "@/app/lib/money";

// Formatea una denominación EUR para el desglose del cambio: 5 → "5", 0,5 → "0,50".
const fmtDenom = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(2).replace(".", ","));

export interface FormaPago {
  id: string;
  nombre: string;
  /** CONTADO / TARJETA / CHEQUE / PAGO QR … (solo informativo). */
  tipo: string;
}

export interface LineaPago {
  formaPagoId: string;
  importe: number;
}

export interface CobrarOpciones {
  imprimir: boolean;
  tipoDoc: string;
  propina: number;
  descuento: number;
  notas: string;
  /** Enviar la factura al cliente (email) al cobrar. */
  enviarFactura: boolean;
}

export interface CobrarModalProps {
  total: number;
  baseImponible: number;
  impuesto: number;
  cliente?: string;
  /** NIF del cliente asignado. Sin él no cabe factura completa (AEAT F1). */
  clienteNif?: string | null;
  empleado?: string;
  terminal?: string;
  formasPago: FormaPago[];
  tiposDoc?: string[];
  onCobrar(pagos: LineaPago[], opciones: CobrarOpciones): void;
  onImprimirCuenta(): void;
  onEmail?(): void;
  onCancelar(): void;
}

const TIPOS_DOC_DEF = ["Factura simplificada", "Factura completa"];

/** Factura COMPLETA (AEAT F1): exige destinatario con NIF. La simplificada (F2) no. */
const esCompleta = (t: string) => t.toLowerCase().includes("completa");

type Objetivo = { tipo: "pago" } | { tipo: "descuento" } | { tipo: "propina" };

export function CobrarModal({
  total,
  baseImponible,
  impuesto,
  cliente,
  clienteNif,
  empleado,
  terminal,
  formasPago,
  tiposDoc = TIPOS_DOC_DEF,
  onCobrar,
  onImprimirCuenta,
  onEmail,
  onCancelar,
}: CobrarModalProps) {
  const [pagos, setPagos] = useState<LineaPago[]>([]);
  const [objetivo, setObjetivo] = useState<Objetivo>({ tipo: "pago" });
  const [descuento, setDescuento] = useState(0);
  const [propina, setPropina] = useState(0);
  const [display, setDisplay] = useState<string>(() => (total + propina - descuento).toFixed(2));
  const [reemplazar, setReemplazar] = useState(true);
  const [notas, setNotas] = useState("");
  const [tipoDoc, setTipoDoc] = useState<string>(tiposDoc[0] ?? TIPOS_DOC_DEF[0]!);
  const [enviarFactura, setEnviarFactura] = useState(false);
  const [zonasImpresion, setZonasImpresion] = useState(true);
  const [editandoNotas, setEditandoNotas] = useState(false);
  const [ahora] = useState(() => new Date());

  const importeACobrar = Math.max(0, Math.round((total + propina - descuento) * 100) / 100);
  const pagado = useMemo(() => pagos.reduce((s, p) => s + (p.importe || 0), 0), [pagos]);
  const aDevolver = Math.max(0, Math.round((pagado - importeACobrar) * 100) / 100);
  const falta = Math.max(0, Math.round((importeACobrar - pagado) * 100) / 100);
  const puedeCobrar = pagado >= importeACobrar - 0.005;

  const nombreForma = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of formasPago) m[f.id] = f.nombre;
    return m;
  }, [formasPago]);

  const formaEfectivo = useMemo(() => {
    return formasPago.find((f) => f.tipo === "CONTADO") || formasPago[0];
  }, [formasPago]);

  function seleccionar(o: Objetivo) {
    setObjetivo(o);
    if (o.tipo === "descuento") setDisplay(descuento > 0 ? descuento.toFixed(2) : "");
    else if (o.tipo === "propina") setDisplay(propina > 0 ? propina.toFixed(2) : "");
    else {
      setDisplay(falta > 0 ? falta.toFixed(2) : "");
    }
    setReemplazar(true);
  }

  function pulsar(tecla: string) {
    setDisplay((prev) => {
      let base = reemplazar ? "" : prev;
      if (tecla === "borrar") base = base.slice(0, -1);
      else if (tecla === ".") base = base.includes(".") ? base : (base || "0") + ".";
      else base = (base === "0" ? "" : base) + tecla;
      if (base.length > 10) base = prev;
      const n = Number(base) || 0;
      
      if (objetivo.tipo === "descuento") setDescuento(n);
      else if (objetivo.tipo === "propina") setPropina(n);
      
      return base;
    });
    setReemplazar(false);
  }

  function registrarPago(formaPagoId: string) {
    const val = Number(display) || 0;
    if (val <= 0) return;

    const forma = formasPago.find((f) => f.id === formaPagoId);
    const esTarjeta = forma?.tipo === "TARJETA";
    const importeReal = esTarjeta ? Math.min(val, falta) : val;

    setPagos((prev) => [...prev, { formaPagoId, importe: importeReal }]);

    const nuevoPagado = pagado + importeReal;
    const nuevoFalta = Math.max(0, Math.round((importeACobrar - nuevoPagado) * 100) / 100);

    setDisplay(nuevoFalta > 0 ? nuevoFalta.toFixed(2) : "0.00");
    setReemplazar(true);
    setObjetivo({ tipo: "pago" });
  }

  function registrarEfectivoRapido(importe: number) {
    if (!formaEfectivo) return;
    setPagos((prev) => [...prev, { formaPagoId: formaEfectivo.id, importe }]);
    
    const nuevoPagado = pagado + importe;
    const nuevoFalta = Math.max(0, Math.round((importeACobrar - nuevoPagado) * 100) / 100);

    setDisplay(nuevoFalta > 0 ? nuevoFalta.toFixed(2) : "0.00");
    setReemplazar(true);
    setObjetivo({ tipo: "pago" });
  }

  function cobrar(imprimir: boolean) {
    if (!puedeCobrar) return;
    onCobrar(
      pagos.filter((p) => p.importe > 0),
      { imprimir, tipoDoc, propina, descuento, notas: notas.trim(), enviarFactura },
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const enCampo = !!t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if (e.key === "F10") { e.preventDefault(); onImprimirCuenta(); return; }
      if (e.key === "F11") { e.preventDefault(); cobrar(true); return; }
      if (e.key === "F12") { e.preventDefault(); cobrar(zonasImpresion); return; }
      if (e.key === "Escape") { e.preventDefault(); onCancelar(); return; }
      if (e.key === "Enter" && puedeCobrar && !enCampo) { e.preventDefault(); cobrar(zonasImpresion); return; }
      if (enCampo) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pulsar(e.key); }
      else if (e.key === "." || e.key === ",") { e.preventDefault(); pulsar("."); }
      else if (e.key === "Backspace") { e.preventDefault(); pulsar("borrar"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeCobrar, zonasImpresion, pagos, objetivo, reemplazar, display, propina, descuento, notas, tipoDoc]);

  const teclas = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "borrar"];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Cobrar"
    >
      {/* Cabecera: contexto + tipo de documento + fecha */}
      <header className="flex flex-none flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border bg-surface px-5 py-3 text-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden className="h-5 w-1 rounded-full bg-brand" />
          Cobrar
        </h2>
        <Dato label="Cliente" valor={clienteNif ? `${cliente} · ${clienteNif}` : (cliente ?? "General")} />
        <Dato label="Empleado" valor={empleado ?? "—"} />
        <Dato label="Terminal" valor={terminal ?? "—"} />
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo doc</span>
          <select
            value={tipoDoc}
            onChange={(e) => setTipoDoc(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {tiposDoc.map((t) => (
              // La AEAT solo admite factura COMPLETA (F1) con destinatario identificado.
              // Sin cliente con NIF no se puede emitir: se deshabilita en vez de ofrecer
              // algo que luego saldría como simplificada igualmente.
              <option key={t} value={t} disabled={esCompleta(t) && !clienteNif}>
                {esCompleta(t) && !clienteNif ? `${t} (asigna un cliente con NIF)` : t}
              </option>
            ))}
          </select>
        </label>
        {/* Enviar la factura al cliente al cobrar (necesita un cliente asignado). */}
        <label className={`flex items-center gap-1.5 ${cliente ? "" : "opacity-40"}`} title={cliente ? "Enviar la factura al cliente al cobrar" : "Asigna un cliente para poder enviarle la factura"}>
          <input type="checkbox" checked={enviarFactura} disabled={!cliente} onChange={(e) => setEnviarFactura(e.target.checked)} className="h-4 w-4 accent-(--brand)" />
          <span className="text-[13px] font-medium">Enviar factura</span>
        </label>
        <Dato label="Fecha" valor={ahora.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })} />
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cerrar"
          className="ml-auto grid h-10 w-10 place-items-center rounded-md border border-border bg-card transition-all hover:bg-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X size={18} />
        </button>
      </header>

      {/* Fila de importes fiscales */}
      <div className="flex flex-none flex-wrap items-stretch gap-2 border-b border-border bg-surface/40 px-4 py-2.5">
        <Cifra label="Total a Cobrar" valor={eur(importeACobrar)} destacado />
        <Cifra label="B. Imp." valor={eur(baseImponible)} />
        <Cifra label="Impuesto" valor={eur(impuesto)} />
        <Cifra label="Descuento" valor={eur(descuento)} activo={objetivo.tipo === "descuento"} onClick={() => seleccionar({ tipo: "descuento" })} />
        <Cifra label="Propina" valor={eur(propina)} activo={objetivo.tipo === "propina"} onClick={() => seleccionar({ tipo: "propina" })} />
        <button
          type="button"
          onClick={() => setEditandoNotas((v) => !v)}
          className="flex min-w-40 flex-1 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-left transition-colors hover:bg-accent"
        >
          <Pencil size={15} className="flex-none text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notas</span>
            <span className="block truncate text-sm">{notas || "Añadir nota…"}</span>
          </span>
        </button>
      </div>
      {editandoNotas && (
        <div className="flex-none border-b border-border px-4 py-2">
          <textarea
            autoFocus
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => setEditandoNotas(false)}
            rows={2}
            placeholder="Notas del documento…"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
      )}

      {/* Cuerpo: 3 columnas */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        
        {/* Izquierda: listado de pagos registrados */}
        <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Desglose de Pago</span>
            {falta > 0 ? (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500">
                Falta {eur(falta)}
              </span>
            ) : (
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-500">
                Cubierto
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pagos.map((p, i) => (
              <div
                key={i}
                className="mb-1.5 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {nombreForma[p.formaPagoId] ?? "Forma de pago"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Pago {i + 1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold tabular-nums text-foreground">{eur(p.importe)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPagos((prev) => prev.filter((_, idx) => idx !== i));
                      setTimeout(() => {
                        seleccionar({ tipo: "pago" });
                      }, 0);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            {pagos.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2 h-full">
                <Banknote size={28} className="opacity-55" />
                <p className="text-xs max-w-xs leading-normal">
                  Escribe un importe y pulsa un tipo de cobro a la derecha. O usa los accesos directos de abajo.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border p-2 bg-surface/30">
            <button
              type="button"
              onClick={() => seleccionar({ tipo: "descuento" })}
              className={`min-h-14 rounded-lg border text-sm font-semibold transition-all active:scale-[.98] ${
                objetivo.tipo === "descuento" ? "border-brand bg-brand/10 text-brand" : "border-border bg-background hover:bg-accent"
              }`}
            >
              Descuento
              <span className="block text-xs tabular-nums text-muted-foreground">{eur(descuento)}</span>
            </button>
            <button
              type="button"
              onClick={() => seleccionar({ tipo: "propina" })}
              className={`min-h-14 rounded-lg border text-sm font-semibold transition-all active:scale-[.98] ${
                objetivo.tipo === "propina" ? "border-brand bg-brand/10 text-brand" : "border-border bg-background hover:bg-accent"
              }`}
            >
              Propina
              <span className="block text-xs tabular-nums text-muted-foreground">{eur(propina)}</span>
            </button>
          </div>
        </section>

        {/* Centro: teclado numérico + atajos de efectivo */}
        <section className="flex w-full min-w-0 select-none flex-col rounded-xl border border-border bg-card p-2 lg:w-72">
          <div 
            onClick={() => seleccionar({ tipo: "pago" })}
            className={`mb-2 rounded-lg border px-3 py-3 text-right cursor-pointer transition-colors ${
              objetivo.tipo === "pago" ? "border-brand bg-brand/5" : "border-border bg-background"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {objetivo.tipo === "pago"
                ? "Importe a Registrar"
                : objetivo.tipo === "descuento"
                  ? "Editar Descuento"
                  : "Editar Propina"}
            </div>
            <div className="text-4xl font-bold leading-tight tabular-nums">{display || "0.00"}</div>
          </div>
          
          <div className="grid grid-cols-3 gap-1.5 flex-1">
            {teclas.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pulsar(k)}
                className="grid min-h-12 place-items-center rounded-lg border border-border bg-background text-xl font-semibold transition-all hover:border-border-strong hover:bg-accent active:scale-[.96] active:bg-brand/10 focus-visible:outline-none"
              >
                {k === "borrar" ? <Delete size={20} /> : k}
              </button>
            ))}
          </div>

          {/* Atajos de efectivo rápido */}
          {formaEfectivo && (
            <div className="mt-2.5 border-t border-border pt-2 flex flex-col gap-1.5">
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider pl-1">Efectivo Rápido</div>
              {/* Exacto + billetes inteligentes: sugerencias por ENCIMA del pendiente
                  (no importes fijos), como con lo que suele pagar el cliente. */}
              <div className="grid grid-cols-5 gap-1">
                <button
                  type="button"
                  onClick={() => registrarEfectivoRapido(falta)}
                  disabled={falta <= 0}
                  className="rounded border border-brand/45 bg-brand/5 py-2 text-xs font-black text-brand transition-all hover:bg-brand/10 active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                >
                  Exacto
                </button>
                {sugerenciasEfectivo(falta).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => registrarEfectivoRapido(v)}
                    disabled={falta <= 0}
                    className="rounded border border-border bg-background py-2 text-xs font-bold transition-all hover:bg-accent active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                  >
                    {v} €
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Derecha: formas de pago (botones de un toque) */}
        <section className="flex min-h-0 flex-col gap-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Registrar pago con:</div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {formasPago.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => registrarPago(f.id)}
                className="grid min-h-[56px] place-items-center rounded-xl border border-border bg-card px-2 text-center text-xs font-bold uppercase transition-all hover:border-brand/40 hover:bg-accent hover:text-brand active:scale-[.97] focus-visible:outline-none"
              >
                {f.nombre}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setZonasImpresion((v) => !v)}
            aria-pressed={zonasImpresion}
            className="flex flex-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-all hover:bg-accent active:scale-[.99]"
          >
            <span className="flex items-center gap-1.5"><Printer size={14} /> Zonas de impresión</span>
            <span className={zonasImpresion ? "font-bold text-brand" : "text-muted-foreground"}>
              {zonasImpresion ? "Activadas" : "Desactivadas"}
            </span>
          </button>

          {/* Devuelve / Falta + desglose del cambio (cómo darlo en billetes/monedas) */}
          <div className={`flex-none rounded-xl border px-3 py-2 text-right transition-colors ${aDevolver > 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-card"}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {falta > 0 ? `Falta` : "Cambio a devolver"}
            </div>
            <div className={`text-4xl font-black leading-none tabular-nums ${aDevolver > 0 ? "text-emerald-600 dark:text-emerald-400" : falta > 0 ? "text-amber-500" : "text-foreground"}`}>
              {falta > 0 ? eur(falta) : eur(aDevolver)}
            </div>
            {aDevolver > 0 && (
              <div className="mt-1 text-[11px] font-semibold tabular-nums text-emerald-700/85 dark:text-emerald-400/85">
                {desglosarCambio(aDevolver).map((d) => `${d.n}×${fmtDenom(d.valor)}`).join("  ·  ")}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Pie: acciones */}
      <footer className="flex flex-none flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-3">
        <button type="button" onClick={onCancelar} className="min-h-12 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">
          Cancelar
        </button>
        {onEmail && (
          <button type="button" onClick={onEmail} className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">
            <Mail size={16} /> Enviar por Email
          </button>
        )}
        <button
          type="button"
          onClick={onImprimirCuenta}
          className="ml-auto flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]"
        >
          <Printer size={16} /> Imprimir cuenta <Atajo>F10</Atajo>
        </button>
        <button
          type="button"
          onClick={() => cobrar(true)}
          disabled={!puedeCobrar}
          className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] disabled:opacity-45 disabled:active:scale-100"
        >
          Cobrar Imprimir <Atajo>F11</Atajo>
        </button>
        <button
          type="button"
          onClick={() => cobrar(zonasImpresion)}
          disabled={!puedeCobrar}
          className="flex min-h-12 items-center gap-2 rounded-md bg-brand px-7 text-base font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-[.98] disabled:opacity-45 disabled:hover:bg-brand disabled:active:scale-100"
        >
          Cobrar <Atajo tono="brand">F12</Atajo>
        </button>
      </footer>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-semibold">{valor}</span>
    </span>
  );
}

function Cifra({ label, valor, activo, destacado, onClick }: { label: string; valor: string; activo?: boolean; destacado?: boolean; onClick?: () => void }) {
  const estilo = activo
    ? "border-brand bg-brand/5 ring-1 ring-brand/20"
    : destacado
      ? "border-brand/40 bg-brand/5"
      : "border-border bg-card hover:border-border-strong";
  return (
    <div 
      onClick={onClick}
      className={`min-w-28 flex-1 rounded-lg border px-3 py-1.5 transition-colors ${estilo} ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${destacado ? "text-brand" : ""}`}>{valor}</div>
    </div>
  );
}

function Atajo({ children, tono }: { children: React.ReactNode; tono?: "brand" }) {
  return (
    <kbd className={`rounded border px-1 text-[9px] font-bold ${tono === "brand" ? "border-white/30 bg-white/20 text-white" : "border-border-strong/50 bg-surface-overlay text-muted-foreground"}`}>
      {children}
    </kbd>
  );
}
