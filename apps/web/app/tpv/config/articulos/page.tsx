"use client";

// MANTENIMIENTO DE ARTÍCULOS dentro del TPV (mockup gluuh-mantenimiento-articulos).
// Lista con búsqueda + ficha táctil de edición: nombre, texto del botón, precio,
// clase de IVA, categoría, zona de impresión, visible, al peso y nombres de
// ticket/cocina. Guarda directo en `product` (RLS por tenant).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Plus, Check } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { toast } from "@/app/lib/toast";
import { eur } from "@/app/lib/money";
import { CLASES_FISCALES, ivaAuto } from "@/lib/fiscal-clases";
import { NavbarTPV, NavChip } from "../../components/NavbarTPV";

interface Prod {
  id: string; nombre: string; precio: number; clase_fiscal: string | null; tipo_impositivo: number;
  category_id: string | null; estacion: string | null; foto_url: string | null; disponible: boolean;
  vendido_por_peso: boolean; texto_boton: string | null; nombre_ticket: string | null; nombre_cocina: string | null;
}
interface Cat { id: string; nombre: string }

const VACIO: Omit<Prod, "id"> = {
  nombre: "", precio: 0, clase_fiscal: "REDUCIDO", tipo_impositivo: 0, category_id: null,
  estacion: "COCINA", foto_url: null, disponible: true, vendido_por_peso: false,
  texto_boton: null, nombre_ticket: null, nombre_cocina: null,
};

