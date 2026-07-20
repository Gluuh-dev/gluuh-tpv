// Modal DIVIDIR CUENTA — portado 1:1 de apps/web/app/tpv/components/DividirCuentaModal.tsx
// (skill gluuh-tpv-portar). Cambios Next→Vite: sin "use client"; ModalTPV → Modal +
// cabecera propia; import de eur; y sin `hover:` (regla del TPV: solo `active:`).
//
// Es el CENTRO DE MANDO del reparto: los cobros se abren ENCIMA (CobrarModal, lo
// renderiza el controlador) y al confirmar SE VUELVE aquí. Tres formas, mezclables:
//   · A partes iguales — reparte EL PENDIENTE entre N; cada parte se cobra como
//     pago parcial (la mesa no se cierra hasta saldar).
//   · Por productos — los artículos elegidos se cobran con su factura y SALEN de
//     la mesa; aquí solo se preparan y se pide el cobro.
//   · Por importe — separa importes sueltos del pendiente; pago parcial.
// PRESENTACIONAL: las partes llegan por props y toda mutación va por callbacks.
import { useEffect, useMemo, useState } from "react";
import { Users, ListTree, Coins, Printer, Delete, X } from "lucide-react";
import { Modal, Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";

export interface LineaTicket {
  id: string;
  nombre: string;
  uds: number;
  /** Precio UNITARIO (impuesto incluido). Solo para mostrar subtotales. */
  precio: number;
}

/** Parte del reparto (equivale a `cuenta_parte` en la BD). */
export interface ParteVista {
  id: string;
  indice: number;
  tipo: "IGUAL" | "IMPORTE" | "PRODUCTOS";
  importe: number;
  cobrada: boolean;
}

export interface DividirCuentaModalProps {
  lineas: LineaTicket[];
  total: number;
  pendiente: number;
  partes: ParteVista[];
  comensales?: number;
  contexto?: string;
  onCobrarIgual(n: number, pos: number): void;
  onSepararImporte(importe: number): void;
  onCobrarParte(p: ParteVista): void;
  onCobrarResto(importe: number): void;
  onCobrarCuenta(lineas: { id: string; uds: number }[]): void;
  onCobrarPendiente(): void;
  onQuitarDivision(): void;
  onImprimirParte(etiqueta: string, importe: number): void;
  onCerrar(): void;
  onAbrirCajon?(): void;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Reparto a partes iguales en céntimos (evita el 12,29 € del redondeo binario). */
function repartoIgual(total: number, n: number): number[] {
  const totalC = Math.round(total * 100);
  const baseC = Math.floor(totalC / n);
  const arr = Array.from({ length: n }, () => baseC / 100);
  arr[n - 1] = (totalC - baseC * (n - 1)) / 100;
  return arr;
}

export function DividirCuentaModal({
  lineas, total, pendiente, partes, comensales, contexto,
  onCobrarIgual, onSepararImporte, onCobrarParte, onCobrarResto,
  onCobrarCuenta, onCobrarPendiente, onQuitarDivision, onImprimirParte,
  onCerrar, onAbrirCajon,
}: Readonly<DividirCuentaModalProps>) {
  const [modo, setModo] = useState<"partes" | "prod" | "imp">("partes");
  useEffect(() => {
    if (modo === "prod" && partes.some((p) => p.cobrada && p.tipo !== "PRODUCTOS")) setModo("partes");
  }, [modo, partes]);

  const cobradas = useMemo(() => partes.filter((p) => p.cobrada), [partes]);
  const pendientesBD = useMemo(() => partes.filter((p) => !p.cobrada), [partes]);
  const cobradoTotal = r2(cobradas.reduce((s, p) => s + p.importe, 0));
  const hayParcialesDinero = cobradas.some((p) => p.tipo !== "PRODUCTOS");

  /* ══ Modo 1: partes iguales ══ */
  const igualesCobradas = cobradas.filter((p) => p.tipo === "IGUAL");
  const igualesPend = pendientesBD.filter((p) => p.tipo === "IGUAL");
  const [nLocal, setNLocal] = useState(() => igualesPend.length || Math.max(2, comensales ?? 2));
  useEffect(() => {
    if (igualesPend.length) setNLocal(igualesPend.length);
  }, [igualesPend.length]);
  const igualesPreview = igualesPend.length !== nLocal;
  const importesIguales = igualesPreview ? repartoIgual(pendiente, nLocal) : igualesPend.map((p) => p.importe);
  const igualExacto = importesIguales.every((v) => v === importesIguales[0]);

  /* ══ Modo 2: por productos (staging local; el cobro lo remata el controlador) ══ */
  const [cuentas, setCuentas] = useState<Record<string, number>[]>(() => [{}, {}]);
  const [ctAct, setCtAct] = useState(0);

  const precioDe = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lineas) m[l.id] = l.precio;
    return m;
  }, [lineas]);
  const nombreDe = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lineas) m[l.id] = l.nombre;
    return m;
  }, [lineas]);

  const entradasVivas = (c: Record<string, number>) =>
    Object.entries(c).filter(([id, u]) => u > 0 && nombreDe[id] !== undefined);

  const asignadas = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cuentas) for (const [id, u] of entradasVivas(c)) m[id] = (m[id] ?? 0) + u;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentas, nombreDe]);
  const sinAsignar = lineas
    .map((l) => ({ ...l, restantes: l.uds - (asignadas[l.id] ?? 0) }))
    .filter((l) => l.restantes > 0);
  const udsSinAsignar = sinAsignar.reduce((s, l) => s + l.restantes, 0);
  const totalSinAsignar = sinAsignar.reduce((s, l) => s + l.restantes * l.precio, 0);

  const totalCuenta = (c: Record<string, number>) =>
    entradasVivas(c).reduce((s, [id, u]) => s + u * (precioDe[id] ?? 0), 0);

  function moverAsinAsignar(id: string, delta: number) {
    setCuentas((prev) =>
      prev.map((c, i) => {
        if (i !== ctAct) return c;
        const u = (c[id] ?? 0) + delta;
        const next = { ...c };
        if (u <= 0) delete next[id];
        else next[id] = u;
        return next;
      }),
    );
  }
  function pasarUnidad(id: string) {
    const pend = sinAsignar.find((l) => l.id === id);
    if (!pend || pend.restantes <= 0) return;
    moverAsinAsignar(id, +1);
  }
  function pasarTodo() {
    setCuentas((prev) =>
      prev.map((c, i) => {
        if (i !== ctAct) return c;
        const next = { ...c };
        for (const l of sinAsignar) next[l.id] = (next[l.id] ?? 0) + l.restantes;
        return next;
      }),
    );
  }
  function vaciarCuenta() {
    setCuentas((prev) => prev.map((c, i) => (i === ctAct ? {} : c)));
  }
  function anadirCuenta() {
    if (cuentas.length >= 8) return;
    setCtAct(cuentas.length);
    setCuentas((prev) => [...prev, {}]);
  }
  function cobrarCuentaActiva() {
    const sel = entradasVivas(cuentas[ctAct] ?? {}).map(([id, u]) => ({ id, uds: u }));
    if (sel.length) onCobrarCuenta(sel);
  }

  /* ══ Modo 3: por importe ══ */
  const [buf, setBuf] = useState("");
  const importesLista = partes.filter((p) => p.tipo === "IMPORTE");
  const restoImp = r2(pendiente - pendientesBD.filter((p) => p.tipo !== "PRODUCTOS").reduce((s, p) => s + p.importe, 0));
  const bufValor = r2(Number.parseFloat(buf.replace(",", ".")) || 0);

  function pulsar(c: string) {
    if (c === "," && (buf.includes(",") || !buf)) return;
    if (buf.replace(",", "").length > 5) return;
    setBuf((b) => b + c);
  }
  function separarImporte() {
    if (bufValor <= 0 || bufValor > restoImp) return;
    onSepararImporte(bufValor);
    setBuf("");
  }

  /* ══ Pie ══ */
  const [confQuitar, setConfQuitar] = useState(false);
  const progreso = cobradoTotal + pendiente > 0 ? Math.min(100, (cobradoTotal / (cobradoTotal + pendiente)) * 100) : 0;

  function imprimirTodas() {
    if (modo === "partes") importesIguales.forEach((im, i) => onImprimirParte(`Parte ${i + 1} de ${importesIguales.length}`, im));
    else if (modo === "imp") importesLista.forEach((p) => onImprimirParte(`Importe ${p.indice}`, p.importe));
    else cuentas.forEach((c, i) => { const t = totalCuenta(c); if (t > 0) onImprimirParte(`Cuenta ${i + 1}`, t); });
  }

  const PISTAS = {
    partes: "Reparte lo pendiente entre los comensales. Cada parte se cobra por separado.",
    prod: "Toca un producto para pasarlo a la cuenta activa. Al cobrarla, sus artículos salen de la mesa con su ticket.",
    imp: "Separa un importe suelto: el resto se queda en la cuenta de la mesa.",
  } as const;

  // Tarjeta de una parte de dinero (iguales o importe), cobrada o pendiente.
  function TarjetaParte({ titulo, importe, cobrada, onCobrar }: Readonly<{ titulo: string; importe: number; cobrada: boolean; onCobrar: () => void }>) {
    return (
      <div className={`flex flex-col gap-2.5 rounded-lg border p-3 ${cobrada ? "border-success/40 bg-success/10" : "border-border bg-background"}`}>
        <div className="flex items-center justify-between">
          <b className="text-sm">{titulo}</b>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cobrada ? "bg-success text-white" : "bg-surface text-muted-foreground"}`}>{cobrada ? "Cobrada" : "Pendiente"}</span>
        </div>
        <div className={`text-2xl font-extrabold tabular-nums tracking-tight ${cobrada ? "text-success" : ""}`}>{eur(importe)}</div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onImprimirParte(titulo, importe)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-bold transition-transform active:scale-[.98]">
            <Printer size={15} /> Imprimir
          </button>
          {cobrada ? (
            <span className="grid min-h-11 flex-1 place-items-center rounded-md border border-success bg-success text-xs font-bold text-white">Cobrada ✓</span>
          ) : (
            <button type="button" onClick={onCobrar} className="min-h-11 flex-1 rounded-md border border-warning bg-card text-xs font-bold text-warning transition-transform active:scale-[.98]">
              Cobrar
            </button>
          )}
        </div>
      </div>
    );
  }

  const subtitulo = `${contexto ?? ""}${comensales ? ` · ${comensales} comensales` : ""}`.replace(/^ · /, "");

  return (
    <Modal onCerrar={onCerrar} ancho="5xl" className="overflow-hidden p-0">
      {/* Cabecera (sin logo): título · cuenta · total · cerrar */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-brand px-4 py-2.5 text-white">
        <h2 className="font-display text-[18px] font-extrabold leading-none">Dividir cuenta</h2>
        {subtitulo && <span className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">{subtitulo}</span>}
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right leading-tight"><div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Total</div><b className="text-[17px] tabular-nums">{eur(total)}</b></div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-8 w-8 flex-none place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><X size={17} /></button>
        </div>
      </header>

      <div className="flex h-[80vh] max-h-[820px] min-h-0 flex-col bg-background text-foreground">
        {/* ═════ Pestañas de modo ═════ */}
        <div className="flex flex-none items-center gap-2 border-b border-border bg-surface px-3 py-2" role="tablist">
          {([
            { id: "partes", label: "A partes iguales", icon: Users },
            { id: "prod", label: "Por productos", icon: ListTree },
            { id: "imp", label: "Por importe", icon: Coins },
          ] as const).map((t) => {
            const on = modo === t.id;
            const deshabilitada = t.id === "prod" && hayParcialesDinero;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} disabled={deshabilitada}
                onClick={() => setModo(t.id)}
                title={deshabilitada ? "Ya hay partes cobradas: termina el cobro por partes" : undefined}
                className={`flex min-h-12 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-transform active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${on ? "border-brand bg-brand text-white" : "border-border bg-card text-muted-foreground"}`}>
                <t.icon size={18} /> {t.label}
              </button>
            );
          })}
          <p className="ml-auto hidden max-w-[44ch] text-right text-xs text-muted-foreground lg:block">{PISTAS[modo]}</p>
        </div>

        {/* ═════ Cuerpo ═════ */}
        <div className="min-h-0 flex-1 p-3">
          {/* ── MODO 1: partes iguales ── */}
          {modo === "partes" && (
            <div className="grid h-full min-h-0 grid-cols-[340px_1fr] gap-3 max-[1150px]:grid-cols-[284px_1fr]">
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-4 text-center">
                <span className="text-sm text-muted-foreground">Dividir lo pendiente entre</span>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setNLocal((n) => Math.max(2, n - 1))} disabled={nLocal <= 2} aria-label="Una parte menos" className="grid h-16 w-16 place-items-center rounded-xl border border-border bg-surface text-3xl font-bold text-brand transition-all active:scale-95 active:bg-brand active:text-white disabled:opacity-30">−</button>
                  <b className="min-w-17.5 text-5xl font-extrabold tabular-nums tracking-tight">{nLocal}</b>
                  <button type="button" onClick={() => setNLocal((n) => Math.min(12, n + 1))} disabled={nLocal >= 12} aria-label="Una parte más" className="grid h-16 w-16 place-items-center rounded-xl border border-border bg-surface text-3xl font-bold text-brand transition-all active:scale-95 active:bg-brand active:text-white disabled:opacity-30">+</button>
                </div>
                <span className="text-sm text-muted-foreground">partes</span>
                <div className="w-full rounded-lg border border-brand/30 bg-brand/10 p-4">
                  <small className="block text-xs font-bold uppercase tracking-wider text-brand">Cada uno paga</small>
                  <b className="text-4xl font-extrabold tabular-nums tracking-tight text-brand">{eur(importesIguales[0] ?? 0)}</b>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {igualExacto
                    ? `Sale exacto: ${importesIguales.length} partes de ${eur(importesIguales[0] ?? 0)}.`
                    : `No sale redondo: ${importesIguales.length - 1} de ${eur(importesIguales[0] ?? 0)} y una de ${eur(importesIguales[importesIguales.length - 1] ?? 0)}.`}
                  {cobradoTotal > 0 && <><br />Ya cobrado antes: {eur(cobradoTotal)}.</>}
                </p>
              </div>

              <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
                <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Partes <span className="ml-auto normal-case tracking-normal text-foreground">{igualesCobradas.length ? `${igualesCobradas.length} cobradas · ` : ""}{importesIguales.length} pendientes</span>
                </h3>
                <Desplazable className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(196px,1fr))] content-start gap-2 p-3 max-[1150px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                  {igualesCobradas.map((p) => (
                    <TarjetaParte key={p.id} titulo={`Parte ${p.indice}`} importe={p.importe} cobrada onCobrar={() => {}} />
                  ))}
                  {igualesPreview
                    ? importesIguales.map((im, i) => (
                        <TarjetaParte key={`prev-${i}`} titulo={`Parte ${igualesCobradas.length + i + 1}`} importe={im} cobrada={false} onCobrar={() => onCobrarIgual(nLocal, i)} />
                      ))
                    : igualesPend.map((p) => (
                        <TarjetaParte key={p.id} titulo={`Parte ${p.indice}`} importe={p.importe} cobrada={false} onCobrar={() => onCobrarParte(p)} />
                      ))}
                </Desplazable>
              </div>
            </div>
          )}

          {/* ── MODO 2: por productos ── */}
          {modo === "prod" && (
            <div className="grid h-full min-h-0 grid-cols-2 gap-3">
              {/* Sin asignar */}
              <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
                <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Sin asignar <span className="ml-auto normal-case tracking-normal text-foreground">{udsSinAsignar} uds · {eur(totalSinAsignar)}</span>
                </h3>
                <Desplazable className="flex flex-col gap-1.5 px-3 pb-3">
                  {sinAsignar.length === 0 && <p className="m-auto p-5 text-center text-sm text-muted-foreground">Todo repartido.<br />Cobra cada cuenta cuando quieras.</p>}
                  {sinAsignar.map((l) => (
                    <button key={l.id} type="button" onClick={() => pasarUnidad(l.id)} className="grid min-h-14 grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-md border border-border bg-background px-2.5 text-left transition-transform active:scale-[.99]">
                      <span className="grid h-9 place-items-center rounded bg-surface text-sm font-extrabold tabular-nums">{l.restantes}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{l.nombre}</span><span className="text-[11px] text-muted-foreground">{eur(l.precio)} / ud.</span></span>
                      <span className="text-sm font-bold tabular-nums">{eur(l.restantes * l.precio)}</span>
                    </button>
                  ))}
                </Desplazable>
                <div className="flex flex-none items-center gap-2.5 border-t border-border p-2.5">
                  <div className="mr-auto"><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Queda en la mesa</small><b className="text-lg font-extrabold tabular-nums">{eur(totalSinAsignar)}</b></div>
                  <button type="button" onClick={pasarTodo} disabled={!sinAsignar.length} className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-40">Pasar todo a la cuenta</button>
                </div>
              </div>

              {/* Cuentas */}
              <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
                <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Cuentas <span className="ml-auto normal-case tracking-normal text-muted-foreground">Al cobrar, sus artículos salen de la mesa</span>
                </h3>
                <div className="flex flex-none gap-1.5 overflow-x-auto px-3 pb-2">
                  {cuentas.map((c, i) => {
                    const on = i === ctAct;
                    return (
                      <button key={`ct-${i}`} type="button" onClick={() => setCtAct(i)} className={`flex min-h-13 flex-none flex-col justify-center gap-0.5 rounded-md border px-3.5 py-1.5 text-left transition-transform active:scale-[.98] ${on ? "border-brand bg-brand text-white" : "border-border bg-background"}`}>
                        <b className="text-sm">Cuenta {i + 1}</b>
                        <small className={`text-xs ${on ? "text-white/70" : "text-muted-foreground"}`}>{eur(totalCuenta(c))}</small>
                      </button>
                    );
                  })}
                  {cuentas.length < 8 && (
                    <button type="button" onClick={anadirCuenta} className="flex min-h-13 flex-none items-center rounded-md border border-dashed border-brand px-3.5 text-sm font-bold text-brand transition-transform active:scale-95">+ Añadir</button>
                  )}
                </div>
                <Desplazable className="flex flex-col gap-1.5 px-3 pb-3">
                  {entradasVivas(cuentas[ctAct] ?? {}).length === 0 && <p className="m-auto p-5 text-center text-sm text-muted-foreground">Cuenta {ctAct + 1} vacía.<br />Toca los productos de la izquierda.</p>}
                  {entradasVivas(cuentas[ctAct] ?? {}).map(([id, u]) => (
                    <button key={id} type="button" onClick={() => moverAsinAsignar(id, -1)} className="grid min-h-14 grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-md border border-brand/30 bg-brand/5 px-2.5 text-left transition-transform active:scale-[.99]" title="Tocar para devolver 1 unidad">
                      <span className="grid h-9 place-items-center rounded bg-brand/10 text-sm font-extrabold tabular-nums text-brand">{u}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{nombreDe[id]}</span><span className="text-[11px] text-muted-foreground">{eur(precioDe[id] ?? 0)} / ud.</span></span>
                      <span className="text-sm font-bold tabular-nums">{eur(u * (precioDe[id] ?? 0))}</span>
                    </button>
                  ))}
                </Desplazable>
                <div className="flex flex-none items-center gap-2 border-t border-border p-2.5">
                  <div className="mr-auto"><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total de la cuenta {ctAct + 1}</small><b className="text-lg font-extrabold tabular-nums">{eur(totalCuenta(cuentas[ctAct] ?? {}))}</b></div>
                  <button type="button" onClick={vaciarCuenta} disabled={!entradasVivas(cuentas[ctAct] ?? {}).length} className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-40">Devolver todo</button>
                  <button type="button" onClick={() => onImprimirParte(`Cuenta ${ctAct + 1}`, totalCuenta(cuentas[ctAct] ?? {}))} disabled={!entradasVivas(cuentas[ctAct] ?? {}).length} className="flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-transform active:scale-[.98] disabled:opacity-40"><Printer size={15} /> Imprimir</button>
                  <button type="button" onClick={cobrarCuentaActiva} disabled={!entradasVivas(cuentas[ctAct] ?? {}).length} className="min-h-11 rounded-md bg-warning px-4 text-sm font-bold text-white transition-transform active:scale-[.98] disabled:bg-surface disabled:text-muted-foreground">Cobrar cuenta {ctAct + 1}</button>
                </div>
              </div>
            </div>
          )}

          {/* ── MODO 3: por importe ── */}
          {modo === "imp" && (
            <div className="grid h-full min-h-0 grid-cols-[340px_1fr] gap-3 max-[1150px]:grid-cols-[284px_1fr]">
              <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-border bg-card p-3">
                <div className="flex flex-none items-center rounded-md border border-border bg-surface px-1 py-1">
                  <b className="min-w-14 rounded bg-brand px-3.5 py-2 text-center text-2xl font-extrabold tabular-nums text-white">{buf || "0"}</b>
                  <small className="ml-auto pr-3 text-xs font-semibold text-muted-foreground">Importe a separar</small>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
                  {["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0"].map((k) => (
                    <button key={k} type="button" onClick={() => pulsar(k)} className="min-h-14 bg-card text-2xl font-semibold text-foreground transition-colors active:bg-accent">{k}</button>
                  ))}
                  <button type="button" onClick={() => setBuf((b) => b.slice(0, -1))} aria-label="Borrar" className="grid min-h-14 place-items-center bg-card text-foreground transition-colors active:bg-accent"><Delete size={24} /></button>
                </div>
                <button type="button" onClick={separarImporte} disabled={bufValor <= 0 || bufValor > restoImp} className="min-h-14 flex-none rounded-md bg-brand text-base font-bold text-white transition-transform active:scale-[.98] disabled:bg-surface disabled:text-muted-foreground">Separar este importe</button>
              </div>

              <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
                <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Importes separados <span className="ml-auto normal-case tracking-normal text-foreground">{eur(cobradoTotal)} cobrados · quedan {eur(pendiente)}</span>
                </h3>
                <Desplazable className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(196px,1fr))] content-start gap-2 p-3 max-[1150px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                  {importesLista.map((p) => (
                    <TarjetaParte key={p.id} titulo={`Importe ${p.indice}`} importe={p.importe} cobrada={p.cobrada} onCobrar={() => onCobrarParte(p)} />
                  ))}
                  {restoImp > 0 && (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-dashed border-border bg-background p-3">
                      <div className="flex items-center justify-between"><b className="text-sm">Resto de la mesa</b><span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Pendiente</span></div>
                      <div className="text-2xl font-extrabold tabular-nums tracking-tight">{eur(restoImp)}</div>
                      <button type="button" onClick={() => onCobrarResto(restoImp)} className="min-h-11 rounded-md border border-warning bg-card text-xs font-bold text-warning transition-transform active:scale-[.98]">Cobrar el resto</button>
                    </div>
                  )}
                </Desplazable>
              </div>
            </div>
          )}
        </div>

        {/* ═════ Riel de progreso de cobro ═════ */}
        <div className="h-1.5 flex-none bg-border">
          <div className="h-full bg-success transition-all duration-300" style={{ width: `${progreso}%` }} />
        </div>

        {/* ═════ Pie ═════ */}
        <footer className="flex flex-none flex-wrap items-center gap-2.5 border-t border-border bg-surface px-4 py-3">
          <button type="button" onClick={onCerrar} className="flex min-h-13 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-transform active:scale-[.98]" title="Cierra la vista; el reparto se conserva">
            <X size={18} /> Cerrar
          </button>

          <div className="ml-2 flex gap-6">
            <div><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cobrado</small><b className="text-lg font-extrabold tabular-nums text-success">{eur(cobradoTotal)}</b></div>
            <div><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendiente</small><b className={`text-lg font-extrabold tabular-nums ${pendiente <= 0 ? "text-muted-foreground" : "text-warning"}`}>{eur(pendiente)}</b></div>
          </div>

          {pendientesBD.length > 0 && (
            <button type="button"
              onClick={() => { if (confQuitar) { onQuitarDivision(); setConfQuitar(false); } else setConfQuitar(true); }}
              onBlur={() => setConfQuitar(false)}
              className={`min-h-13 rounded-md border px-4 text-sm font-semibold transition-transform active:scale-[.98] ${confQuitar ? "border-danger bg-danger/10 text-danger" : "border-border bg-card text-muted-foreground"}`}
              title="Borra las partes pendientes (lo cobrado no se toca)">
              {confQuitar ? "¿Seguro? Quitar" : "Quitar división"}
            </button>
          )}

          <div className="flex-1" />

          {onAbrirCajon && (
            <button type="button" onClick={onAbrirCajon} className="min-h-13 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-transform active:scale-[.98]">Abrir cajón</button>
          )}
          <button type="button" onClick={imprimirTodas} className="flex min-h-13 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-transform active:scale-[.98]">
            <Printer size={18} /> Imprimir cuentas
          </button>

          <button type="button" onClick={onCobrarPendiente} disabled={pendiente <= 0}
            className="min-h-13 rounded-md bg-cobro px-8 text-lg font-bold text-white transition-transform active:scale-[.98] disabled:bg-surface disabled:text-muted-foreground"
            title="Cobra de una todo lo que falta">
            Cobrar la cuenta
          </button>
        </footer>
      </div>
    </Modal>
  );
}
