"use client";

// Modal COBRAR (estilo Ágora): reparto de pagos (mixto), propina, descuento,
// "A devolver" en grande y atajos F10/F11/F12. PRESENTACIONAL y FISCALMENTE
// NEUTRO: recibe total, base imponible e impuesto ya calculados por props (el
// TPV los saca de @gluuh/core); aquí solo se reparte el dinero. Nunca recalcula
// impuestos. Skill: gluuh-ux-operativa (un solo acento = Cobrar).
import { useEffect, useMemo, useState } from "react";
import { Delete, Pencil, Mail, Printer, X } from "lucide-react";

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
}

export interface CobrarModalProps {
  total: number;
  baseImponible: number;
  impuesto: number;
  cliente?: string;
  empleado?: string;
  terminal?: string;
  formasPago: FormaPago[];
  tiposDoc?: string[];
  onCobrar(pagos: LineaPago[], opciones: CobrarOpciones): void;
  onImprimirCuenta(): void;
  onEmail?(): void;
  onCancelar(): void;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";
const TIPOS_DOC_DEF = ["Factura simplificada", "Factura completa"];

// Objetivo del teclado numérico: una línea de pago, el descuento o la propina.
type Objetivo = { tipo: "pago"; idx: number } | { tipo: "descuento" } | { tipo: "propina" };

export function CobrarModal({
  total,
  baseImponible,
  impuesto,
  cliente,
  empleado,
  terminal,
  formasPago,
  tiposDoc = TIPOS_DOC_DEF,
  onCobrar,
  onImprimirCuenta,
  onEmail,
  onCancelar,
}: CobrarModalProps) {
  const primeraForma = formasPago[0]?.id ?? "";
  const [pagos, setPagos] = useState<LineaPago[]>(() => [{ formaPagoId: primeraForma, importe: total }]);
  const [objetivo, setObjetivo] = useState<Objetivo>({ tipo: "pago", idx: 0 });
  const [display, setDisplay] = useState<string>(() => total.toFixed(2));
  const [reemplazar, setReemplazar] = useState(true); // primera tecla sobrescribe el valor
  const [descuento, setDescuento] = useState(0);
  const [propina, setPropina] = useState(0);
  const [notas, setNotas] = useState("");
  const [tipoDoc, setTipoDoc] = useState<string>(tiposDoc[0] ?? TIPOS_DOC_DEF[0]!);
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

  function valorObjetivo(o: Objetivo): number {
    if (o.tipo === "descuento") return descuento;
    if (o.tipo === "propina") return propina;
    return pagos[o.idx]?.importe ?? 0;
  }

  function escribirObjetivo(o: Objetivo, n: number) {
    if (o.tipo === "descuento") setDescuento(n);
    else if (o.tipo === "propina") setPropina(n);
    else setPagos((prev) => prev.map((p, i) => (i === o.idx ? { ...p, importe: n } : p)));
  }

  function seleccionar(o: Objetivo) {
    setObjetivo(o);
    setDisplay(valorObjetivo(o).toFixed(2));
    setReemplazar(true);
  }

  // ── Teclado numérico ──────────────────────────────────────────────────────
  function pulsar(tecla: string) {
    setDisplay((prev) => {
      let base = reemplazar ? "" : prev;
      if (tecla === "borrar") base = base.slice(0, -1);
      else if (tecla === ".") base = base.includes(".") ? base : (base || "0") + ".";
      else base = (base === "0" ? "" : base) + tecla;
      if (base.length > 10) base = prev;
      const n = Number(base) || 0;
      escribirObjetivo(objetivo, Math.round(n * 100) / 100);
      return base;
    });
    setReemplazar(false);
  }

  // ── Formas de pago ────────────────────────────────────────────────────────
  function elegirForma(id: string) {
    // Aplica la forma a la línea de pago activa (o a la última si el foco está en desc./propina).
    const idx = objetivo.tipo === "pago" ? objetivo.idx : pagos.length - 1;
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, formaPagoId: id } : p)));
    seleccionar({ tipo: "pago", idx: Math.max(0, idx) });
  }

  function anadirLinea() {
    const restante = Math.max(0, Math.round((importeACobrar - pagado) * 100) / 100);
    setPagos((prev) => [...prev, { formaPagoId: primeraForma, importe: restante }]);
    const idx = pagos.length;
    setObjetivo({ tipo: "pago", idx });
    setDisplay(restante.toFixed(2));
    setReemplazar(true);
  }

  function quitarLinea(idx: number) {
    setPagos((prev) => {
      if (prev.length <= 1) return [{ formaPagoId: primeraForma, importe: 0 }];
      return prev.filter((_, i) => i !== idx);
    });
    seleccionar({ tipo: "pago", idx: 0 });
  }

  const formaActiva = objetivo.tipo === "pago" ? pagos[objetivo.idx]?.formaPagoId : undefined;

  // ── Cobro ─────────────────────────────────────────────────────────────────
  function cobrar(imprimir: boolean) {
    if (!puedeCobrar) return;
    onCobrar(
      pagos.filter((p) => p.importe > 0),
      { imprimir, tipoDoc, propina, descuento, notas: notas.trim() },
    );
  }

  // Atajos F10 (imprimir cuenta) / F11 (cobrar+imprimir) / F12 (cobrar) + Esc.
  // Además, teclado numérico físico alimenta el display si el foco no está en un campo de texto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const enCampo = !!t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if (e.key === "F10") { e.preventDefault(); onImprimirCuenta(); return; }
      if (e.key === "F11") { e.preventDefault(); cobrar(true); return; }
      if (e.key === "F12") { e.preventDefault(); cobrar(zonasImpresion); return; }
      if (e.key === "Escape") { e.preventDefault(); onCancelar(); return; }
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
        <Dato label="Cliente" valor={cliente ?? "General"} />
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
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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

      {/* Fila de importes fiscales (recibidos por props, no se recalculan) */}
      <div className="flex flex-none flex-wrap items-stretch gap-2 border-b border-border bg-surface/40 px-4 py-2.5">
        <Cifra label="Importe" valor={eur(importeACobrar)} destacado />
        <Cifra label="B. Imp." valor={eur(baseImponible)} />
        <Cifra label="Impuesto" valor={eur(impuesto)} />
        <Cifra label="Descuento" valor={eur(descuento)} activo={objetivo.tipo === "descuento"} />
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
        {/* Izquierda: líneas de pago + descuento/propina */}
        <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Formas de pago</span>
            <button type="button" onClick={anadirLinea} className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold transition-all hover:bg-accent active:scale-95">
              + Añadir
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pagos.map((p, i) => {
              const activo = objetivo.tipo === "pago" && objetivo.idx === i;
              return (
                <div
                  key={i}
                  className={`mb-1.5 flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                    activo ? "border-brand bg-brand/10" : "border-border bg-background"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => seleccionar({ tipo: "pago", idx: i })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {nombreForma[p.formaPagoId] ?? "—"}
                    </span>
                    <span className="text-base font-bold tabular-nums">{eur(p.importe)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quitarLinea(i)}
                    aria-label="Quitar forma de pago"
                    className="grid h-8 w-8 flex-none place-items-center rounded-md transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
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

        {/* Centro: teclado numérico */}
        <section className="flex w-full min-w-0 select-none flex-col rounded-xl border border-border bg-card p-2 lg:w-72">
          <div className="mb-2 rounded-lg border border-border bg-background px-3 py-3.5 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {objetivo.tipo === "pago"
                ? `Importe · ${nombreForma[formaActiva ?? ""] ?? ""}`
                : objetivo.tipo === "descuento"
                  ? "Descuento"
                  : "Propina"}
            </div>
            <div className="text-4xl font-bold leading-tight tabular-nums">{display || "0"}</div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {teclas.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pulsar(k)}
                className="grid min-h-16 place-items-center rounded-lg border border-border bg-background text-2xl font-semibold transition-all hover:border-border-strong hover:bg-accent active:scale-[.96] active:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {k === "borrar" ? <Delete size={24} /> : k}
              </button>
            ))}
          </div>
        </section>

        {/* Derecha: formas de pago (botones grandes) + impresión + a devolver */}
        <section className="flex min-h-0 flex-col gap-2">
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto">
            {formasPago.map((f) => {
              const activo = f.id === formaActiva;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => elegirForma(f.id)}
                  className={`grid min-h-16 place-items-center rounded-xl border-2 px-2 text-center text-sm font-bold uppercase transition-all active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activo
                      ? "border-brand bg-brand text-white shadow-lg shadow-brand/30"
                      : "border-border bg-card hover:border-border-strong hover:bg-accent"
                  }`}
                >
                  {f.nombre}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setZonasImpresion((v) => !v)}
            aria-pressed={zonasImpresion}
            className="flex flex-none items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold transition-all hover:bg-accent active:scale-[.99]"
          >
            <span className="flex items-center gap-2"><Printer size={16} /> Zonas de impresión</span>
            <span className={zonasImpresion ? "font-bold text-brand" : "text-muted-foreground"}>
              {zonasImpresion ? "Activadas" : "Desactivadas"}
            </span>
          </button>

          {/* A devolver — GIGANTE, legible a 1 m */}
          <div className={`flex-none rounded-xl border-2 px-4 py-4 text-right transition-colors ${aDevolver > 0 ? "border-brand bg-brand/10 ring-1 ring-brand/30" : "border-border bg-card"}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {falta > 0 ? `Falta ${eur(falta)}` : "A devolver"}
            </div>
            <div className={`text-5xl font-black leading-none tabular-nums lg:text-6xl ${aDevolver > 0 ? "text-brand" : "text-foreground"}`}>
              {eur(aDevolver)}
            </div>
          </div>
        </section>
      </div>

      {/* Pie: acciones con atajos impresos */}
      <footer className="flex flex-none flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-3">
        <button type="button" onClick={onCancelar} className="min-h-14 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          Cancelar
        </button>
        {onEmail && (
          <button type="button" onClick={onEmail} className="flex min-h-14 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">
            <Mail size={16} /> Enviar por Email
          </button>
        )}
        <button
          type="button"
          onClick={onImprimirCuenta}
          className="ml-auto flex min-h-14 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]"
        >
          <Printer size={16} /> Imprimir cuenta <Atajo>F10</Atajo>
        </button>
        <button
          type="button"
          onClick={() => cobrar(true)}
          disabled={!puedeCobrar}
          className="flex min-h-14 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] disabled:opacity-40 disabled:active:scale-100"
        >
          Cobrar Imprimir <Atajo>F11</Atajo>
        </button>
        <button
          type="button"
          onClick={() => cobrar(zonasImpresion)}
          disabled={!puedeCobrar}
          className="flex min-h-14 items-center gap-2 rounded-md bg-brand px-7 text-lg font-bold text-white shadow-lg shadow-brand/30 transition-all hover:bg-brand-hover active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-40 disabled:shadow-none disabled:hover:bg-brand disabled:active:scale-100"
        >
          Cobrar <Atajo tono="brand">F12</Atajo>
        </button>
      </footer>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium">{valor}</span>
    </span>
  );
}

function Cifra({ label, valor, activo, destacado }: { label: string; valor: string; activo?: boolean; destacado?: boolean }) {
  const estilo = activo
    ? "border-brand bg-brand/5"
    : destacado
      ? "border-brand/40 bg-brand/5"
      : "border-border bg-card";
  return (
    <div className={`min-w-28 flex-1 rounded-lg border px-3 py-2 ${estilo}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-bold tabular-nums ${destacado ? "text-brand" : ""}`}>{valor}</div>
    </div>
  );
}

function Atajo({ children, tono }: { children: React.ReactNode; tono?: "brand" }) {
  return (
    <kbd className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${tono === "brand" ? "border-white/30 bg-white/20 text-white" : "border-border-strong/50 bg-surface-overlay text-muted-foreground"}`}>
      {children}
    </kbd>
  );
}