export default function ArticulosTPV() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [lista, setLista] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [sel, setSel] = useState<Prod | null>(null);     // ficha abierta (copia editable)
  const [esAlta, setEsAlta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");

  async function cargar() {
    const [p, c, loc] = await Promise.all([
      sb.from("product").select("id,nombre,precio,clase_fiscal,tipo_impositivo,category_id,estacion,foto_url,disponible,vendido_por_peso,texto_boton,nombre_ticket,nombre_cocina").order("nombre"),
      sb.from("category").select("id,nombre").order("orden"),
      sb.from("location").select("territorio_fiscal").limit(1).maybeSingle(),
    ]);
    setLista((p.data as Prod[]) ?? []);
    setCats((c.data as Cat[]) ?? []);
    setTerritorio((loc.data as { territorio_fiscal?: string } | null)?.territorio_fiscal ?? "PENINSULA_BALEARES");
    setCargando(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lista.filter((p) => {
      if (catFiltro && p.category_id !== catFiltro) return false;
      if (t) return p.nombre.toLowerCase().includes(t);
      return true;
    });
  }, [lista, q, catFiltro]);

  async function guardar() {
    if (!sel) return;
    if (!sel.nombre.trim() || !(Number(sel.precio) >= 0)) { toast.error("Nombre y precio son obligatorios."); return; }
    setGuardando(true);
    try {
      const datos = {
        nombre: sel.nombre.trim(), precio: Number(sel.precio),
        // El % se resuelve por clase × territorio (regla fiscal del repo): al cambiar
        // la clase, el tipo se recalcula — nunca se guarda una clase con un % viejo.
        clase_fiscal: sel.clase_fiscal,
        tipo_impositivo: ivaAuto(sel.clase_fiscal ?? "REDUCIDO", territorio),
        category_id: sel.category_id,
        estacion: sel.estacion, disponible: sel.disponible, vendido_por_peso: sel.vendido_por_peso,
        texto_boton: sel.texto_boton?.trim() || null,
        nombre_ticket: sel.nombre_ticket?.trim() || null,
        nombre_cocina: sel.nombre_cocina?.trim() || null,
      };
      const { error } = esAlta
        ? await sb.from("product").insert(datos)
        : await sb.from("product").update(datos).eq("id", sel.id);
      if (error) { toast.error(error.message); return; }
      toast.success(`«${datos.nombre}» guardado.`);
      setSel(null); setEsAlta(false);
      await cargar();
    } finally { setGuardando(false); }
  }

  const nombreCat = (id: string | null) => cats.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <NavbarTPV operario="Configuración" subtitulo="Artículos">
        <h1 className="flex-none text-lg font-bold tracking-tight">Artículos</h1>
        <NavChip label="Total">{lista.length}</NavChip>
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/70" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artículo…"
            className="w-full rounded-md bg-white/15 py-2 pl-9 pr-3 text-[13px] text-brand-foreground outline-none placeholder:text-white/60 focus:bg-white/20" />
        </div>
        <button type="button" onClick={() => router.push("/tpv/config")}
          className="flex flex-none items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/25">
          <ArrowLeft size={16} /> Configuración
        </button>
      </NavbarTPV>

      <div className="flex flex-none items-center gap-2 border-b border-border bg-card px-3 py-1.5">
        <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="min-h-11 rounded-md border border-border bg-background px-2 text-sm outline-none">
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <span className="flex-1" />
        <button type="button" onClick={() => { setSel({ id: "", ...VACIO }); setEsAlta(true); }}
          className="flex min-h-11 items-center gap-1.5 rounded-md bg-brand px-4 text-sm font-bold text-white transition-all hover:bg-brand-hover active:scale-[.98]">
          <Plus size={16} /> Nuevo artículo
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 p-2.5 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* Lista (tabla plana) */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="flex flex-none items-center border-b border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Artículos <span className="ml-auto text-[11px] font-semibold normal-case tracking-normal">{filtrados.length}</span>
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cargando && <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>}
            {!cargando && filtrados.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sin artículos con ese filtro.</div>}
            <div className="divide-y divide-border">
              {filtrados.map((p) => (
                <button key={p.id} type="button" onClick={() => { setSel({ ...p }); setEsAlta(false); }}
                  className={`grid w-full grid-cols-[44px_1fr_120px_90px_70px] items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent ${sel?.id === p.id ? "bg-brand/5" : ""} ${p.disponible ? "" : "opacity-50"}`}>
                  {p.foto_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.foto_url} alt="" className="h-9 w-9 rounded object-cover" />
                    : <span className="grid h-9 w-9 place-items-center rounded bg-surface text-xs font-black text-muted-foreground">{p.nombre.slice(0, 2).toUpperCase()}</span>}
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{p.nombre}</span>
                    <span className="text-xs text-muted-foreground">{nombreCat(p.category_id)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{p.estacion === "NINGUNA" ? "No se imprime" : p.estacion ?? "—"}</span>
                  <span className={`text-center text-[10px] font-black uppercase ${p.disponible ? "text-success" : "text-muted-foreground"}`}>{p.disponible ? "Visible" : "Oculto"}</span>
                  <b className="text-right tabular-nums">{eur(Number(p.precio))}</b>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Ficha */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="flex-none border-b border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {esAlta ? "Nuevo artículo" : "Ficha"}
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!sel ? (
              <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">Elige un artículo de la lista o crea uno nuevo.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <input value={sel.nombre} onChange={(e) => setSel((s) => s && { ...s, nombre: e.target.value })} placeholder="Nombre *" className="min-h-12 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-brand" />
                <div className="grid grid-cols-[110px_1fr] gap-2.5">
                  <input inputMode="decimal" value={String(sel.precio)} onChange={(e) => setSel((s) => s && { ...s, precio: Number(e.target.value.replace(",", ".")) || 0 })} placeholder="Precio €" className="min-h-12 rounded-md border border-border bg-background px-3 text-right text-base font-bold tabular-nums outline-none focus:border-brand" />
                  <select value={sel.clase_fiscal ?? "REDUCIDO"} onChange={(e) => setSel((s) => s && { ...s, clase_fiscal: e.target.value })} className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                    {CLASES_FISCALES.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <select value={sel.category_id ?? ""} onChange={(e) => setSel((s) => s && { ...s, category_id: e.target.value || null })} className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                    <option value="">Sin categoría</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <select value={sel.estacion ?? "COCINA"} onChange={(e) => setSel((s) => s && { ...s, estacion: e.target.value })} className="min-h-12 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-brand">
                    <option value="COCINA">Cocina</option><option value="BARRA">Barra</option><option value="NINGUNA">No se imprime</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
                    <input type="checkbox" checked={sel.disponible} onChange={(e) => setSel((s) => s && { ...s, disponible: e.target.checked })} className="h-4 w-4 accent-(--brand)" />
                    <span className="font-semibold">Visible en el TPV</span>
                  </label>
                  <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
                    <input type="checkbox" checked={sel.vendido_por_peso} onChange={(e) => setSel((s) => s && { ...s, vendido_por_peso: e.target.checked })} className="h-4 w-4 accent-(--brand)" />
                    <span className="font-semibold">Se vende al peso</span>
                  </label>
                </div>
                <div className="rounded-md border border-border bg-surface p-2.5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Textos alternativos (opcional)</p>
                  <div className="flex flex-col gap-2">
                    <input value={sel.texto_boton ?? ""} onChange={(e) => setSel((s) => s && { ...s, texto_boton: e.target.value })} placeholder="Texto del botón del TPV" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                    <input value={sel.nombre_ticket ?? ""} onChange={(e) => setSel((s) => s && { ...s, nombre_ticket: e.target.value })} placeholder="Nombre en el ticket" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                    <input value={sel.nombre_cocina ?? ""} onChange={(e) => setSel((s) => s && { ...s, nombre_cocina: e.target.value })} placeholder="Nombre en cocina" className="min-h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setSel(null); setEsAlta(false); }} className="min-h-12 rounded-md border border-border bg-card px-4 text-sm font-semibold hover:bg-accent">Cancelar</button>
                  <span className="flex-1" />
                  <button type="button" disabled={guardando} onClick={() => { void guardar(); }}
                    className="flex min-h-12 items-center gap-2 rounded-md bg-brand px-6 text-sm font-bold text-white transition-all hover:bg-brand-hover active:scale-[.98] disabled:opacity-50">
                    <Check size={16} /> {guardando ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
