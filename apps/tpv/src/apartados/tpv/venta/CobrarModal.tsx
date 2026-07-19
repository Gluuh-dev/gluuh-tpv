import { useEffect, useMemo, useState } from "react";
import {
  Banknote, CreditCard, Smartphone, FileText, QrCode, Coins,
  Delete, Euro, Mail, Percent, Split, Tag, X, XCircle,
} from "lucide-react";
import { Modal, Select, CampoTexto } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { sugerenciasEfectivo } from "./efectivo";
import { imprimirTicket } from "../../../lib/impresion";
import { construirTicketPrueba, DISENO_DEMO } from "./ticket-impresion";
import { TIPOS_DOC_DEMO } from "../datos";
import { useVenta } from "../store";

// Modal COBRAR — portado 1:1 del TPV de Next (apps/web/app/tpv/components/CobrarModal).
// Franja de datos (cliente/empleado · tipo doc/fecha/importe · base/impuesto/dto),
// cuerpo en 3 columnas (notas + 3 huecos de pago + dto/propina/zonas · teclado con
// visor y "A devolver" · formas de pago), y barra F10/F11/F12. Datos desde el store.


interface FormaPago { id: string; nombre: string; tipo: string }
interface LineaPago { formaPagoId: string; importe: number }

const FORMAS_PAGO: FormaPago[] = [
  { id: "efectivo", nombre: "Contado", tipo: "CONTADO" },
  { id: "tarjeta", nombre: "Tarjeta", tipo: "TARJETA" },
  { id: "bizum", nombre: "Bizum", tipo: "BIZUM" },
  { id: "qr", nombre: "Pago QR", tipo: "QR" },
];
const esCompleta = (t: string) => t.toLowerCase().includes("completa");

type Objetivo = { tipo: "pago" } | { tipo: "descuento" } | { tipo: "propina" };

function IconoForma({ tipo, nombre, size = 20 }: Readonly<{ tipo: string; nombre: string; size?: number }>) {
  const clave = `${tipo} ${nombre}`.toUpperCase();
  if (clave.includes("CONTADO") || clave.includes("EFECTIVO")) return <Banknote size={size} />;
  if (clave.includes("TARJETA")) return <CreditCard size={size} />;
  if (clave.includes("BIZUM")) return <Smartphone size={size} />;
  if (clave.includes("CHEQUE") || clave.includes("VALE")) return <FileText size={size} />;
  if (clave.includes("QR")) return <QrCode size={size} />;
  return <Coins size={size} />;
}

// Cifra de la cabecera (A cobrar / Pagado / Pendiente).
function CifraHdr({ label, valor, tono }: Readonly<{ label: string; valor: string; tono?: string }>) {
  return (
    <div className="text-right leading-tight">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">{label}</div>
      <b className={`text-[17px] tabular-nums ${tono ?? "text-white"}`}>{valor}</b>
    </div>
  );
}

// Fila de la franja de datos (estilo profesional): etiqueta pequeña en mayúsculas
// a la izquierda + valor en caja. `numero` alinea a la derecha; `cambiar` añade el
// enlace "Cambiar" en color de marca. Sirve tanto para valores como para un select.
function Campo({ label, children, gris, numero, cambiar }: Readonly<{ label: string; children: React.ReactNode; gris?: boolean; numero?: boolean; cambiar?: () => void }>) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[.07em] text-muted-foreground">{label}</span>
      {children === false ? null : (
        <div className={`flex min-h-10 items-center gap-2 overflow-hidden rounded-md border border-border px-2.5 text-[13.5px] font-semibold ${gris ? "bg-surface text-muted-foreground" : "bg-card text-foreground"}`}>
          <span className={`min-w-0 flex-1 truncate ${numero ? "text-right tabular-nums" : ""}`}>{children}</span>
          {cambiar && <button type="button" onClick={cambiar} className="flex-none text-[11px] font-bold uppercase tracking-wide text-brand transition-transform active:scale-95">Cambiar</button>}
        </div>
      )}
    </div>
  );
}

