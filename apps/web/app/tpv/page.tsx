"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";

interface Mesa { id: string; nombre: string; estado: string }
interface Cat { id: string; nombre: string; orden: number }
interface Prod { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null }
interface Ticket { impuestos: { impuesto: string; desglose: { tipo: number; base: number; cuota: number }[]; importeTotal: number }; verifactu: { huella: string; qrDataUrl: string; leyenda: string }; numSerieFactura: string }

const eur = (n: number) => Number(n).toFixed(2) + " €";
const TERR: Record<string, string> = { PENINSULA_BALEARES: "PENINSULA_BALEARES", CANARIAS: "CANARIAS", CEUTA_MELILLA: "CEUTA_MELILLA", FORAL_PV: "PENINSULA_BALEARES", FORAL_NAVARRA: "PENINSULA_BALEARES" };

export default function TPV() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");
  const [userId, setUserId] = useState<string | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [barra, setBarra] = useState(false);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [comanda, setComanda] = useState<Record<string, number>>({});
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: loc } = await sb.from("location").select("id,territorio_fiscal").limit(1).maybeSingle();
      const { data: u } = await sb.from("app_user").select("id").eq("auth_user_id", session.user.id).maybeSingle();
      setLocationId(loc?.id ?? null);
      setTerritorio(loc?.territorio_fiscal ?? "PENINSULA_BALEARES");
      setUserId(u?.id ?? null);
      const [{ data: m }, { data: c }, { data: p }] = await Promise.all([
        sb.from("restaurant_table").select("id,nombre,estado").order("nombre"),
        sb.from("category").select("id,nombre,orden").order("orden"),
        sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id").eq("disponible", true).order("nombre"),
      ]);
      setMesas((m as Mesa[]) ?? []); setCats((c as Cat[]) ?? []); setProds((p as Prod[]) ?? []);
      setCatSel((c as Cat[])?.[0]?.id ?? null);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  const total = useMemo(() => Object.entries(comanda).reduce((s, [id, q]) => s + (prods.find((p) => p.id === id)?.precio ?? 0) * q, 0), [comanda, prods]);
  const unidades = Object.values(comanda).reduce((s, q) => s + q, 0);
  const add = (id: string) => setComanda((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) => setComanda((c) => { const n = (c[id] ?? 0) - 1; const { [id]: _, ...r } = c; return n > 0 ? { ...c, [id]: n } : r; });

  function lineasComanda() {
    return Object.entries(comanda).map(([id, cantidad]) => {
      const p = prods.find((x) => x.id === id)!;
      return { id, nombre: p.nombre, cantidad, precio: p.precio, tipo: p.tipo_impositivo };
    });
  }

  async function crearOrden(estado: string, estadoPrep: string) {
    const { data: order } = await sb.from("sales_order").insert({
      location_id: locationId, table_id: mesa?.id ?? null, user_id: userId,
      canal: "TPV", tipo_operacion: "VENTA", estado, estado_preparacion: estadoPrep,
      total: Math.round(total * 100) / 100, client_id: crypto.randomUUID(),
    }).select("id").single();
    if (!order) return null;
    await sb.from("order_line").insert(lineasComanda().map((l) => ({
      order_id: order.id, product_id: l.id, nombre: l.nombre, cantidad: l.cantidad, precio_unitario: l.precio, tipo_impositivo: l.tipo,
    })));
    return order.id as string;
  }

  async function enviarCocina() {
    if (!unidades) return;
    setBusy(true);
    try {
      await crearOrden("ENVIADA_COCINA", "PENDIENTE");
      if (mesa) await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      reset();
    } finally { setBusy(false); }
  }

  async function cobrar(metodo: string) {
    if (!unidades) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ territorio: TERR[territorio] ?? "PENINSULA_BALEARES", lineas: lineasComanda().map((l) => ({ precio: l.precio, tipo: l.tipo, cantidad: l.cantidad })) }),
      });
      const t = await res.json();
      const orderId = await crearOrden("COBRADA", "ENTREGADO");
      if (orderId) await sb.from("payment").insert({ order_id: orderId, metodo, importe: Math.round(total * 100) / 100, client_id: crypto.randomUUID() });
      if (mesa) await sb.from("restaurant_table").update({ estado: "LIBRE" }).eq("id", mesa.id);
      setTicket(t);
    } finally { setBusy(false); }
  }

  function reset() { setComanda({}); setMesa(null); setBarra(false); setTicket(null); }

  if (loading) return (
    <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
      Cargando…
    </div>
  );

  /* ---- Selección mesa/barra ---- */
  if (!mesa && !barra) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <strong className="font-semibold">TPV</strong>
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Panel</a>
        </header>
        <div className="p-5">
          <button onClick={() => setBarra(true)} className="btn-primary mb-4">🍺 Barra / venta directa</button>
          {mesas.length === 0 && (
            <div className="card text-muted-foreground">No hay mesas. Créalas en <b>Sala</b> o usa Barra.</div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {mesas.map((m) => (
              <button
                key={m.id}
                onClick={() => setMesa(m)}
                className={`grid h-24 place-items-center rounded-lg border-2 font-semibold ${
                  m.estado === "LIBRE"
                    ? "border-border bg-card text-foreground"
                    : "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                }`}
              >
                {m.nombre}
                <span className="text-xs font-normal text-muted-foreground">
                  {m.estado === "LIBRE" ? "Libre" : "Ocupada"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const productos = prods.filter((p) => p.category_id === catSel);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground">← Mesas</button>
        <strong>{mesa ? mesa.nombre : "Barra"}</strong>
        <span className="w-12" />
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Carta */}
        <div className="flex-1 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatSel(c.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${catSel === c.id ? "bg-brand text-brand-foreground" : "bg-muted text-foreground hover:bg-accent"}`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {productos.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className="rounded-md border border-border bg-card p-3 text-left shadow-sm hover:bg-accent"
              >
                <div className="font-medium">{p.nombre}</div>
                <div className="text-sm tabular-nums text-destructive">{eur(p.precio)}</div>
              </button>
            ))}
            {productos.length === 0 && (
              <p className="col-span-full text-muted-foreground">Sin productos. Añade carta en el panel.</p>
            )}
          </div>
        </div>

        {/* Cuenta / ticket */}
        <aside className="flex w-full flex-col border-t border-border bg-card p-4 md:w-96 md:border-l md:border-t-0">
          <h2 className="mb-2 font-medium">Cuenta</h2>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {unidades === 0 && <p className="text-muted-foreground">Añade productos.</p>}
            {Object.entries(comanda).map(([id, q]) => {
              const p = prods.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1">{p.nombre}</span>
                  <button onClick={() => sub(id)} className="h-7 w-7 rounded-md bg-muted text-foreground">−</button>
                  <span className="w-5 text-center tabular-nums">{q}</span>
                  <button onClick={() => add(id)} className="h-7 w-7 rounded-md bg-muted text-foreground">+</button>
                  <span className="w-16 text-right tabular-nums">{eur(p.precio * q)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-semibold tabular-nums">
            <span>Total</span><span>{eur(total)}</span>
          </div>
          <button
            onClick={enviarCocina}
            disabled={!unidades || busy}
            className="btn-ghost mt-3 w-full disabled:opacity-50"
          >
            Enviar a cocina
          </button>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["Efectivo", "Tarjeta", "Bizum"].map((m) => (
              <button
                key={m}
                onClick={() => cobrar(m)}
                disabled={!unidades || busy}
                className="btn-primary disabled:opacity-50"
              >
                {m}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {ticket && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-foreground/40 p-4" onClick={reset}>
          <div
            className="w-full max-w-xs rounded-lg border border-border bg-card p-5 text-center font-mono text-sm shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-base font-semibold">Ticket cobrado ✅</div>
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
            <img src={ticket.verifactu.qrDataUrl} alt="QR" className="mx-auto my-2 h-32 w-32" />
            <div className="font-semibold">{ticket.verifactu.leyenda}</div>
            <div className="text-xs text-muted-foreground">{ticket.numSerieFactura}</div>
            <button onClick={reset} className="btn-primary mt-3 w-full">Nueva venta</button>
          </div>
        </div>
      )}
    </div>
  );
}
