"use client";

// Modal COBRAR — fiel a docs/diseño/gluuh-cobro-claro.html: cabecera morada,
// franja de datos (cliente/empleado/terminal · tipo doc/fecha/importe · base/
// impuesto/descuento), cuerpo en 3 columnas (notas + 3 huecos de pago + dto/
// propina/zonas · teclado con visor y "A devolver" · columna de formas de pago),
// y barra inferior con Cancelar / email / F10 / F11 / F12.
// Las formas de pago (contado, tarjeta, bizum, cheque, QR…) NO son fijas: llegan
// de `payment_method` — se habilitan según lo que el local tenga configurado.
// Mejoras conservadas sobre el mockup: efectivo rápido con billetes sugeridos,
// desglose del cambio, guardas fiscales (factura completa exige NIF), enviar
// factura, botón Dividir y atajos de teclado.
import { useEffect, useMemo, useState } from "react";
import {
  Banknote, CreditCard, Smartphone, FileText, QrCode, Coins,
  Delete, Mail, Pencil, Printer, Split, X, XCircle,
} from "lucide-react";
import { sugerenciasEfectivo, desglosarCambio } from "../efectivo";
import { eur } from "@/app/lib/money";
import { ModalTPV } from "./ModalTPV";

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
  /** "Mesa 4", "Parte 1", "Para llevar · Ana"… — se muestra en la cabecera. */
  contexto?: string;
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
  /** Pasar al reparto ("mejor divídelo") sin perder el sitio — abre Dividir cuenta. */
  onDividir?(): void;
  onCancelar(): void;
}

const TIPOS_DOC_DEF = ["Factura simplificada", "Factura completa"];

/** Factura COMPLETA (AEAT F1): exige destinatario con NIF. La simplificada (F2) no. */
const esCompleta = (t: string) => t.toLowerCase().includes("completa");

type Objetivo = { tipo: "pago" } | { tipo: "descuento" } | { tipo: "propina" };

/** Icono por tipo de forma de pago (contado, tarjeta, bizum, cheque, QR…). */
function IconoForma({ tipo, nombre, size = 20 }: Readonly<{ tipo: string; nombre: string; size?: number }>) {
  const clave = `${tipo} ${nombre}`.toUpperCase();
  if (clave.includes("CONTADO") || clave.includes("EFECTIVO")) return <Banknote size={size} />;
  if (clave.includes("TARJETA")) return <CreditCard size={size} />;
  if (clave.includes("BIZUM")) return <Smartphone size={size} />;
  if (clave.includes("CHEQUE") || clave.includes("VALE")) return <FileText size={size} />;
  if (clave.includes("QR")) return <QrCode size={size} />;
  return <Coins size={size} />;
}

// Fila de la franja de datos: etiqueta gris + valor (estilo mockup).
function FilaDato({ label, children, gris }: Readonly<{ label: string; children: React.ReactNode; gris?: boolean }>) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-1.5">
      <span className="rounded-md border border-border bg-surface px-2.5 py-2.5 text-xs font-semibold text-muted-foreground">{label}</span>
      <div className={`flex min-h-11 items-center justify-end overflow-hidden whitespace-nowrap rounded-md border border-border px-2.5 text-right text-[13.5px] font-semibold ${gris ? "bg-surface text-muted-foreground" : "bg-card text-foreground"}`}>
        {children}
      </div>
    </div>
  );
}

