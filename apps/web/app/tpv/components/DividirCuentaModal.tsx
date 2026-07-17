"use client";

// Modal DIVIDIR CUENTA (fiel a docs/diseño/gluuh-dividir-cuenta.html). Tres formas
// de dividir en una sola pantalla:
//   · A partes iguales — reparte el total ÷N (en céntimos, exacto). Imprime un
//     justificante (proforma) por persona con lo que le toca. El cobro real es UNO
//     al final (una factura), vía onCobrar → CobrarModal.
//   · Por productos — reparte líneas en hasta 8 cuentas. Al dividir se crean N
//     DOCUMENTOS fiscales separados (onAceptarProductos → RPC dividir_cuenta),
//     cada uno con su propio ticket, cobrables por separado desde «Barra».
//   · Por importe — separa importes sueltos (teclado). Justificante por importe;
//     cobro real UNO al final. Mismo criterio fiscal que "partes iguales".
// PRESENTACIONAL: toda la lógica de reparto es LOCAL. Ni el reparto en partes ni el
// reparto por importe tocan fiscalidad (solo imprimen proforma); el cobro fiscal
// vive fuera (CobrarModal / RPC). Skill: gluuh-ux-operativa.
import { useMemo, useState } from "react";
import { Users, ListTree, Coins, Printer, Plus, Minus, Delete, X, ArrowRight } from "lucide-react";
import { eur } from "@/app/lib/money";

export interface LineaTicket {
  id: string;
  nombre: string;
  uds: number;
  /** Precio UNITARIO (impuesto incluido). Solo para mostrar subtotales. */
  precio: number;
}