export function CobrarModal({
  total, contexto, onCerrar, onCobrado, onDividir,
}: Readonly<{ total: number; contexto: string; onCerrar: () => void; onCobrado: (metodo: string) => void; onDividir: () => void }>) {
  const clienteObj = useVenta((s) => s.cliente);
  const cliente = clienteObj?.nombre;
  const sala = useVenta((s) => s.sala);
  const comensales = useVenta((s) => s.comensales);
  const empleado = "María Ruiz";
  const terminal = "Terminal 1";
  const serie = "A · 2026";
  const baseImponible = Math.round((total / 1.1) * 100) / 100;
  const impuesto = Math.round((total - baseImponible) * 100) / 100;
  const formasPago = FORMAS_PAGO;
  const tiposDoc = TIPOS_DOC_DEMO;

  const [pagos, setPagos] = useState<LineaPago[]>([]);
  const [objetivo, setObjetivo] = useState<Objetivo>({ tipo: "pago" });
  const [descuento, setDescuento] = useState(0);   // SIEMPRE en euros (fuente de verdad)
  const [descModo, setDescModo] = useState<"PCT" | "EUR">("EUR"); // solo cómo se teclea/muestra
  const [propina, setPropina] = useState(0);
  const [display, setDisplay] = useState("");
  const [reemplazar, setReemplazar] = useState(true);
  const [notas, setNotas] = useState("");
  const [tipoDoc, setTipoDoc] = useState<string>(tiposDoc[0]!);
  const [enviarFactura, setEnviarFactura] = useState(false);
  const [ahora] = useState(() => new Date());

  const importeACobrar = Math.max(0, Math.round((total + propina - descuento) * 100) / 100);
  const pagado = useMemo(() => pagos.reduce((s, p) => s + (p.importe || 0), 0), [pagos]);
  const aDevolver = Math.max(0, Math.round((pagado - importeACobrar) * 100) / 100);
  const falta = Math.max(0, Math.round((importeACobrar - pagado) * 100) / 100);
  const puedeCobrar = pagado >= importeACobrar - 0.005;
  const MAX_PAGOS = 3;

  const nombreForma = useMemo(() => Object.fromEntries(formasPago.map((f) => [f.id, f.nombre])), [formasPago]);
  const formaEfectivo = useMemo(() => formasPago.find((f) => f.tipo === "CONTADO") ?? formasPago[0], [formasPago]);

  function seleccionar(o: Objetivo) {
    setObjetivo(o);
    if (o.tipo === "propina") setDisplay(propina > 0 ? propina.toFixed(2) : "");
    else setDisplay("");
    setReemplazar(true);
  }

  // Descuento: un solo botón con selector €/% integrado. El € es la fuente; el %
  // es el mismo importe expresado sobre el total. Tocar el botón activa el tecleo;
  // tocarlo de nuevo (ya activo) lo desactiva sin borrar el valor.
  const descActivo = objetivo.tipo === "descuento";
  const pctDesc = total > 0 ? Math.round((descuento / total) * 1000) / 10 : 0;
  function activarDescuento() {
    if (descActivo) { seleccionar({ tipo: "pago" }); return; }
    setObjetivo({ tipo: "descuento" }); setDisplay(""); setReemplazar(true);
  }
  function elegirModoDescuento(modo: "PCT" | "EUR") {
    setDescModo(modo);
    setObjetivo({ tipo: "descuento" }); setDisplay(""); setReemplazar(true);
  }

  function pulsar(tecla: string) {
    setDisplay((prev) => {
      let base = reemplazar ? "" : prev;
      if (tecla === "borrar") base = base.slice(0, -1);
      else if (tecla === ".") base = base.includes(".") ? base : (base || "0") + ".";
      else base = (base === "0" ? "" : base) + tecla;
      if (base.length > 10) base = prev;
      const n = Number(base) || 0;
      if (objetivo.tipo === "descuento") {
        // Dto € = importe directo; Dto % = porcentaje sobre el total (máx 100 %).
        const euros = descModo === "PCT" ? Math.round(total * Math.min(n, 100)) / 100 : n;
        setDescuento(Math.min(euros, total));
      } else if (objetivo.tipo === "propina") setPropina(n);
      return base;
    });
    setReemplazar(false);
  }

  function registrarPago(formaPagoId: string) {
    if (pagos.length >= MAX_PAGOS) return;
    const tecleado = Number(display) || 0;
    const forma = formasPago.find((f) => f.id === formaPagoId);
    const esTarjeta = forma?.tipo === "TARJETA";
    let importe = objetivo.tipo === "pago" && tecleado > 0 ? tecleado : falta;
    if (esTarjeta) importe = Math.min(importe, falta);
    if (importe <= 0) return;
    setPagos((prev) => [...prev, { formaPagoId, importe }]);
    setDisplay(""); setReemplazar(true); setObjetivo({ tipo: "pago" });
  }

  function registrarEfectivoRapido(importe: number) {
    if (!formaEfectivo || pagos.length >= MAX_PAGOS || importe <= 0) return;
    setPagos((prev) => [...prev, { formaPagoId: formaEfectivo.id, importe }]);
    setDisplay(""); setReemplazar(true); setObjetivo({ tipo: "pago" });
  }

  function cobrar() {
    if (!puedeCobrar) return;
    const metodo = pagos[0] ? (nombreForma[pagos[0].formaPagoId] ?? "Contado") : "Contado";
    onCobrado(metodo);
  }

  // Imprime el ticket de PRUEBA (proforma = cuenta sin cobrar; si no, ticket de
  // venta). En navegador sale por `window.print()`; en Electron, por la térmica.
  function imprimir(proforma: boolean) {
    const t = construirTicketPrueba({
      contexto, operario: empleado,
      baseImponible, impuesto, total: importeACobrar,
      descuento, propina, proforma,
    });
    void imprimirTicket(t, DISENO_DEMO);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const enCampo = !!t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if (e.key === "F10") { e.preventDefault(); imprimir(true); return; }
      if (e.key === "F11") { e.preventDefault(); imprimir(false); cobrar(); return; }
      if (e.key === "F12") { e.preventDefault(); cobrar(); return; }
      if (e.key === "Escape") { e.preventDefault(); onCerrar(); return; }
      if (e.key === "Enter" && puedeCobrar && !enCampo) { e.preventDefault(); cobrar(); return; }
      if (enCampo) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); pulsar(e.key); }
      else if (e.key === "." || e.key === ",") { e.preventDefault(); pulsar("."); }
      else if (e.key === "Backspace") { e.preventDefault(); pulsar("borrar"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeCobrar, pagos, objetivo, reemplazar, display, propina, descuento, descModo, notas, tipoDoc]);

  // Cabecera: nº de ticket (demo; vendrá del nodo) y chip mesa · sala · comensales.
  const ticketN = String((ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds()) % 1000000).padStart(6, "0");
  const chipCuenta = [contexto, sala, comensales ? `${comensales} comensales` : ""].filter(Boolean).join(" · ");

  const teclas = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "borrar"];
  let etiquetaVisor = "Importe a aplicar";
  if (objetivo.tipo === "descuento") etiquetaVisor = descModo === "PCT" ? "Porcentaje de descuento" : "Importe del descuento";
  else if (objetivo.tipo === "propina") etiquetaVisor = "Importe de la propina";

  return (
    <Modal onCerrar={onCerrar} ancho="5xl" className="overflow-hidden p-0">
      {/* Cabecera del cobro (sin logo): título · cuenta · nº ticket · cifras · cerrar */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-brand px-4 py-2.5 text-white">
        <h2 className="font-display text-[18px] font-extrabold leading-none">Cobrar</h2>
        {chipCuenta && <span className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">{chipCuenta}</span>}
        <span className="text-[12px] text-white/75">Ticket nº {ticketN}</span>
        <div className="ml-auto flex items-center gap-4">
          <CifraHdr label="A cobrar" valor={eur(importeACobrar)} />
          <span className="h-7 w-px bg-white/20" />
          <CifraHdr label="Pagado" valor={eur(pagado)} />
          <span className="h-7 w-px bg-white/20" />
          <CifraHdr label="Pendiente" valor={eur(falta)} tono={falta > 0 ? "text-[#ffd27a]" : "text-white"} />
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-1 grid h-8 w-8 flex-none place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><X size={17} /></button>
        </div>
      </header>

      <div className="flex h-[80vh] max-h-[820px] min-h-0 flex-col bg-background text-foreground">
        {/* Franja de datos (3 columnas × 3 filas, estilo profesional) */}
        <div className="flex-none border-b border-border bg-card px-3 py-2.5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 lg:grid-cols-3">
            {/* ponytail: «Cambiar» abrirá el selector de cliente/empleado al cablear el nodo; hoy no-op. */}
            <div className="flex flex-col gap-1.5">
              <Campo label="Cliente" gris={!cliente} cambiar={() => {}}><span className="truncate">{cliente ?? "Cliente contado"}</span></Campo>
              <Campo label="Empleado" cambiar={() => {}}>{empleado}</Campo>
              <Campo label="Terminal" gris>{terminal}</Campo>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-[76px_1fr] items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[.07em] text-muted-foreground">Documento</span>
                <Select value={tipoDoc} onChange={setTipoDoc} Icono={FileText}
                  opciones={tiposDoc.map((t) => ({ value: t, label: esCompleta(t) && !cliente ? `${t} (asigna cliente)` : t, disabled: esCompleta(t) && !cliente }))} />
              </div>
              <Campo label="Fecha" gris>{ahora.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" })}</Campo>
              <Campo label="Serie" gris>{serie}</Campo>
            </div>
            <div className="flex flex-col gap-1.5">
              <Campo label="Base imp." gris numero>{eur(baseImponible)}</Campo>
              <Campo label="Impuestos" gris numero>{eur(impuesto)}</Campo>
              <Campo label="Importe" numero><span className="text-[15px] font-bold">{eur(importeACobrar)}</span></Campo>
            </div>
          </div>
          <label className={`mt-2 flex items-center gap-2 ${cliente ? "" : "opacity-40"}`}>
            <input type="checkbox" checked={enviarFactura} disabled={!cliente} onChange={(e) => setEnviarFactura(e.target.checked)} className="h-4 w-4 accent-(--brand)" />
            <span className="text-[12.5px] font-medium">Enviar factura al cliente por email</span>
            {descuento > 0 && <span className="ml-auto text-[12px] font-semibold text-brand tabular-nums">Descuento aplicado − {eur(descuento)}</span>}
          </label>
        </div>

        {/* Cuerpo */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 p-2.5 lg:grid-cols-[minmax(0,1fr)_330px_240px]">
          {/* Izquierda */}
          <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
            <div className="flex-none rounded-xl border border-border bg-card p-2.5">
              <CampoTexto value={notas} onChange={(v) => setNotas(v.slice(0, 90))} placeholder="Notas del ticket…" />
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
                      <div className="flex min-h-12 items-center justify-end rounded-md border border-border bg-background px-3 text-base font-bold tabular-nums">{eur(p?.importe ?? 0)}</div>
                      <button type="button" disabled={!p} onClick={() => { setPagos((prev) => prev.filter((_, idx) => idx !== i)); seleccionar({ tipo: "pago" }); }} aria-label="Quitar" className="grid h-11 w-11 place-items-center rounded-full border-2 border-danger text-danger transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-35"><X size={17} /></button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-none gap-2.5">
              {/* Descuento: un botón con selector €/% integrado y el valor a la vista. */}
              <div className={`flex min-h-13 flex-1 items-center gap-2 rounded-lg border px-2.5 transition-colors ${descActivo ? "border-brand ring-1 ring-brand/40" : "border-border"} bg-card`}>
                <button type="button" onClick={activarDescuento} className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left transition-transform active:scale-[.99]">
                  <Tag size={15} className="flex-none text-brand" />
                  <span className="text-sm font-bold text-foreground">Descuento</span>
                  {descuento > 0 && (
                    <span className="truncate text-[13px] font-semibold tabular-nums text-muted-foreground">
                      · {descModo === "PCT" ? `${pctDesc}% (${eur(descuento)})` : eur(descuento)}
                    </span>
                  )}
                </button>
                <div className="flex flex-none overflow-hidden rounded-md border border-border">
                  <button type="button" onClick={() => elegirModoDescuento("EUR")} aria-label="Descuento en euros"
                    className={`grid h-8 w-8 place-items-center text-sm font-bold transition-transform active:scale-90 ${descModo === "EUR" ? "bg-brand text-white" : "bg-surface text-muted-foreground"}`}><Euro size={15} /></button>
                  <button type="button" onClick={() => elegirModoDescuento("PCT")} aria-label="Descuento en porcentaje"
                    className={`grid h-8 w-8 place-items-center text-sm font-bold transition-transform active:scale-90 ${descModo === "PCT" ? "bg-brand text-white" : "bg-surface text-muted-foreground"}`}><Percent size={15} /></button>
                </div>
              </div>
              {/* Propina: más pequeña, para que la fila quepa siempre. */}
              <button type="button" onClick={() => seleccionar(objetivo.tipo === "propina" ? { tipo: "pago" } : { tipo: "propina" })}
                className={`flex min-h-13 w-32 flex-none flex-col items-center justify-center rounded-lg border text-sm font-bold transition-transform active:scale-[.97] ${objetivo.tipo === "propina" ? "border-brand bg-brand text-white" : "border-border bg-card text-foreground"}`}>
                <span className="flex items-center gap-1.5"><Coins size={14} /> Propina</span>
                {propina > 0 && <span className="text-[13px] tabular-nums opacity-85">{eur(propina)}</span>}
              </button>
            </div>

          </div>

          {/* Centro: teclado */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex flex-none items-center rounded-md border border-border bg-surface p-1">
              <b className="min-w-14 rounded bg-brand px-3.5 py-2 text-center text-2xl font-extrabold tabular-nums text-white">{display || "0"}</b>
              <small className="ml-auto pr-3 text-xs font-semibold text-muted-foreground">{etiquetaVisor}</small>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
              {teclas.map((k) => (
                <button key={k} type="button" onClick={() => pulsar(k)} className="grid min-h-13 place-items-center bg-card text-2xl font-semibold text-foreground transition-colors active:bg-accent">
                  {k === "borrar" ? <Delete size={24} /> : k === "." ? "," : k}
                </button>
              ))}
            </div>
            {formaEfectivo && (
              // Efectivo rápido: los billetes NO desaparecen al cubrir el importe;
              // se calculan sobre el total (estable) y se desactivan como "Exacto".
              <div className="grid flex-none grid-cols-5 gap-1">
                <button type="button" onClick={() => registrarEfectivoRapido(falta)} disabled={falta <= 0} className="rounded border border-brand/45 bg-brand/5 py-2 text-xs font-black text-brand transition-all active:scale-95 disabled:opacity-30">Exacto</button>
                {sugerenciasEfectivo(importeACobrar).map((v) => (
                  <button key={v} type="button" onClick={() => registrarEfectivoRapido(v)} disabled={falta <= 0} className="rounded border border-border bg-card py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-30">{v} €</button>
                ))}
              </div>
            )}
            <div className={`flex min-h-13 flex-none items-center justify-between rounded-md px-4 text-white ${falta > 0 ? "bg-warning" : "bg-success"}`}>
              <span className="text-[13.5px] font-semibold opacity-90">{falta > 0 ? "Falta por cobrar" : "A devolver"}</span>
              <b className="text-2xl font-extrabold tabular-nums tracking-tight">{eur(falta > 0 ? falta : aDevolver)}</b>
            </div>
          </div>

          {/* Derecha: formas de pago */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-success/10" role="group" aria-label="Formas de pago">
            {formasPago.map((f, i) => (
              <button key={f.id} type="button" onClick={() => registrarPago(f.id)} disabled={pagos.length >= MAX_PAGOS}
                className={`flex min-h-16 flex-none items-center justify-center gap-2.5 border-b border-card text-[17px] font-semibold transition-colors active:bg-success active:text-white disabled:opacity-40 ${i === 0 || f.tipo === "CONTADO" ? "bg-success/20 font-bold text-success" : "text-muted-foreground"}`}>
                <IconoForma tipo={f.tipo} nombre={f.nombre} /> {f.nombre}
              </button>
            ))}
            <div aria-hidden className="min-h-0 flex-1 bg-card/60" />
          </div>
        </div>

        {/* Barra inferior — botones compactos como el footer de Utilidades */}
        <footer className="flex flex-none flex-wrap items-center gap-3 border-t border-border bg-surface-2 px-4 py-2.5">
          <button type="button" onClick={onCerrar} className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-danger transition-transform active:scale-95">
            <XCircle size={16} /> Cancelar
          </button>
          <button type="button" onClick={onDividir} className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-foreground transition-transform active:scale-95">
            <Split size={16} /> Dividir
          </button>
          <span className="flex-1" />
          {/* Acciones de impresión/cobro: más chicas (F10/F11/F12). */}
          <button type="button" onClick={onCerrar} className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-warning transition-transform active:scale-95">
            <Mail size={14} /> Email
          </button>
          <button type="button" onClick={() => imprimir(true)} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-warning transition-transform active:scale-95">
            Imprimir cuenta (F10)
          </button>
          <button type="button" onClick={() => { imprimir(false); cobrar(); }} disabled={!puedeCobrar} className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-warning transition-transform active:scale-95 disabled:text-muted-foreground">
            Cobrar e imprimir (F11)
          </button>
          <button type="button" onClick={cobrar} disabled={!puedeCobrar} className="rounded-md bg-cobro px-4 py-1.5 text-xs font-bold text-white transition-transform active:scale-95 disabled:bg-surface disabled:text-muted-foreground">
            Cobrar (F12)
          </button>
        </footer>
      </div>
    </Modal>
  );
}
