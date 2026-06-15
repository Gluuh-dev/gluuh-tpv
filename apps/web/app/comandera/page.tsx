"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";

interface Empleado { id: string; nombre: string; rol: string }
interface Mesa { id: string; nombre: string; estado: string }
interface Cat { id: string; nombre: string; orden: number }
interface Prod { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null; disponible: boolean }

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
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: loc } = await sb.from("location").select("id").limit(1).maybeSingle();
      const lid = loc?.id ?? null;
      setLocationId(lid);
      const [{ data: m }, { data: c }, { data: p }] = await Promise.all([
        sb.from("restaurant_table").select("id,nombre,estado").order("nombre"),
        sb.from("category").select("id,nombre,orden").order("orden"),
        sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id,disponible").eq("disponible", true).order("nombre"),
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
        return { order_id: order.id, product_id: id, nombre: p.nombre, cantidad, precio_unitario: p.precio, tipo_impositivo: p.tipo_impositivo };
      });
      await sb.from("order_line").insert(lineas);
      await sb.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      setComanda({});
      setMesa(null);
    } finally {
      setEnviando(false);
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-900 text-slate-300">Cargando…</div>;

  // ---- PIN ----
  if (!empleado) {
    const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
    return (
      <div className="grid min-h-screen place-items-center bg-slate-900 p-6 text-white">
        <div className="w-full max-w-xs text-center">
          <h1 className="text-xl font-semibold">Comandera</h1>
          <p className="mb-4 text-sm text-slate-400">Introduce tu PIN</p>
          <div className="mb-4 flex justify-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-brand-500" : "bg-slate-700"}`} />
            ))}
          </div>
          {pinError && <p className="mb-2 text-sm text-red-400">{pinError}</p>}
          <div className="grid grid-cols-3 gap-3">
            {teclas.map((t) => (
              <button key={t}
                onClick={() => { if (t === "C") setPin(""); else if (t === "OK") comprobarPin(); else if (pin.length < 8) setPin(pin + t); }}
                className={`h-16 rounded-xl text-2xl font-semibold ${t === "OK" ? "bg-brand-600" : "bg-slate-800 hover:bg-slate-700"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- MESAS ----
  if (!mesa) {
    return (
      <div className="min-h-screen bg-slate-100">
        <header className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white">
          <strong>Mesas</strong>
          <span className="text-sm text-slate-300">{empleado.nombre} · <button className="underline" onClick={() => setEmpleado(null)}>cambiar</button></span>
        </header>
        <div className="p-5">
          {mesas.length === 0 && <div className="card text-slate-500">No hay mesas. Créalas en <b>Sala</b> (panel).</div>}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {mesas.map((m) => (
              <button key={m.id} onClick={() => setMesa(m)}
                className={`grid h-24 place-items-center rounded-2xl border-2 text-center font-semibold ${m.estado === "LIBRE" ? "border-slate-200 bg-white" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                {m.nombre}
                <span className="text-xs font-normal text-slate-400">{m.estado === "LIBRE" ? "Libre" : "Ocupada"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- COMANDA ----
  const productos = prods.filter((p) => p.category_id === catSel);
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white">
        <button onClick={() => { setMesa(null); setComanda({}); }} className="text-sm text-slate-300">← Mesas</button>
        <strong>{mesa.nombre}</strong>
        <span className="text-sm text-slate-300">{empleado.nombre}</span>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <div className="flex-1 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCatSel(c.id)} className={`rounded-full px-3 py-1.5 text-sm ${catSel === c.id ? "bg-brand-600 text-white" : "bg-white"}`}>{c.nombre}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productos.map((p) => (
              <button key={p.id} onClick={() => add(p.id)} className="rounded-xl border border-slate-200 bg-white p-3 text-left">
                <div className="font-medium">{p.nombre}</div>
                <div className="text-sm text-rose-600">{eur(p.precio)}</div>
              </button>
            ))}
            {productos.length === 0 && <p className="col-span-full text-slate-400">Sin productos en esta categoría.</p>}
          </div>
        </div>

        <aside className="flex w-full flex-col border-t border-slate-200 bg-white p-4 md:w-80 md:border-l md:border-t-0">
          <h2 className="mb-2 font-medium">Comanda</h2>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {unidades === 0 && <p className="text-slate-400">Toca productos para añadir.</p>}
            {Object.entries(comanda).map(([id, q]) => {
              const p = prods.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1">{p.nombre}</span>
                  <button onClick={() => sub(id)} className="h-7 w-7 rounded bg-slate-100">−</button>
                  <span className="w-5 text-center">{q}</span>
                  <button onClick={() => add(id)} className="h-7 w-7 rounded bg-slate-100">+</button>
                  <span className="w-16 text-right">{eur(p.precio * q)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>Total</span><span>{eur(total)}</span>
          </div>
          <button onClick={enviar} disabled={!unidades || enviando} className="btn-primary mt-3 w-full py-3 text-base disabled:opacity-50">
            {enviando ? "Enviando…" : "Enviar a cocina"}
          </button>
        </aside>
      </div>
    </div>
  );
}
