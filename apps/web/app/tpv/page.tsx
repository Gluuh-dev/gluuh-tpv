"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Utensils } from "lucide-react";

/* ─── Tipos ─── */
interface Mesa   { id: string; nombre: string; estado: string }
interface Family { id: string; nombre: string; color: string }
interface Cat    { id: string; nombre: string; orden: number; family_id: string | null }
interface Prod   { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null }
interface Ticket {
  impuestos: { impuesto: string; desglose: { tipo: number; base: number; cuota: number }[]; importeTotal: number };
  verifactu: { huella: string; qrDataUrl: string; leyenda: string };
  numSerieFactura: string;
}

/* ─── Helpers ─── */
const eur = (n: number) => Number(n).toFixed(2) + " €";
const TERR: Record<string, string> = {
  PENINSULA_BALEARES: "PENINSULA_BALEARES", CANARIAS: "CANARIAS",
  CEUTA_MELILLA: "CEUTA_MELILLA", FORAL_PV: "PENINSULA_BALEARES", FORAL_NAVARRA: "PENINSULA_BALEARES",
};

/* ─── Modo de pago extra ─── */
type ModoDescuento = { tipo: "PCT" | "EUR"; valor: number };

/* ─── Teclado keys ─── */
const KEYPAD_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["0", ",", "CLR"],
  ["DTO%", "DTO€", "PREC"],
  ["CAN", "", ""],
] as const;

