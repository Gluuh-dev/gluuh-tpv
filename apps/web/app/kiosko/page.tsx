"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Utensils, Plus, Minus, ArrowRight, Check } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

interface Cat { id: string; nombre: string }
interface Prod { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null }
type Paso = "inicio" | "carta" | "pago" | "ok";
const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Kiosko() {
  const sb = supabaseBrowser();
  const [estado, setEstado] = useState<"cargando" | "sin-sesion" | "ok">("cargando");
  const [empresa, setEmpresa] = useState("");
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [paso, setPaso] = useState<Paso>("inicio");
  const [tipoConsumo, setTipoConsumo] = useState<"LOCAL" | "PARA_LLEVAR">("LOCAL");
  const [catSel, setCatSel] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [numero, setNumero] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setEstado("sin-sesion"); return; }
      const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
      const [{ data: c }, { data: p }] = await Promise.all([
        sb.from("category").select("id,nombre,orden").order("orden"),
        sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id").eq("disponible", true).order("nombre"),
      ]);
      setEmpresa(t?.nombre ?? "");
      setCats((c as Cat[]) ?? []);
      setProds((p as Prod[]) ?? []);
      setCatSel((c as Cat[])?.[0]?.id ?? null);
      setEstado("ok");
    })();
    /* eslint-disable-next-line */
  }, []);

  const total = useMemo(() => Object.entries(carrito).reduce((s, [id, q]) => s + (prods.find((p) => p.id === id)?.precio ?? 0) * q, 0), [carrito, prods]);
  const unidades = Object.values(carrito).reduce((s, q) => s + q, 0);
  const add = (id: string) => setCarrito((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) => setCarrito((c) => { const n = (c[id] ?? 0) - 1; const { [id]: _, ...r } = c; return n > 0 ? { ...c, [id]: n } : r; });

  async function pagar() {
    setBusy(true);
    try {
      const items = Object.entries(carrito).map(([id, cantidad]) => { const p = prods.find((x) => x.id === id)!; return { product_id: id, nombre: p.nombre, cantidad, precio: p.precio, tipo: p.tipo_impositivo }; });
      const { data } = await sb.rpc("crear_pedido", { p_tipo_consumo: tipoConsumo, p_items: items });
      setNumero((data as { numero: number })?.numero ?? null);
      setPaso("ok");
    } finally { setBusy(false); }
  }
  function reiniciar() { setCarrito({}); setNumero(null); setTipoConsumo("LOCAL"); setPaso("inicio"); }

  if (estado === "cargando") return <div className="grid min-h-screen place-items-center bg-rose-600 text-white">Cargando…</div>;
  if (estado === "sin-sesion") return (
    <div className="grid min-h-screen place-items-center bg-rose-600 p-6 text-center text-white">
      <div><Utensils className="mx-auto h-12 w-12" /><h1 className="mt-3 text-2xl font-bold">Kiosko sin configurar</h1><p className="mt-2 opacity-90">Inicia sesión en este dispositivo con la cuenta del restaurante.</p><a href="/login" className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-rose-600">Iniciar sesión</a></div>
    </div>
  );

  if (paso === "inicio") return (
    <div className="grid min-h-screen place-items-center bg-rose-600 p-6 text-center text-white">
      <div>
        <div className="text-6xl">🍔</div>
        <h1 className="mt-4 text-4xl font-bold">{empresa || "Bienvenido"}</h1>
        <p className="mt-1 text-lg opacity-90">Haz tu pedido aquí</p>
        <div className="mt-10 flex flex-wrap justify-center gap-5">
          <button onClick={() => { setTipoConsumo("LOCAL"); setPaso("carta"); }} className="flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-3xl bg-white text-rose-600"><Utensils className="h-14 w-14" /><span className="text-2xl font-bold">Comer aquí</span></button>
          <button onClick={() => { setTipoConsumo("PARA_LLEVAR"); setPaso("carta"); }} className="flex h-48 w-48 flex-col items-center justify-center gap-3 rounded-3xl bg-white text-rose-600"><ShoppingBag className="h-14 w-14" /><span className="text-2xl font-bold">Para llevar</span></button>
        </div>
      </div>
    </div>
  );

  if (paso === "ok") return (
    <div className="grid min-h-screen place-items-center bg-emerald-600 p-6 text-center text-white">
      <div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white"><Check className="h-12 w-12 text-emerald-600" /></div>
        <h1 className="mt-5 text-3xl font-bold">¡Pedido confirmado!</h1>
        <p className="mt-2 text-lg">Tu número de pedido</p>
        <div className="text-8xl font-black leading-none">A-{numero}</div>
        <p className="mt-3 opacity-90">Recógelo cuando aparezca en pantalla.</p>
        <button onClick={reiniciar} className="mt-8 rounded-xl bg-white px-8 py-3 font-semibold text-emerald-700">Nuevo pedido</button>
      </div>
    </div>
  );

  if (paso === "pago") return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-6 text-center text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Pago</h1>
        <div className="my-3 text-6xl font-black">{eur(total)}</div>
        <p className="text-slate-400">{unidades} producto(s) · {tipoConsumo === "LOCAL" ? "Comer aquí" : "Para llevar"}</p>
        <p className="mb-6 mt-1 text-xs text-slate-500">(Pago simulado · integración real en docs/08)</p>
        <div className="grid gap-3">
          {["💳 Tarjeta", "📱 Bizum", "💶 Efectivo"].map((m) => <button key={m} onClick={pagar} disabled={busy} className="rounded-xl bg-amber-400 py-4 text-lg font-bold text-slate-900 disabled:opacity-50">{busy ? "Procesando…" : m}</button>)}
        </div>
        <button onClick={() => setPaso("carta")} className="mt-5 text-slate-400">← Volver</button>
      </div>
    </div>
  );

  const productos = prods.filter((p) => p.category_id === catSel);
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-rose-600 px-5 py-3 text-white">
        <strong className="text-lg">🍔 {empresa}</strong>
        <span className="text-sm">{tipoConsumo === "LOCAL" ? "🍽️ Comer aquí" : "🛍️ Para llevar"}</span>
      </header>
      <div className="grid flex-1 grid-cols-[150px_1fr_320px]">
        <nav className="flex flex-col overflow-y-auto border-r border-slate-200 bg-white">
          {cats.map((c) => <button key={c.id} onClick={() => setCatSel(c.id)} className={`border-b border-slate-100 px-3 py-4 text-left text-sm ${catSel === c.id ? "bg-rose-600 font-semibold text-white" : "hover:bg-slate-50"}`}>{c.nombre}</button>)}
        </nav>
        <section className="grid content-start gap-3 overflow-y-auto p-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
          {productos.map((p) => (
            <button key={p.id} onClick={() => add(p.id)} className="relative rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-4xl">🍽️</div>
              <div className="mt-1 font-medium leading-tight">{p.nombre}</div>
              <div className="font-bold text-rose-600">{eur(p.precio)}</div>
              {carrito[p.id] ? <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">{carrito[p.id]}</span> : null}
            </button>
          ))}
          {productos.length === 0 && <p className="col-span-full text-slate-400">Sin productos. Añade carta en el panel.</p>}
        </section>
        <aside className="flex flex-col border-l border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">Tu pedido</h2>
          <div className="flex-1 overflow-y-auto">
            {unidades === 0 && <p className="text-slate-400">Toca para añadir.</p>}
            {Object.entries(carrito).map(([id, q]) => { const p = prods.find((x) => x.id === id)!; return (
              <div key={id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="flex-1">{p.nombre}</span>
                <button onClick={() => sub(id)} className="grid h-7 w-7 place-items-center rounded bg-slate-100"><Minus className="h-3 w-3" /></button>
                <span className="w-5 text-center">{q}</span>
                <button onClick={() => add(id)} className="grid h-7 w-7 place-items-center rounded bg-slate-100"><Plus className="h-3 w-3" /></button>
                <span className="w-16 text-right">{eur(p.precio * q)}</span>
              </div>); })}
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-slate-900 pt-2 text-xl font-bold"><span>TOTAL</span><span>{eur(total)}</span></div>
          <button onClick={() => setPaso("pago")} disabled={!unidades} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-4 text-lg font-bold text-white disabled:opacity-40">Pagar <ArrowRight className="h-5 w-5" /></button>
        </aside>
      </div>
    </div>
  );
}
