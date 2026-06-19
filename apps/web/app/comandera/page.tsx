"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { estacionDe } from "../lib/estaciones";

interface Empleado { id: string; nombre: string; rol: string }
interface Mesa { id: string; nombre: string; estado: string }
interface Cat { id: string; nombre: string; orden: number }
interface Prod { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null; disponible: boolean; estacion: string | null }

const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Comandera() {
  const sb = supabaseBrowser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [locationId, setLocationId] = useState<string | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [comanda, setComanda] = useState<Record<string, number>>({});
  const [carrito, setCarrito] = useState(false);   // hoja inferior abierta
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: loc } = await sb.from("location").select("id").limit(1).maybeSingle();
      setLocationId(loc?.id ?? null);
      const [{ data: m }, { data: c }, { data: p }] = await Promise.all([
        sb.from("restaurant_table").select("id,nombre,estado").order("nombre"),
        sb.from("category").select("id,nombre,orden").order("orden"),
        sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id,disponible,estacion").eq("disponible", true).order("nombre"),
      ]);
      setMesas((m as Mesa[]) ?? []);
      setCats((c as Cat[]) ?? []);
      setProds((p as Prod[]) ?? []);
      setCatSel((c as Cat[])?.[0]?.id ?? null);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  async function comprobarPin() {
    setPinError("");
    const { data, error } = await sb.rpc("validar_pin", { p_pin: pin });
    if (error) { setPinError(error.message); return; }
    const emp = (data as Empleado[])?.[0];
    if (!emp) { setPinError("PIN incorrecto"); setPin(""); return; }
    setEmpleado(emp);
    setPin("");
  }

  const total = useMemo(
    () => Object.entries(comanda).reduce((s, [id, q]) => s + (prods.find((p) => p.id === id)?.precio ?? 0) * q, 0),
    [comanda, prods],
  );
  const unidades = Object.values(comanda).reduce((s, q) => s + q, 0);
  const add = (id: string) => setComanda((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) => setComanda((c) => { const n = (c[id] ?? 0) - 1; const { [id]: _, ...r } = c; return n > 0 ? { ...c, [id]: n } : r; });

  async function enviar() {
    if (!mesa || !empleado || !unidades) return;
    setEnviando(true);
    try {
      const { data: order, error } = await sb.from("sales_order").insert({
        location_id: locationId, table_id: mesa.id, user_id: empleado.id,
        canal: "COMANDERA", tipo_operacion: "VENTA", estado: "ENVIADA_COCINA",
        estado_preparacion: "PENDIENTE", total: Math.round(total * 100) / 100, client_id: crypto.randomUUID(),
      }).select("id").single();
      if (error || !order) { alert("Error: " + error?.message); return; }
      const lineas = Object.entries(comanda).map(([id, cantidad]) => {
        const p = prods.find((x) => x.id === id)!;
        return { order_id: order.id, product_id: id, nombre: p.nombre, cantidad, precio_unitario: p.precio, tipo_impositivo: p.tipo_impositivo, estacion: estacionDe(p.estacion) };
      });
      await sb.from("order_line").insert(lineas);
      await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      setComanda({}); setCarrito(false); setMesa(null);
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return (
    <div className="dark grid min-h-[100dvh] place-items-center bg-background text-muted-foreground">Cargando…</div>
  );

  /* ───────── PIN ───────── */
  if (!empleado) {
    const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
    return (
      <div className="dark grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
        <div className="w-full max-w-xs text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl font-bold text-brand-foreground">G</div>
          <h1 className="text-xl font-semibold tracking-tight">Comandera</h1>
          <p className="mb-5 text-sm text-muted-foreground">Introduce tu PIN</p>
          <div className="mb-5 flex justify-center gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors ${i < pin.length ? "bg-brand" : "bg-muted"}`} />
            ))}
          </div>
          {pinError && <p className="mb-3 text-sm text-destructive">{pinError}</p>}
          <div className="grid grid-cols-3 gap-3">
            {teclas.map((t) => (
              <button
                key={t}
                onClick={() => { if (t === "C") setPin(""); else if (t === "OK") comprobarPin(); else if (pin.length < 8) setPin(pin + t); }}
                className={`h-16 select-none rounded-2xl text-2xl font-semibold active:scale-95 ${t === "OK" ? "bg-brand text-brand-foreground" : "bg-card text-foreground hover:bg-accent"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ───────── MESAS ───────── */
  if (!mesa) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <strong className="font-semibold">Mesas</strong>
          <button className="rounded-full bg-muted px-3 py-1 text-sm" onClick={() => setEmpleado(null)}>{empleado.nombre} ·  salir</button>
        </header>
        <div className="p-4">
          {mesas.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">No hay mesas. Créalas en <b>Sala</b> (panel).</div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {mesas.map((m) => {
              const ocupada = m.estado !== "LIBRE";
              return (
                <button
                  key={m.id}
                  onClick={() => { setMesa(m); setComanda({}); }}
                  className={`grid aspect-square place-items-center rounded-2xl border-2 text-center font-semibold active:scale-95 ${
                    ocupada ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" : "border-border bg-card text-foreground"
                  }`}
                >
                  <span className="text-lg">{m.nombre.replace("Mesa ", "")}</span>
                  <span className="text-[11px] font-normal opacity-70">{ocupada ? "Ocupada" : "Libre"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ───────── COMANDA (mobile) ───────── */
  const productos = prods.filter((p) => p.category_id === catSel);
  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
        <button onClick={() => { setMesa(null); setComanda({}); }} className="rounded-full bg-muted px-3 py-1.5 text-sm">← Mesas</button>
        <strong className="truncate">{mesa.nombre}</strong>
        <span className="text-sm text-muted-foreground">{empleado.nombre}</span>
      </header>

      {/* Pills de categoría (scroll horizontal) */}
      <nav className="sticky top-[49px] z-10 flex gap-2 overflow-x-auto border-b border-border bg-card px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatSel(c.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${catSel === c.id ? "bg-brand text-brand-foreground" : "bg-muted text-foreground"}`}
          >
            {c.nombre}
          </button>
        ))}
      </nav>

      {/* Grid de productos */}
      <main className="flex-1 overflow-y-auto p-3 pb-24">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {productos.map((p) => {
            const q = comanda[p.id] ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className="relative rounded-xl border border-border bg-card p-3 text-left shadow-sm active:scale-95"
              >
                {q > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-bold text-brand-foreground">{q}</span>}
                <div className="font-medium leading-tight">{p.nombre}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-destructive">{eur(p.precio)}</div>
              </button>
            );
          })}
          {productos.length === 0 && <p className="col-span-full text-muted-foreground">Sin productos en esta categoría.</p>}
        </div>
      </main>

      {/* Carrito flotante */}
      {unidades > 0 && !carrito && (
        <button
          onClick={() => setCarrito(true)}
          className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-brand-foreground shadow-lg active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 font-semibold"><span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-foreground/20 px-1 text-sm">{unidades}</span> Ver comanda</span>
          <span className="font-bold tabular-nums">{eur(total)}</span>
        </button>
      )}

      {/* Hoja inferior con la comanda */}
      {carrito && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-foreground/40" onClick={() => setCarrito(false)}>
          <div className="max-h-[80%] rounded-t-2xl border-t border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Comanda · {mesa.nombre}</h2>
              <button onClick={() => setCarrito(false)} className="text-sm text-muted-foreground">Cerrar</button>
            </div>
            <div className="max-h-[40vh] space-y-1 overflow-y-auto">
              {Object.entries(comanda).map(([id, q]) => {
                const p = prods.find((x) => x.id === id)!;
                return (
                  <div key={id} className="flex items-center gap-2 py-1 text-sm">
                    <span className="flex-1 truncate">{p.nombre}</span>
                    <button onClick={() => sub(id)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-lg leading-none">−</button>
                    <span className="w-5 text-center tabular-nums">{q}</span>
                    <button onClick={() => add(id)} className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-lg leading-none">+</button>
                    <span className="w-16 text-right tabular-nums">{eur(p.precio * q)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-bold tabular-nums">
              <span>Total</span><span>{eur(total)}</span>
            </div>
            <button onClick={enviar} disabled={!unidades || enviando} className="mt-3 w-full rounded-2xl bg-brand py-3.5 text-base font-semibold text-brand-foreground disabled:opacity-50 active:scale-[0.99]">
              {enviando ? "Enviando…" : "Enviar a cocina"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