export default function TPV() {
  const sb = supabaseBrowser();
  const router = useRouter();

  /* ── Datos ── */
  const [loading, setLoading]     = useState(true);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");
  const [userId, setUserId]       = useState<string | null>(null);
  const [mesas, setMesas]         = useState<Mesa[]>([]);
  const [families, setFamilies]   = useState<Family[]>([]);
  const [cats, setCats]           = useState<Cat[]>([]);
  const [prods, setProds]         = useState<Prod[]>([]);

  /* ── Selección de contexto ── */
  const [mesa, setMesa]   = useState<Mesa | null>(null);
  const [barra, setBarra] = useState(false);
  /* Cuenta abierta de la mesa (un pedido reutilizable por mesa) + importes por mesa */
  const [ordenAbiertaId, setOrdenAbiertaId] = useState<string | null>(null);
  const [totalesMesa, setTotalesMesa] = useState<Record<string, number>>({});

  /* ── Vista carta ── */
  const [catSel, setCatSel]   = useState<string | null>(null);
  const [vistaProds, setVistaProds] = useState(false);

  /* ── Comanda y ticket ── */
  const [comanda, setComanda] = useState<Record<string, number>>({});
  const [descuentos, setDescuentos] = useState<Record<string, ModoDescuento>>({});
  const [preciosManuales, setPreciosManuales] = useState<Record<string, number>>({});
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy]     = useState(false);

  /* ── Teclado ── */
  const [buffer, setBuffer]   = useState("");
  const [lineaSel, setLineaSel] = useState<string | null>(null);

  /* ── Modal pagos ── */
  const [modalPagos, setModalPagos] = useState(false);
  const [modalEfectivo, setModalEfectivo] = useState(false);
  const [entregado, setEntregado] = useState("");
  const [propina, setPropina] = useState("");

  /* ── Carga inicial ── */
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: loc } = await sb.from("location").select("id,territorio_fiscal").limit(1).maybeSingle();
      const { data: u }   = await sb.from("app_user").select("id").eq("auth_user_id", session.user.id).maybeSingle();
      setLocationId(loc?.id ?? null);
      setTerritorio(loc?.territorio_fiscal ?? "PENINSULA_BALEARES");
      setUserId(u?.id ?? null);
      const [{ data: f }, { data: c }, { data: p }] = await Promise.all([
        sb.from("family").select("id,nombre,color").order("orden"),
        sb.from("category").select("id,nombre,orden,family_id").order("orden"),
        sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id").eq("disponible", true).order("nombre"),
      ]);
      setFamilies((f as Family[]) ?? []);
      setCats((c as Cat[]) ?? []);
      setProds((p as Prod[]) ?? []);
      setCatSel((c as Cat[])?.[0]?.id ?? null);
      await recargarMesas();
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  /* ── Mapa color por categoría (vía family) ── */
  const colorCat = useMemo(() => {
    const famMap: Record<string, string> = {};
    for (const f of families) famMap[f.id] = f.color;
    const out: Record<string, string> = {};
    for (const c of cats) out[c.id] = c.family_id ? (famMap[c.family_id] ?? "") : "";
    return out;
  }, [families, cats]);

  /* ── Precio efectivo de una línea (descuento y/o precio manual) ── */
  const precioEfectivo = useMemo(() => (id: string): number => {
    const prod = prods.find((x) => x.id === id);
    if (!prod) return 0;
    const base = preciosManuales[id] ?? prod.precio;
    const desc = descuentos[id];
    if (!desc) return base;
    if (desc.tipo === "PCT") return Math.max(0, base * (1 - desc.valor / 100));
    return Math.max(0, base - desc.valor);
  }, [prods, preciosManuales, descuentos]);

  /* ── Total ── */
  const total = useMemo(
    () => Object.entries(comanda).reduce((s, [id, q]) => s + precioEfectivo(id) * q, 0),
    [comanda, precioEfectivo],
  );
  const unidades = Object.values(comanda).reduce((s, q) => s + q, 0);

  /* ── Lineas para cobro y cocina (precio efectivo) ── */
  function lineasComanda() {
    return Object.entries(comanda).map(([id, cantidad]) => {
      const p = prods.find((x) => x.id === id)!;
      return { id, nombre: p.nombre, cantidad, precio: precioEfectivo(id), tipo: p.tipo_impositivo };
    });
  }

  /* ── Operaciones de comanda ── */
  const addProd = (id: string) => {
    const qty = Number(buffer.replace(",", ".")) || 1;
    setComanda((c) => ({ ...c, [id]: (c[id] ?? 0) + qty }));
    setBuffer("");
  };
  const sub = (id: string) => setComanda((c) => {
    const n = (c[id] ?? 0) - 1;
    const { [id]: _, ...r } = c;
    return n > 0 ? { ...c, [id]: n } : r;
  });

  /* ── Teclado ── */
  function handleKey(k: string) {
    if (k === "CLR") { setBuffer(""); setLineaSel(null); return; }
    if (k === "CAN") {
      if (!lineaSel) return;
      setComanda((c) => { const { [lineaSel]: _, ...r } = c; return r; });
      setDescuentos((d) => { const { [lineaSel]: _, ...r } = d; return r; });
      setPreciosManuales((m) => { const { [lineaSel]: _, ...r } = m; return r; });
      setLineaSel(null); setBuffer(""); return;
    }
    if (k === "DTO%") {
      const val = Number(buffer.replace(",", "."));
      if (!val) return;
      if (lineaSel) {
        setDescuentos((d) => ({ ...d, [lineaSel]: { tipo: "PCT", valor: val } }));
      } else {
        // Aplica a todas las líneas
        const updates: Record<string, ModoDescuento> = {};
        for (const id of Object.keys(comanda)) updates[id] = { tipo: "PCT", valor: val };
        setDescuentos((d) => ({ ...d, ...updates }));
      }
      setBuffer(""); return;
    }
    if (k === "DTO€") {
      const val = Number(buffer.replace(",", "."));
      if (!val) return;
      if (lineaSel) {
        setDescuentos((d) => ({ ...d, [lineaSel]: { tipo: "EUR", valor: val } }));
      } else {
        const updates: Record<string, ModoDescuento> = {};
        for (const id of Object.keys(comanda)) updates[id] = { tipo: "EUR", valor: val };
        setDescuentos((d) => ({ ...d, ...updates }));
      }
      setBuffer(""); return;
    }
    if (k === "PREC") {
      const val = Number(buffer.replace(",", "."));
      if (!val || !lineaSel) return;
      setPreciosManuales((m) => ({ ...m, [lineaSel]: val }));
      setBuffer(""); return;
    }
    if (k === "" ) return;
    // Dígitos y coma
    if (k === "," && buffer.includes(",")) return;
    setBuffer((b) => b + k);
  }

  /* ── Backend ── */
  // Carga la lista de mesas + el importe de la cuenta abierta de cada una.
  async function recargarMesas() {
    const [{ data: m }, { data: ords }] = await Promise.all([
      sb.from("restaurant_table").select("id,nombre,estado").order("nombre"),
      sb.from("sales_order").select("table_id,total,created_at")
        .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
        .not("table_id", "is", null),
    ]);
    setMesas((m as Mesa[]) ?? []);
    const ultima: Record<string, { total: number; created_at: string }> = {};
    for (const o of (ords ?? []) as { table_id: string; total: number; created_at: string }[]) {
      const prev = ultima[o.table_id];
      if (!prev || o.created_at > prev.created_at) ultima[o.table_id] = { total: Number(o.total), created_at: o.created_at };
    }
    const tot: Record<string, number> = {};
    for (const k of Object.keys(ultima)) tot[k] = ultima[k]!.total;
    setTotalesMesa(tot);
  }

  // Crea o REUTILIZA la cuenta abierta de la mesa (un único pedido por mesa).
  async function crearOrden(estado: string, estadoPrep: string) {
    const lineas = lineasComanda().map((l) => ({
      product_id: l.id, nombre: l.nombre,
      cantidad: l.cantidad, precio_unitario: l.precio, tipo_impositivo: l.tipo,
    }));
    const totalRedondeado = Math.round(total * 100) / 100;

    let orderId = ordenAbiertaId;
    if (orderId) {
      await sb.from("sales_order").update({ estado, estado_preparacion: estadoPrep, total: totalRedondeado }).eq("id", orderId);
      await sb.from("order_line").delete().eq("order_id", orderId);
    } else {
      const { data: order } = await sb.from("sales_order").insert({
        location_id: locationId, table_id: mesa?.id ?? null, user_id: userId,
        canal: "TPV", tipo_operacion: "VENTA", estado, estado_preparacion: estadoPrep,
        total: totalRedondeado, client_id: crypto.randomUUID(),
      }).select("id").single();
      if (!order) return null;
      orderId = (order as { id: string }).id;
      setOrdenAbiertaId(orderId);
    }
    if (lineas.length) {
      await sb.from("order_line").insert(lineas.map((l) => ({ order_id: orderId, ...l })));
    }
    return orderId;
  }

  // Abre una mesa y carga su cuenta (líneas) si la tiene.
  async function abrirMesa(m: Mesa) {
    setMesa(m); setBarra(false); setTicket(null);
    setComanda({}); setDescuentos({}); setPreciosManuales({});
    setBuffer(""); setLineaSel(null); setVistaProds(false);
    setOrdenAbiertaId(null);

    const { data: ord } = await sb.from("sales_order")
      .select("id").eq("table_id", m.id)
      .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ord) return;
    const oid = (ord as { id: string }).id;
    setOrdenAbiertaId(oid);

    const { data: lns } = await sb.from("order_line")
      .select("product_id,cantidad,precio_unitario").eq("order_id", oid);
    const comandaCargada: Record<string, number> = {};
    const precios: Record<string, number> = {};
    for (const l of (lns ?? []) as { product_id: string | null; cantidad: number; precio_unitario: number }[]) {
      if (!l.product_id || !prods.some((p) => p.id === l.product_id)) continue;
      comandaCargada[l.product_id] = (comandaCargada[l.product_id] ?? 0) + Number(l.cantidad);
      precios[l.product_id] = Number(l.precio_unitario);
    }
    setComanda(comandaCargada);
    setPreciosManuales(precios);
  }

  async function enviarCocina(estadoPrep: string) {
    if (!unidades) return;
    setBusy(true);
    try {
      await crearOrden("ENVIADA_COCINA", estadoPrep);
      if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      await recargarMesas();
      reset();
    } finally { setBusy(false); }
  }

  // Guardar la cuenta de la mesa y volver a la lista (en barra solo limpia).
  async function volver() {
    if (mesa && unidades > 0) {
      setBusy(true);
      try {
        await crearOrden("ABIERTA", "PENDIENTE");
        await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
        await recargarMesas();
      } finally { setBusy(false); }
    }
    reset();
  }

  async function cobrar(metodo: string, propina = 0) {
    if (!unidades) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          territorio: TERR[territorio] ?? "PENINSULA_BALEARES",
          lineas: lineasComanda().map((l) => ({ precio: l.precio, tipo: l.tipo, cantidad: l.cantidad })),
        }),
      });
      const t = await res.json();
      const orderId = await crearOrden("COBRADA", "ENTREGADO");
      if (orderId) {
        // El esquema exige el método en MAYÚSCULAS (CHECK de payment); normalizamos
        // la etiqueta de la UI ("Efectivo") al valor del enum ('EFECTIVO').
        const metodoDb =
          ({ Efectivo: "EFECTIVO", Tarjeta: "TARJETA", Bizum: "BIZUM", QR: "QR", Wallet: "WALLET" } as Record<string, string>)[metodo] ??
          metodo.toUpperCase();
        const { error: payErr } = await sb.from("payment").insert({
          order_id: orderId,
          metodo: metodoDb,
          importe: Math.round(total * 100) / 100,
          propina: Math.round((propina || 0) * 100) / 100,
          client_id: crypto.randomUUID(),
        });
        if (payErr) console.error("No se registró el pago:", payErr.message);
      }
      if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      setOrdenAbiertaId(null);
      await recargarMesas();

      // ── Persistencia VERIFACTU (best-effort: si falla, el ticket del flujo actual sigue) ──
      try {
        const tok = (await sb.auth.getSession()).data.session?.access_token;
        const fr = await fetch("/api/factura", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          },
          body: JSON.stringify({
            orderId,
            lineas: lineasComanda().map((l) => ({ precio: l.precio, tipo: l.tipo, cantidad: l.cantidad })),
          }),
        });
        const fj = await fr.json();
        if (fj?.ok) {
          // Si la persistencia tiene éxito, enriquece el ticket con datos reales de la factura
          t.numSerieFactura = fj.numSerieFactura ?? t.numSerieFactura;
          if (fj.qrDataUrl) t.verifactu.qrDataUrl = fj.qrDataUrl;
          if (fj.huella) t.verifactu.huella = fj.huella;
        }
      } catch {
        // best-effort: si /api/factura falla (p.ej. migración no aplicada), el ticket sigue con /api/ticket
      }

      setTicket(t);
    } finally { setBusy(false); setModalPagos(false); }
  }

  function reset() {
    setComanda({}); setDescuentos({}); setPreciosManuales({});
    setMesa(null); setBarra(false); setTicket(null);
    setBuffer(""); setLineaSel(null); setVistaProds(false);
    setOrdenAbiertaId(null);
  }

  /* ─────────────────────────────── RENDERS ─────────────────────────────── */

  if (loading) return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>
  );

  /* ── Selección mesa/barra ── */
  if (!mesa && !barra) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <strong className="font-semibold">TPV</strong>
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Panel</a>
        </header>
        <div className="p-5">
          <button onClick={() => setBarra(true)} className="btn-primary mb-4">Barra / venta directa</button>
          {mesas.length === 0 && (
            <div className="card text-muted-foreground">No hay mesas. Créalas en <b>Sala</b> o usa Barra.</div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {mesas.map((m) => {
              const cuenta = totalesMesa[m.id] ?? 0;
              const ocupada = cuenta > 0 || m.estado !== "LIBRE";
              return (
                <button
                  key={m.id}
                  onClick={() => abrirMesa(m)}
                  className={`grid h-24 place-items-center rounded-lg border-2 font-semibold ${
                    ocupada
                      ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {m.nombre}
                  <span className={`text-xs font-${cuenta > 0 ? "semibold" : "normal"} ${cuenta > 0 ? "" : "text-muted-foreground"}`}>
                    {ocupada ? (cuenta > 0 ? eur(cuenta) : "Ocupada") : "Libre"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── Pantalla venta (layout Ágora) ── */
  const productosCat = prods.filter((p) => p.category_id === catSel);
  const catActual    = cats.find((c) => c.id === catSel);
  const colorActual  = catActual ? (colorCat[catActual.id] ?? "") : "";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">

      {/* ── Cabecera con barra de acento de color ── */}
      <header className="flex-none border-b border-border bg-card">
        <div
          className="h-1 w-full"
          style={{ background: colorActual || "var(--brand)" }}
        />
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">{mesa ? mesa.nombre : "Barra"}</span>
            <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
          <span className="text-sm text-muted-foreground">{new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </header>

      {/* ── Cuerpo: ticket+teclado | categorías+productos ── */}
      <div className="flex min-h-0 flex-1">

        {/* ─── Columna izquierda: ticket + teclado ─── */}
        <div className="flex w-72 flex-none flex-col border-r border-border bg-card">

          {/* Líneas del ticket */}
          <div className="flex-1 overflow-y-auto p-2">
            {unidades === 0 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">Añade productos</p>
            )}
            {/* Cabecera columnas */}
            {unidades > 0 && (
              <div className="mb-1 flex items-center gap-1 border-b border-border pb-1 text-xs font-medium text-muted-foreground">
                <span className="w-8 text-right">Uds</span>
                <span className="flex-1 pl-1">Producto</span>
                <span className="w-12 text-right">Precio</span>
                <span className="w-14 text-right">Total</span>
              </div>
            )}
            {Object.entries(comanda).map(([id, q]) => {
              const p    = prods.find((x) => x.id === id)!;
              const pe   = precioEfectivo(id);
              const sel  = lineaSel === id;
              const desc = descuentos[id];
              const pm   = preciosManuales[id];
              return (
                <button
                  key={id}
                  onClick={() => setLineaSel(sel ? null : id)}
                  className={`w-full flex items-center gap-1 rounded-md px-1 py-1 text-left text-xs transition-colors ${
                    sel ? "bg-brand text-brand-foreground" : "hover:bg-accent"
                  }`}
                >
                  <span className="w-8 text-right tabular-nums font-medium">{q}</span>
                  <span className="flex-1 truncate pl-1">
                    {p.nombre}
                    {(desc || pm) && (
                      <span className={`ml-1 text-[10px] ${sel ? "opacity-80" : "text-muted-foreground"}`}>
                        {pm ? `P:${eur(pm)}` : ""}
                        {desc ? (desc.tipo === "PCT" ? ` -${desc.valor}%` : ` -${eur(desc.valor)}`) : ""}
                      </span>
                    )}
                  </span>
                  <span className="w-12 text-right tabular-nums">{eur(pe)}</span>
                  <span className="w-14 text-right tabular-nums font-medium">{eur(pe * q)}</span>
                </button>
              );
            })}
          </div>

          {/* Total */}
          <div className="border-t border-border px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">TOTAL</span>
              <span className="text-3xl font-bold tabular-nums">{eur(total)}</span>
            </div>
          </div>

          {/* Teclado numérico */}
          <div className="border-t border-border p-2">
            {/* Buffer display */}
            <div className="mb-1 h-7 rounded-md border border-border bg-muted px-2 text-right font-mono text-sm tabular-nums leading-7">
              {buffer || <span className="text-muted-foreground">0</span>}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {KEYPAD_ROWS.map((row, ri) =>
                row.map((k, ki) => {
                  const isSpecial = ["DTO%", "DTO€", "PREC", "CAN", "CLR"].includes(k);
                  const isEmpty   = k === "";
                  return (
                    <button
                      key={`${ri}-${ki}`}
                      onClick={() => handleKey(k)}
                      disabled={isEmpty}
                      className={`h-9 rounded-md text-sm font-medium transition-colors ${
                        isEmpty
                          ? "invisible"
                          : isSpecial
                          ? "bg-muted text-foreground hover:bg-accent border border-border"
                          : "bg-card text-foreground hover:bg-accent border border-border"
                      }`}
                    >
                      {k}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ─── Columna derecha: categorías → productos ─── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!vistaProds ? (
            /* Rejilla de categorías a color */
            <div className="flex-1 overflow-y-auto p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Categorías</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {cats.map((c) => {
                  const color = colorCat[c.id] || "#64748b";
                  return (
                    <button
                      key={c.id}
                      onClick={() => { setCatSel(c.id); setVistaProds(true); }}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center transition-opacity hover:opacity-90 shadow-sm"
                      style={{ background: color, color: "#fff" }}
                    >
                      <Utensils size={20} strokeWidth={1.5} />
                      <span className="text-xs font-semibold leading-tight">{c.nombre}</span>
                    </button>
                  );
                })}
                {cats.length === 0 && (
                  <p className="col-span-full text-muted-foreground text-sm">Sin categorías. Añade carta en el panel.</p>
                )}
              </div>
            </div>
          ) : (
            /* Productos de la categoría seleccionada */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div
                className="flex items-center gap-2 border-b border-border px-3 py-2"
                style={{ borderLeftWidth: 4, borderLeftColor: colorActual || "transparent" }}
              >
                <button
                  onClick={() => setVistaProds(false)}
                  className="mr-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent"
                >
                  ← Categorías
                </button>
                <span className="font-semibold text-sm">{catActual?.nombre}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {productosCat.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProd(p.id)}
                      className="rounded-md border border-border bg-card p-3 text-left shadow-sm hover:bg-accent transition-colors"
                    >
                      <div className="font-medium text-sm leading-tight">{p.nombre}</div>
                      <div className="mt-1 tabular-nums text-xs text-destructive">{eur(p.precio)}</div>
                    </button>
                  ))}
                  {productosCat.length === 0 && (
                    <p className="col-span-full text-muted-foreground text-sm">Sin productos en esta categoría.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Barra de acciones ── */}
      <footer className="flex-none border-t border-border bg-card px-2 py-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setEntregado(""); setModalEfectivo(true); }}
            disabled={!unidades || busy}
            className="btn-primary disabled:opacity-50"
          >
            Cobrar Efectivo
          </button>
          <button
            onClick={() => { setPropina(""); setModalPagos(true); }}
            disabled={!unidades || busy}
            className="btn-ghost disabled:opacity-50"
          >
            Pagos
          </button>
          <button
            onClick={() => window.print()}
            className="btn-ghost"
          >
            Imprimir
          </button>
          <button
            onClick={() => enviarCocina("PENDIENTE")}
            disabled={!unidades || busy}
            className="btn-ghost disabled:opacity-50"
          >
            Preparar
          </button>
          <button
            onClick={() => enviarCocina("EN_PREPARACION")}
            disabled={!unidades || busy}
            className="btn-ghost disabled:opacity-50"
          >
            Marchar
          </button>
          <button
            onClick={() => enviarCocina("ENTREGADO")}
            disabled={!unidades || busy}
            className="btn-ghost disabled:opacity-50"
          >
            Entregar Comanda
          </button>
          <button
            onClick={volver}
            disabled={busy}
            className="ml-auto btn-ghost disabled:opacity-50"
          >
            Volver
          </button>
        </div>
      </footer>

      {/* ── Modal selector de método de pago ── */}
      {modalPagos && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-foreground/40 p-4" onClick={() => setModalPagos(false)}>
          <div
            className="w-full max-w-xs rounded-lg border border-border bg-card p-5 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 font-semibold">Selecciona método de pago</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Total: <b className="text-foreground tabular-nums">{total.toFixed(2)} €</b>
              {Number(propina) > 0 && (
                <> · con propina: <b className="text-foreground tabular-nums">{(total + Number(propina)).toFixed(2)} €</b></>
              )}
            </p>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Propina (opcional)</label>
            <div className="mb-4 flex items-center gap-1.5">
              <input
                type="number" inputMode="decimal" min={0} step="0.10"
                value={propina}
                onChange={(e) => setPropina(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-right tabular-nums outline-none focus:border-brand"
              />
              {[1, 2].map((b) => (
                <button key={b} onClick={() => setPropina(String(b))} className="btn-ghost text-xs">{b}€</button>
              ))}
              <button onClick={() => setPropina("")} className="btn-ghost text-xs">×</button>
            </div>

            <div className="flex flex-col gap-2">
              {["Efectivo", "Tarjeta", "Bizum"].map((m) => (
                <button key={m} onClick={() => { setModalPagos(false); cobrar(m, Number(propina) || 0); }} disabled={busy} className="btn-primary disabled:opacity-50 w-full">
                  {m}
                </button>
              ))}
              <button onClick={() => setModalPagos(false)} className="btn-ghost w-full mt-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cobro en efectivo (con cálculo de cambio) ── */}
      {modalEfectivo && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-foreground/40 p-4" onClick={() => setModalEfectivo(false)}>
          <div className="w-full max-w-xs rounded-lg border border-border bg-card p-5 shadow-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-semibold">Cobro en efectivo</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Total a cobrar: <b className="text-foreground tabular-nums">{total.toFixed(2)} €</b>
            </p>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entregado</label>
            <input
              type="number" inputMode="decimal" min={0} step="0.01"
              value={entregado}
              onChange={(e) => setEntregado(e.target.value)}
              placeholder={total.toFixed(2)}
              className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-right text-lg tabular-nums outline-none focus:border-brand"
            />

            <div className="mb-3 grid grid-cols-5 gap-1.5">
              <button onClick={() => setEntregado(total.toFixed(2))} className="btn-ghost text-xs">Exacto</button>
              {[5, 10, 20, 50].map((b) => (
                <button key={b} onClick={() => setEntregado(String(b))} className="btn-ghost text-xs">{b}€</button>
              ))}
            </div>

            {(() => {
              const cambio = Number(entregado) - total;
              const ok = entregado !== "" && cambio >= 0;
              return (
                <div className={`mb-4 rounded-md px-3 py-2 text-center text-sm ${ok ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  Cambio: <b className="tabular-nums">{ok ? cambio.toFixed(2) + " €" : "—"}</b>
                </div>
              );
            })()}

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setModalEfectivo(false); cobrar("Efectivo"); }}
                disabled={busy}
                className="btn-primary w-full disabled:opacity-50"
              >
                Cobrar {total.toFixed(2)} €
              </button>
              <button onClick={() => setModalEfectivo(false)} className="btn-ghost w-full">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ticket QR VERIFACTU ── */}
      {ticket && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-foreground/40 p-4" onClick={reset}>
          <div
            className="w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center font-mono text-sm shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-base font-semibold">Ticket cobrado</div>
            {ticket.impuestos.desglose.map((d) => (
              <div key={d.tipo} className="flex justify-between">
                <span>{ticket.impuestos.impuesto} {d.tipo}%</span>
                <span className="tabular-nums">{eur(d.cuota)}</span>
              </div>
            ))}
            <div className="my-1 flex justify-between border-t border-border pt-1 font-semibold tabular-nums">
              <span>TOTAL</span><span>{eur(ticket.impuestos.importeTotal)}</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.verifactu.qrDataUrl} alt="QR VERIFACTU" className="mx-auto my-2 h-32 w-32" />
            <div className="font-semibold">{ticket.verifactu.leyenda}</div>
            <div className="text-xs text-muted-foreground">{ticket.numSerieFactura}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => window.print()} className="btn-ghost flex-1">Imprimir</button>
              <button onClick={reset} className="btn-primary flex-1">Nueva venta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
