"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { BRANDING_DEFAULT, leerBranding, type Branding } from "../lib/branding";
import type { EstadoPrep } from "../lib/estados";

interface Pedido { id: string; numero_pedido: number | null; estado_preparacion: EstadoPrep }

/**
 * Display para el cliente (pantalla grande del local), estilo fast-food.
 * Autenticado: muestra SOLO los pedidos de la empresa de la sesión (RLS) y
 * se actualiza en tiempo real con Supabase Realtime.
 */
export default function PantallaCliente() {
  const sb = supabaseBrowser();
  const [estado, setEstado] = useState<"cargando" | "sin-sesion" | "ok">("cargando");
  const [brand, setBrand] = useState<Branding>(BRANDING_DEFAULT);
  const [empresa, setEmpresa] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from("sales_order")
      .select("id,numero_pedido,estado_preparacion")
      .eq("estado", "ENVIADA_COCINA")
      .neq("estado_preparacion", "ENTREGADO")
      .not("numero_pedido", "is", null)
      .order("numero_pedido", { ascending: true });
    setPedidos((data as Pedido[]) ?? []);
  }, [sb]);

  useEffect(() => {
    let ch: ReturnType<typeof sb.channel> | undefined;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setEstado("sin-sesion"); return; }
      const [{ data: t }, b] = await Promise.all([sb.from("tenant").select("nombre").limit(1).maybeSingle(), leerBranding(sb)]);
      setBrand(b);
      setEmpresa(b.nombre_comercial || t?.nombre || "");
      await cargar();
      setEstado("ok");
      ch = sb.channel("pantalla").on("postgres_changes", { event: "*", schema: "public", table: "sales_order" }, () => cargar()).subscribe();
    })();
    return () => { if (ch) sb.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, []);

  if (estado === "cargando") return <div className="grid min-h-screen place-items-center bg-slate-950 text-white">Cargando…</div>;
  if (estado === "sin-sesion") return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white">
      <div><h1 className="text-2xl font-bold">Pantalla sin configurar</h1><p className="mt-2 text-slate-400">Inicia sesión con la cuenta del restaurante.</p><a href="/login" className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-slate-900">Iniciar sesión</a></div>
    </div>
  );

  const preparando = pedidos.filter((p) => p.estado_preparacion === "PENDIENTE" || p.estado_preparacion === "EN_PREPARACION");
  const listos = pedidos.filter((p) => p.estado_preparacion === "LISTO");

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-center gap-3 py-6 text-center" style={{ background: brand.color_secundario }}>
        {brand.logo_url && <img src={brand.logo_url} alt="" className="h-10 w-auto object-contain" />}
        <span className="text-3xl font-extrabold tracking-tight">{empresa || "Estado de tu pedido"}</span>
      </header>
      <div className="grid flex-1 grid-cols-2">
        <section className="flex flex-col items-center p-8">
          <h2 className="mb-6 text-3xl font-bold text-amber-400">⏳ En preparación</h2>
          <div className="flex flex-wrap justify-center gap-5">
            {preparando.length === 0 && <span className="text-5xl text-slate-700">—</span>}
            {preparando.map((p) => (
              <div key={p.id} className="grid h-28 w-36 place-items-center rounded-2xl border-2 border-amber-500/40 bg-slate-900 text-5xl font-black text-amber-400">A-{p.numero_pedido}</div>
            ))}
          </div>
        </section>
        <section className="flex flex-col items-center border-l-2 border-slate-800 p-8">
          <h2 className="mb-6 text-3xl font-bold text-emerald-400">✅ Listos para recoger</h2>
          <div className="flex flex-wrap justify-center gap-5">
            {listos.length === 0 && <span className="text-5xl text-slate-700">—</span>}
            {listos.map((p) => (
              <div key={p.id} className="grid h-28 w-36 animate-pulse place-items-center rounded-2xl bg-emerald-600 text-5xl font-black text-white">A-{p.numero_pedido}</div>
            ))}
          </div>
        </section>
      </div>
      <footer className="py-3 text-center text-sm text-slate-500">Actualización en tiempo real · {empresa}</footer>
    </main>
  );
}