export interface DividirCuentaModalProps {
  lineas: LineaTicket[];
  total: number;
  comensales?: number;
  /** Cabecera: "Mesa 4 · Terraza", "Barra", "Para llevar · Ana"… */
  contexto?: string;
  /** Reparto POR PRODUCTOS: crea un documento fiscal por cuenta (RPC). */
  onAceptarProductos(docs: { lineas: { id: string; uds: number }[] }[]): void;
  /** Imprime un justificante (proforma) con un importe a pagar. */
  onImprimirParte(etiqueta: string, importe: number): void;
  /** Cobro real de toda la cuenta (una factura) — abre el CobrarModal. */
  onCobrar(): void;
  onCancelar(): void;
  onAbrirCajon?(): void;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Reparto a partes iguales en céntimos (evita el 12,29 € del redondeo binario). */
function repartoIgual(total: number, n: number): number[] {
  const totalC = Math.round(total * 100);
  const baseC = Math.floor(totalC / n);
  const arr = Array<number>(n).fill(baseC / 100);
  arr[n - 1] = (totalC - baseC * (n - 1)) / 100;
  return arr;
}

export function DividirCuentaModal({
  lineas,
  total,
  comensales,
  contexto,
  onAceptarProductos,
  onImprimirParte,
  onCobrar,
  onCancelar,
  onAbrirCajon,
}: DividirCuentaModalProps) {
  const [modo, setModo] = useState<"partes" | "prod" | "imp">("partes");

  // ── Modo 1: partes iguales ──
  const [nPartes, setNPartes] = useState(() => Math.max(2, comensales ?? 2));
  const [partesPagadas, setPartesPagadas] = useState<number[]>([]);

  // ── Modo 2: por productos (uds asignadas por id, en cada cuenta) ──
  const [cuentas, setCuentas] = useState<Record<string, number>[]>(() => [{}, {}]);
  const [ctAct, setCtAct] = useState(0);
  const [ctPagadas, setCtPagadas] = useState<number[]>([]);

  // ── Modo 3: por importe ──
  const [buf, setBuf] = useState("");
  const [separados, setSeparados] = useState<{ importe: number; pagada: boolean }[]>([]);

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

  /* ══════════ MODO 1: partes iguales ══════════ */
  const partes = useMemo(() => repartoIgual(total, nPartes), [total, nPartes]);
  const partesExacto = partes.every((v) => v === partes[0]);
  const cobradoPartes = partesPagadas.reduce((s, i) => s + (partes[i] ?? 0), 0);

  function cambiarPartes(delta: number) {
    setNPartes((n) => {
      const next = Math.min(12, Math.max(2, n + delta));
      if (next !== n) setPartesPagadas([]);
      return next;
    });
  }

  /* ══════════ MODO 2: por productos ══════════ */
  const asignadas = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cuentas) for (const [id, u] of Object.entries(c)) m[id] = (m[id] ?? 0) + u;
    return m;
  }, [cuentas]);
  const sinAsignar = lineas
    .map((l) => ({ ...l, restantes: l.uds - (asignadas[l.id] ?? 0) }))
    .filter((l) => l.restantes > 0);
  const udsSinAsignar = sinAsignar.reduce((s, l) => s + l.restantes, 0);
  const totalSinAsignar = sinAsignar.reduce((s, l) => s + l.restantes * l.precio, 0);
  const todoAsignado = udsSinAsignar === 0;

  const totalCuenta = (c: Record<string, number>) =>
    Object.entries(c).reduce((s, [id, u]) => s + u * (precioDe[id] ?? 0), 0);

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
    if (ctPagadas.includes(ctAct)) return;
    const pend = sinAsignar.find((l) => l.id === id);
    if (!pend || pend.restantes <= 0) return;
    moverAsinAsignar(id, +1);
  }
  function pasarTodo() {
    if (ctPagadas.includes(ctAct)) return;
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
    if (ctPagadas.includes(ctAct)) return;
    setCuentas((prev) => prev.map((c, i) => (i === ctAct ? {} : c)));
  }
  function anadirCuenta() {
    if (cuentas.length >= 8) return;
    setCtAct(cuentas.length); // la nueva: índice = longitud actual
    setCuentas((prev) => [...prev, {}]);
  }

  // Documentos a emitir: cada cuenta con líneas → un documento fiscal.
  function dividirProductos() {
    const docs = cuentas
      .map((c) => ({
        lineas: Object.entries(c)
          .filter(([, u]) => u > 0)
          .map(([id, u]) => ({ id, uds: u })),
      }))
      .filter((d) => d.lineas.length > 0);
    onAceptarProductos(docs);
  }

  /* ══════════ MODO 3: por importe ══════════ */
  const repartidoImp = separados.reduce((s, x) => s + x.importe, 0);
  const restoImp = r2(total - repartidoImp);
  const cobradoImp = separados.filter((x) => x.pagada).reduce((s, x) => s + x.importe, 0);

  function pulsar(c: string) {
    if (c === "," && (buf.includes(",") || !buf)) return;
    if (buf.replace(",", "").length > 5) return;
    setBuf((b) => b + c);
  }
  function separarImporte() {
    const v = r2(parseFloat(buf.replace(",", ".")) || 0);
    if (v <= 0 || v > restoImp) return;
    setSeparados((prev) => [...prev, { importe: v, pagada: false }]);
    setBuf("");
  }
  function cobrarResto() {
    if (restoImp <= 0) return;
    setSeparados((prev) => [...prev, { importe: restoImp, pagada: true }]);
  }

  /* ══════════ estado del pie (según modo) ══════════ */
  const cobradoProd = ctPagadas.reduce((s, i) => s + totalCuenta(cuentas[i] ?? {}), 0);
  const cobrado = modo === "partes" ? cobradoPartes : modo === "imp" ? cobradoImp : cobradoProd;
  const pendiente = r2(Math.max(total - cobrado, 0));
  const progreso = total > 0 ? Math.min(100, (cobrado / total) * 100) : 0;

  // Imprime el justificante de TODAS las partes/cuentas del modo activo.
  function imprimirTodas() {
    if (modo === "partes") partes.forEach((im, i) => onImprimirParte(`Parte ${i + 1} de ${nPartes}`, im));
    else if (modo === "imp") separados.forEach((x, i) => onImprimirParte(`Importe ${i + 1}`, x.importe));
    else cuentas.forEach((c, i) => { const t = totalCuenta(c); if (t > 0) onImprimirParte(`Cuenta ${i + 1}`, t); });
  }

  const PISTAS = {
    partes: "Reparte el total entre los comensales. Imprime a cada uno lo que paga.",
    prod: "Toca un producto para pasarlo a la cuenta activa. Cada cuenta será su propio ticket.",
    imp: "Separa un importe suelto: el resto se queda en la cuenta de la mesa.",
  } as const;

  const cuentasConLineas = cuentas.filter((c) => Object.keys(c).length > 0).length;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Dividir cuenta"
    >
      {/* ═════ Cabecera ═════ */}
      <header className="flex flex-none items-center justify-between gap-4 border-b border-border bg-brand px-5 py-3 text-white">
        <div>
          <h2 className="text-xl font-bold">Dividir cuenta</h2>
          {contexto && <p className="text-xs text-white/70">{contexto}{comensales ? ` · ${comensales} comensales` : ""}</p>}
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Total del ticket</div>
          <div className="text-2xl font-bold tabular-nums">{eur(total)}</div>
        </div>
        <button type="button" onClick={onCancelar} aria-label="Cerrar" className="grid h-11 w-11 flex-none place-items-center rounded-lg transition-colors hover:bg-white/15 active:bg-white/25">
          <X size={22} />
        </button>
      </header>

      {/* ═════ Pestañas de modo ═════ */}
      <div className="flex flex-none items-center gap-2 border-b border-border bg-surface px-3 py-2" role="tablist">
        {([
          { id: "partes", label: "A partes iguales", icon: Users },
          { id: "prod", label: "Por productos", icon: ListTree },
          { id: "imp", label: "Por importe", icon: Coins },
        ] as const).map((t) => {
          const on = modo === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setModo(t.id)}
              className={`flex min-h-12 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-all active:scale-[.98] ${
                on ? "border-brand bg-brand text-white" : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
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
              <span className="text-sm text-muted-foreground">Dividir la cuenta entre</span>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => cambiarPartes(-1)} disabled={nPartes <= 2} aria-label="Una parte menos" className="grid h-16 w-16 place-items-center rounded-xl border border-border bg-surface text-3xl font-bold text-brand transition-all active:scale-95 active:bg-brand active:text-white disabled:opacity-30">−</button>
                <b className="min-w-17.5 text-5xl font-extrabold tabular-nums tracking-tight">{nPartes}</b>
                <button type="button" onClick={() => cambiarPartes(+1)} disabled={nPartes >= 12} aria-label="Una parte más" className="grid h-16 w-16 place-items-center rounded-xl border border-border bg-surface text-3xl font-bold text-brand transition-all active:scale-95 active:bg-brand active:text-white disabled:opacity-30">+</button>
              </div>
              <span className="text-sm text-muted-foreground">partes</span>
              <div className="w-full rounded-lg border border-brand/30 bg-brand/10 p-4">
                <small className="block text-xs font-bold uppercase tracking-wider text-brand">Cada uno paga</small>
                <b className="text-4xl font-extrabold tabular-nums tracking-tight text-brand">{eur(partes[0] ?? 0)}</b>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {partesExacto
                  ? `Sale exacto: ${nPartes} partes de ${eur(partes[0] ?? 0)}.`
                  : `No sale redondo: ${nPartes - 1} de ${eur(partes[0] ?? 0)} y una de ${eur(partes[nPartes - 1] ?? 0)}.`}
              </p>
            </div>

            <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
              <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Partes <span className="ml-auto normal-case tracking-normal text-foreground">{partesPagadas.length} de {nPartes} cobradas</span>
              </h3>
              <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(196px,1fr))] content-start gap-2 overflow-y-auto p-3 max-[1150px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                {partes.map((im, i) => {
                  const pagada = partesPagadas.includes(i);
                  return (
                    <div key={i} className={`flex flex-col gap-2.5 rounded-lg border p-3 ${pagada ? "border-success/40 bg-success/10" : "border-border bg-background"}`}>
                      <div className="flex items-center justify-between">
                        <b className="text-sm">Parte {i + 1}</b>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pagada ? "bg-success text-white" : "bg-surface text-muted-foreground"}`}>{pagada ? "Cobrada" : "Pendiente"}</span>
                      </div>
                      <div className={`text-2xl font-extrabold tabular-nums tracking-tight ${pagada ? "text-success" : ""}`}>{eur(im)}</div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => onImprimirParte(`Parte ${i + 1} de ${nPartes}`, im)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-bold transition-all hover:bg-accent active:scale-[.98]">
                          <Printer size={15} /> Imprimir
                        </button>
                        <button
                          type="button"
                          onClick={() => setPartesPagadas((p) => (pagada ? p.filter((x) => x !== i) : [...p, i]))}
                          className={`min-h-11 flex-1 rounded-md border text-xs font-bold transition-all active:scale-[.98] ${pagada ? "border-success bg-success text-white" : "border-warning bg-card text-warning hover:bg-warning/10"}`}
                        >
                          {pagada ? "Cobrada ✓" : "Cobrar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
                {sinAsignar.length === 0 && <p className="m-auto p-5 text-center text-sm text-muted-foreground">Todo repartido.<br />Cobra cada cuenta cuando quieras.</p>}
                {sinAsignar.map((l) => (
                  <button key={l.id} type="button" onClick={() => pasarUnidad(l.id)} className="grid min-h-14 grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-md border border-border bg-background px-2.5 text-left transition-all hover:border-brand hover:bg-brand/5 active:scale-[.99]">
                    <span className="grid h-9 place-items-center rounded bg-surface text-sm font-extrabold tabular-nums">{l.restantes}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{l.nombre}</span><span className="text-[11px] text-muted-foreground">{eur(l.precio)} / ud.</span></span>
                    <span className="text-sm font-bold tabular-nums">{eur(l.restantes * l.precio)}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-none items-center gap-2.5 border-t border-border p-2.5">
                <div className="mr-auto"><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Queda por repartir</small><b className="text-lg font-extrabold tabular-nums">{eur(totalSinAsignar)}</b></div>
                <button type="button" onClick={pasarTodo} disabled={!sinAsignar.length} className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] disabled:opacity-40">Pasar todo a la cuenta</button>
              </div>
            </div>

            {/* Cuentas */}
            <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
              <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cuentas <span className="ml-auto normal-case tracking-normal text-muted-foreground">Toca un producto para pasarlo aquí</span>
              </h3>
              <div className="flex flex-none gap-1.5 overflow-x-auto px-3 pb-2">
                {cuentas.map((c, i) => {
                  const on = i === ctAct;
                  const pag = ctPagadas.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => setCtAct(i)} aria-selected={on} className={`flex min-h-13 flex-none flex-col justify-center gap-0.5 rounded-md border px-3.5 py-1.5 text-left transition-all ${on ? "border-brand bg-brand text-white" : pag ? "border-success/40 bg-success/10" : "border-border bg-background hover:bg-accent"}`}>
                      <b className="text-sm">Cuenta {i + 1}</b>
                      <small className={`text-xs ${on ? "text-white/70" : "text-muted-foreground"}`}>{pag ? "Marcada ✓" : eur(totalCuenta(c))}</small>
                    </button>
                  );
                })}
                {cuentas.length < 8 && (
                  <button type="button" onClick={anadirCuenta} className="flex min-h-13 flex-none items-center rounded-md border border-dashed border-brand px-3.5 text-sm font-bold text-brand transition-all hover:bg-brand/5">+ Añadir</button>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
                {Object.keys(cuentas[ctAct] ?? {}).length === 0 && <p className="m-auto p-5 text-center text-sm text-muted-foreground">Cuenta {ctAct + 1} vacía.<br />Toca los productos de la izquierda.</p>}
                {Object.entries(cuentas[ctAct] ?? {}).filter(([, u]) => u > 0).map(([id, u]) => (
                  <button key={id} type="button" onClick={() => moverAsinAsignar(id, -1)} className="grid min-h-14 grid-cols-[40px_1fr_auto] items-center gap-2.5 rounded-md border border-brand/30 bg-brand/5 px-2.5 text-left transition-all hover:border-danger hover:bg-danger/5 active:scale-[.99]" title="Tocar para devolver 1 unidad">
                    <span className="grid h-9 place-items-center rounded bg-brand/10 text-sm font-extrabold tabular-nums text-brand">{u}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{nombreDe[id]}</span><span className="text-[11px] text-muted-foreground">{eur(precioDe[id] ?? 0)} / ud.</span></span>
                    <span className="text-sm font-bold tabular-nums">{eur(u * (precioDe[id] ?? 0))}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-none items-center gap-2 border-t border-border p-2.5">
                <div className="mr-auto"><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total de la cuenta {ctAct + 1}</small><b className="text-lg font-extrabold tabular-nums">{eur(totalCuenta(cuentas[ctAct] ?? {}))}</b></div>
                <button type="button" onClick={vaciarCuenta} disabled={!Object.keys(cuentas[ctAct] ?? {}).length} className="min-h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] disabled:opacity-40">Devolver todo</button>
                <button type="button" onClick={() => onImprimirParte(`Cuenta ${ctAct + 1}`, totalCuenta(cuentas[ctAct] ?? {}))} disabled={!Object.keys(cuentas[ctAct] ?? {}).length} className="flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98] disabled:opacity-40"><Printer size={15} /> Imprimir</button>
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
                  <button key={k} type="button" onClick={() => pulsar(k)} className="min-h-14 bg-card text-2xl font-semibold text-success transition-colors active:bg-success/10">{k}</button>
                ))}
                <button type="button" onClick={() => setBuf((b) => b.slice(0, -1))} aria-label="Borrar" className="grid min-h-14 place-items-center bg-card text-success transition-colors active:bg-success/10"><Delete size={24} /></button>
              </div>
              <button type="button" onClick={separarImporte} disabled={!buf || restoImp <= 0} className="min-h-14 flex-none rounded-md bg-brand text-base font-bold text-white transition-all active:scale-[.98] disabled:bg-surface disabled:text-muted-foreground">Separar este importe</button>
            </div>

            <div className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
              <h3 className="flex flex-none items-center gap-2 px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Importes separados <span className="ml-auto normal-case tracking-normal text-foreground">{eur(repartidoImp)} de {eur(total)} repartidos</span>
              </h3>
              <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(196px,1fr))] content-start gap-2 overflow-y-auto p-3 max-[1150px]:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                {separados.map((x, i) => (
                  <div key={i} className={`flex flex-col gap-2.5 rounded-lg border p-3 ${x.pagada ? "border-success/40 bg-success/10" : "border-border bg-background"}`}>
                    <div className="flex items-center justify-between">
                      <b className="text-sm">Importe {i + 1}</b>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${x.pagada ? "bg-success text-white" : "bg-surface text-muted-foreground"}`}>{x.pagada ? "Cobrado" : "Pendiente"}</span>
                    </div>
                    <div className={`text-2xl font-extrabold tabular-nums tracking-tight ${x.pagada ? "text-success" : ""}`}>{eur(x.importe)}</div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => onImprimirParte(`Importe ${i + 1}`, x.importe)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card text-xs font-bold transition-all hover:bg-accent active:scale-[.98]"><Printer size={15} /> Imprimir</button>
                      <button type="button" onClick={() => setSeparados((prev) => prev.map((y, j) => (j === i ? { ...y, pagada: !y.pagada } : y)))} className={`min-h-11 flex-1 rounded-md border text-xs font-bold transition-all active:scale-[.98] ${x.pagada ? "border-success bg-success text-white" : "border-warning bg-card text-warning hover:bg-warning/10"}`}>{x.pagada ? "Cobrado ✓" : "Cobrar"}</button>
                    </div>
                  </div>
                ))}
                {restoImp > 0 && (
                  <div className="flex flex-col gap-2.5 rounded-lg border border-dashed border-border bg-background p-3">
                    <div className="flex items-center justify-between"><b className="text-sm">Resto de la mesa</b><span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Pendiente</span></div>
                    <div className="text-2xl font-extrabold tabular-nums tracking-tight">{eur(restoImp)}</div>
                    <button type="button" onClick={cobrarResto} className="min-h-11 rounded-md border border-warning bg-card text-xs font-bold text-warning transition-all hover:bg-warning/10 active:scale-[.98]">Cobrar el resto</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═════ Riel de progreso de cobro ═════ */}
      <div className="h-1.5 flex-none bg-border">
        <div className="h-full bg-success transition-all duration-300" style={{ width: `${progreso}%` }} />
      </div>

      {/* ═════ Pie: acciones globales ═════ */}
      <footer className="flex flex-none flex-wrap items-center gap-2.5 border-t border-border bg-surface px-4 py-3">
        <button type="button" onClick={onCancelar} className="flex min-h-13 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-all hover:border-danger hover:bg-danger/5 hover:text-danger active:scale-[.98]">
          <X size={18} /> Cancelar
        </button>

        <div className="ml-2 flex gap-6">
          <div><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cobrado</small><b className="text-lg font-extrabold tabular-nums text-success">{eur(cobrado)}</b></div>
          <div><small className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pendiente</small><b className={`text-lg font-extrabold tabular-nums ${pendiente <= 0 ? "text-muted-foreground" : "text-warning"}`}>{eur(pendiente)}</b></div>
        </div>

        <div className="flex-1" />

        {onAbrirCajon && (
          <button type="button" onClick={onAbrirCajon} className="min-h-13 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">Abrir cajón</button>
        )}
        <button type="button" onClick={imprimirTodas} className="flex min-h-13 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold transition-all hover:bg-accent active:scale-[.98]">
          <Printer size={18} /> Imprimir cuentas
        </button>

        {modo === "prod" ? (
          <button
            type="button"
            onClick={dividirProductos}
            disabled={!todoAsignado || cuentasConLineas < 2}
            className="min-h-13 rounded-md bg-warning px-8 text-lg font-bold text-white shadow-md shadow-warning/25 transition-all hover:brightness-105 active:scale-[.98] disabled:bg-surface disabled:text-muted-foreground disabled:shadow-none"
            title={!todoAsignado ? "Asigna todos los productos" : cuentasConLineas < 2 ? "Necesitas al menos dos cuentas con productos" : undefined}
          >
            Dividir en {cuentasConLineas || cuentas.length} tickets
          </button>
        ) : (
          <button
            type="button"
            onClick={onCobrar}
            className={`min-h-13 rounded-md px-8 text-lg font-bold text-white shadow-md transition-all hover:brightness-105 active:scale-[.98] ${pendiente <= 0 ? "bg-success shadow-success/25" : "bg-warning shadow-warning/25"}`}
          >
            {pendiente <= 0 ? "Cerrar mesa" : "Cobrar la cuenta"}
          </button>
        )}
      </footer>
    </div>
  );
}