export function CobrarModal({
  total,
  baseImponible,
  impuesto,
  contexto,
  cliente,
  clienteNif,
  empleado,
  terminal,
  formasPago,
  tiposDoc = TIPOS_DOC_DEF,
  onCobrar,
  onImprimirCuenta,
  onEmail,
  onDividir,
  onCancelar,
}: CobrarModalProps) {
  const [pagos, setPagos] = useState<LineaPago[]>([]);
  const [objetivo, setObjetivo] = useState<Objetivo>({ tipo: "pago" });
  const [descuento, setDescuento] = useState(0);
  const [propina, setPropina] = useState(0);
  const [display, setDisplay] = useState("");
  const [reemplazar, setReemplazar] = useState(true);
  const [notas, setNotas] = useState("");
  const [tipoDoc, setTipoDoc] = useState<string>(tiposDoc[0] ?? TIPOS_DOC_DEF[0]!);
  const [enviarFactura, setEnviarFactura] = useState(false);
  const [zonasImpresion, setZonasImpresion] = useState(true);
  const [ahora] = useState(() => new Date());

  const importeACobrar = Math.max(0, Math.round((total + propina - descuento) * 100) / 100);
  const pagado = useMemo(() => pagos.reduce((s, p) => s + (p.importe || 0), 0), [pagos]);
  const aDevolver = Math.max(0, Math.round((pagado - importeACobrar) * 100) / 100);
  const falta = Math.max(0, Math.round((importeACobrar - pagado) * 100) / 100);
  const puedeCobrar = pagado >= importeACobrar - 0.005;
  const MAX_PAGOS = 3;   // como el mockup: tres huecos de pago por ticket

  const nombreForma = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of formasPago) m[f.id] = f.nombre;
    return m;
  }, [formasPago]);

  const formaEfectivo = useMemo(
    () => formasPago.find((f) => f.tipo === "CONTADO") || formasPago[0],
    [formasPago],
  );

  function seleccionar(o: Objetivo) {
    setObjetivo(o);
    if (o.tipo === "descuento") setDisplay(descuento > 0 ? descuento.toFixed(2) : "");
    else if (o.tipo === "propina") setDisplay(propina > 0 ? propina.toFixed(2) : "");
    else setDisplay("");
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
      if (objetivo.tipo === "descuento") setDescuento(Math.min(n, total));
      else if (objetivo.tipo === "propina") setPropina(n);
      return base;
    });
    setReemplazar(false);
  }

  // Un toque en la forma de pago: con importe tecleado lo aplica; sin nada
  // tecleado aplica LO QUE FALTA (cobro de un toque, como el mockup).
  function registrarPago(formaPagoId: string) {
    if (pagos.length >= MAX_PAGOS) return;
    const tecleado = Number(display) || 0;
    const forma = formasPago.find((f) => f.id === formaPagoId);
    const esTarjeta = forma?.tipo === "TARJETA";
    let importe = objetivo.tipo === "pago" && tecleado > 0 ? tecleado : falta;
    if (esTarjeta) importe = Math.min(importe, falta);   // la tarjeta no da cambio
    if (importe <= 0) return;
    setPagos((prev) => [...prev, { formaPagoId, importe }]);
    setDisplay("");
    setReemplazar(true);
    setObjetivo({ tipo: "pago" });
  }

  function registrarEfectivoRapido(importe: number) {
    if (!formaEfectivo || pagos.length >= MAX_PAGOS || importe <= 0) return;
    setPagos((prev) => [...prev, { formaPagoId: formaEfectivo.id, importe }]);
    setDisplay("");
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
  const etiquetaVisor =
    objetivo.tipo === "descuento" ? "Importe del descuento"
    : objetivo.tipo === "propina" ? "Importe de la propina"
    : "Importe a aplicar";

  return (
    // Tarjeta ModalTPV (como Cliente/Mesa/Dividir): NO ocupa toda la pantalla,
    // se arrastra por la cabecera y se redimensiona por la esquina.
    <ModalTPV
      titulo={`Cobrar${contexto ? ` ${contexto}` : ""}`}
      subtitulo={[empleado, terminal].filter(Boolean).join(" · ") || undefined}
      ancho={1240}
      alto={860}
      onClose={onCancelar}
      derecha={<div className="text-right"><div className="text-[9px] font-bold uppercase tracking-wider text-white/70">A cobrar</div><b className="text-lg tabular-nums">{eur(importeACobrar)}</b></div>}
    >
      <div className="flex h-full min-h-0 flex-col bg-background text-foreground">

      {/* ═════ Franja de datos (3 columnas, como el mockup) ═════ */}
      <div className="grid flex-none grid-cols-1 gap-x-3 gap-y-1.5 border-b border-border bg-card px-3 py-2.5 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <FilaDato label="Cliente" gris={!cliente}>
            <span className="truncate">{clienteNif ? `${cliente} · ${clienteNif}` : (cliente ?? "Cliente contado")}</span>
          </FilaDato>
          <FilaDato label="Empleado">{empleado ?? "—"}</FilaDato>
          <label className={`flex items-center gap-1.5 pl-1 ${cliente ? "" : "opacity-40"}`} title={cliente ? "Enviar la factura al cliente al cobrar" : "Asigna un cliente para poder enviarle la factura"}>
            <input type="checkbox" checked={enviarFactura} disabled={!cliente} onChange={(e) => setEnviarFactura(e.target.checked)} className="h-4 w-4 accent-(--brand)" />
            <span className="text-[12.5px] font-medium">Enviar factura al cliente</span>
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[92px_1fr] items-center gap-1.5">
            <span className="rounded-md border border-border bg-surface px-2.5 py-2.5 text-xs font-semibold text-muted-foreground">Tipo doc</span>
            <select
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value)}
              className="min-h-11 rounded-md border border-border bg-card px-2 text-right text-[13.5px] font-semibold outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {tiposDoc.map((t) => (
                // La AEAT solo admite factura COMPLETA (F1) con destinatario identificado:
                // sin cliente con NIF se deshabilita (saldría como simplificada igualmente).
                <option key={t} value={t} disabled={esCompleta(t) && !clienteNif}>
                  {esCompleta(t) && !clienteNif ? `${t} (asigna un cliente con NIF)` : t}
                </option>
              ))}
            </select>
          </div>
          <FilaDato label="Fecha" gris>{ahora.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" })}</FilaDato>
          <FilaDato label="Importe"><span className="text-[17px] font-bold tabular-nums">{eur(importeACobrar)}</span></FilaDato>
        </div>
        <div className="flex flex-col gap-1.5">
          <FilaDato label="B. imp." gris><span className="tabular-nums">{eur(baseImponible)}</span></FilaDato>
          <FilaDato label="Impuesto" gris><span className="tabular-nums">{eur(impuesto)}</span></FilaDato>
          <FilaDato label="Descuento"><span className="tabular-nums">{descuento > 0 ? `− ${eur(descuento)}` : "—"}</span></FilaDato>
        </div>
      </div>

      {/* ═════ Cuerpo: pagos · teclado · formas de pago ═════ */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 p-2.5 lg:grid-cols-[minmax(0,1fr)_330px_240px]">

        {/* ── Izquierda: notas + huecos de pago + dto/propina + zonas ── */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <div className="flex flex-none items-center gap-2 rounded-xl border border-border bg-card p-2.5">
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={90}
              placeholder="Notas del ticket…"
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <span aria-hidden className="grid h-11 w-12 flex-none place-items-center rounded-md border border-success bg-success/10 text-success">
              <Pencil size={18} />
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Importe · formas de pago</h3>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {Array.from({ length: MAX_PAGOS }, (_, i) => {
                const p = pagos[i];
                return (
                  <div key={`slot-${i}`} className={`grid flex-none grid-cols-[1fr_130px_44px] items-center gap-2 ${p ? "" : "opacity-50"}`}>
                    <div className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13.5px] font-bold text-muted-foreground">
                      <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-brand" />
                      <span className="truncate">{p ? (nombreForma[p.formaPagoId] ?? "Forma de pago") : "Sin asignar"}</span>
                    </div>
                    <div className="flex min-h-12 items-center justify-end rounded-md border border-border bg-background px-3 text-base font-bold tabular-nums">
                      {eur(p?.importe ?? 0)}
                    </div>
                    <button
                      type="button"
                      disabled={!p}
                      onClick={() => { setPagos((prev) => prev.filter((_, idx) => idx !== i)); seleccionar({ tipo: "pago" }); }}
                      aria-label="Quitar esta forma de pago"
                      className="grid h-11 w-11 place-items-center rounded-full border-2 border-danger text-danger transition-all hover:bg-danger hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-35"
                    >
                      <X size={17} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid flex-none grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => seleccionar(objetivo.tipo === "descuento" ? { tipo: "pago" } : { tipo: "descuento" })}
              aria-pressed={objetivo.tipo === "descuento"}
              className={`min-h-13 rounded-md border text-sm font-bold transition-all active:scale-[.98] ${
                objetivo.tipo === "descuento" ? "border-warning bg-warning text-white" : "border-warning bg-card text-warning hover:bg-warning/10"
              }`}
            >
              Descuento{descuento > 0 && <span className="ml-1.5 tabular-nums opacity-85">{eur(descuento)}</span>}
            </button>
            <button
              type="button"
              onClick={() => seleccionar(objetivo.tipo === "propina" ? { tipo: "pago" } : { tipo: "propina" })}
              aria-pressed={objetivo.tipo === "propina"}
              className={`min-h-13 rounded-md border text-sm font-bold transition-all active:scale-[.98] ${
                objetivo.tipo === "propina" ? "border-warning bg-warning text-white" : "border-warning bg-card text-warning hover:bg-warning/10"
              }`}
            >
              Propina{propina > 0 && <span className="ml-1.5 tabular-nums opacity-85">{eur(propina)}</span>}
            </button>
          </div>

          <div className="flex flex-none items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
            <span className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground"><Printer size={15} /> Zonas de impresión:</span>
            <button
              type="button"
              onClick={() => setZonasImpresion((v) => !v)}
              aria-pressed={zonasImpresion}
              className={`min-h-11 rounded-md border px-5 text-sm font-bold transition-all active:scale-[.98] ${
                zonasImpresion ? "border-success bg-success text-white" : "border-border bg-surface text-muted-foreground"
              }`}
            >
              {zonasImpresion ? "Activadas" : "Desactivadas"}
            </button>
          </div>
        </div>

        {/* ── Centro: teclado ── */}
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex flex-none items-center rounded-md border border-border bg-surface p-1">
            <b className="min-w-14 rounded bg-brand px-3.5 py-2 text-center text-2xl font-extrabold tabular-nums text-white">{display || "0"}</b>
            <small className="ml-auto pr-3 text-xs font-semibold text-muted-foreground">{etiquetaVisor}</small>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
            {teclas.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pulsar(k)}
                className="grid min-h-13 place-items-center bg-card text-2xl font-semibold text-success transition-colors active:bg-success/10"
              >
                {k === "borrar" ? <Delete size={24} /> : k === "." ? "," : k}
              </button>
            ))}
          </div>

          {/* Efectivo rápido: exacto + billetes por encima del pendiente (mejora). */}
          {formaEfectivo && (
            <div className="grid flex-none grid-cols-5 gap-1">
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
                  className="rounded border border-border bg-card py-2 text-xs font-bold transition-all hover:bg-accent active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                >
                  {v} €
                </button>
              ))}
            </div>
          )}

          {/* A devolver / Falta por cobrar (verde / ámbar, como el mockup) */}
          <div className={`flex min-h-14 flex-none items-center justify-between rounded-md px-4 text-white ${falta > 0 ? "bg-warning" : "bg-success"}`}>
            <span className="text-[13.5px] font-semibold opacity-90">{falta > 0 ? "Falta por cobrar" : "A devolver"}</span>
            <b className="text-2xl font-extrabold tabular-nums tracking-tight">{eur(falta > 0 ? falta : aDevolver)}</b>
          </div>
          {aDevolver > 0 && (
            <div className="flex-none text-right text-[11px] font-semibold tabular-nums text-success">
              {desglosarCambio(aDevolver).map((d) => `${d.n}×${fmtDenom(d.valor)}`).join("  ·  ")}
            </div>
          )}
        </div>

        {/* ── Derecha: formas de pago del local (contado destacado) ── */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-success/10" role="group" aria-label="Formas de pago">
          {formasPago.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => registrarPago(f.id)}
              disabled={pagos.length >= MAX_PAGOS}
              className={`flex min-h-16 flex-none items-center justify-center gap-2.5 border-b border-card text-[17px] font-semibold transition-colors active:bg-success active:text-white disabled:opacity-40 ${
                i === 0 || f.tipo === "CONTADO" ? "bg-success/20 font-bold text-success" : "text-muted-foreground hover:bg-success/10"
              }`}
            >
              <IconoForma tipo={f.tipo} nombre={f.nombre} /> {f.nombre}
            </button>
          ))}
          <div aria-hidden className="min-h-0 flex-1 bg-card/60" />
        </div>
      </div>

      {/* ═════ Barra inferior ═════ */}
      <footer className="flex flex-none flex-wrap items-center gap-2.5 border-t border-border bg-card px-3 py-2.5">
        <button type="button" onClick={onCancelar} className="flex min-h-13 flex-col items-center justify-center gap-0.5 px-4 text-xs font-semibold text-danger transition-colors hover:opacity-80">
          <XCircle size={24} /> Cancelar
        </button>
        {onDividir && (
          <button type="button" onClick={onDividir} className="flex min-h-13 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]" title="Repartir la cuenta en partes">
            <Split size={16} /> Dividir
          </button>
        )}
        <span className="flex-1" />
        {onEmail && (
          <button type="button" onClick={onEmail} className="flex min-h-13 items-center gap-2 rounded-md border border-warning bg-card px-4 text-sm font-bold text-warning transition-all hover:bg-warning/10 active:scale-[.98]">
            <Mail size={16} /> Enviar por email
          </button>
        )}
        <button type="button" onClick={onImprimirCuenta} className="min-h-13 rounded-md border border-warning bg-card px-4 text-sm font-bold text-warning transition-all hover:bg-warning/10 active:scale-[.98]">
          Imprimir cuenta (F10)
        </button>
        <button
          type="button"
          onClick={() => cobrar(true)}
          disabled={!puedeCobrar}
          className="min-h-13 rounded-md border border-warning bg-card px-4 text-sm font-bold text-warning transition-all hover:bg-warning/10 active:scale-[.98] disabled:border-border disabled:bg-surface disabled:text-muted-foreground disabled:active:scale-100"
        >
          Cobrar e imprimir (F11)
        </button>
        <button
          type="button"
          onClick={() => cobrar(zonasImpresion)}
          disabled={!puedeCobrar}
          className="min-h-13 rounded-md bg-warning px-8 text-[17px] font-bold text-white shadow-md shadow-warning/30 transition-all hover:brightness-105 active:scale-[.98] disabled:bg-surface disabled:text-muted-foreground disabled:shadow-none disabled:active:scale-100"
        >
          Cobrar (F12)
        </button>
      </footer>
      </div>
    </ModalTPV>
  );
}
