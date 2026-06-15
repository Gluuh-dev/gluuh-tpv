"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Plus, Trash2, GripVertical, Eye, EyeOff, Save, Image as ImageIcon } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { BRANDING_DEFAULT, subirMedia, textoSobre, type Branding } from "../../lib/branding";

interface Offer {
  id: string; titulo: string; descripcion: string | null; precio: string | null;
  media_tipo: "EMOJI" | "IMAGEN" | "VIDEO"; media_url: string | null; emoji: string | null;
  color: string; orden: number; activa: boolean;
}

export default function Personalizar() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState<string>("");
  const [marca, setMarca] = useState<Branding>(BRANDING_DEFAULT);
  const [ofertas, setOfertas] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("");
  const logoInput = useRef<HTMLInputElement>(null);

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    const tid = (t as { id: string } | null)?.id ?? "";
    setTenantId(tid);
    const [{ data: b }, { data: o }] = await Promise.all([
      sb.from("tenant_branding").select("*").eq("tenant_id", tid).maybeSingle(),
      sb.from("offer").select("*").order("orden"),
    ]);
    if (b) setMarca({ ...BRANDING_DEFAULT, ...b });
    setOfertas((o as Offer[]) ?? []);
  }

  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  function aviso(t: string) { setMsg(t); setTimeout(() => setMsg(""), 2500); }

  async function guardarMarca() {
    await sb.from("tenant_branding").upsert({ tenant_id: tenantId, ...marca, updated_at: new Date().toISOString() });
    aviso("Marca guardada ✓");
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !tenantId) return;
    try { const url = await subirMedia(sb, tenantId, f, "marca"); setMarca((m) => ({ ...m, logo_url: url })); aviso("Logo subido (recuerda Guardar)"); }
    catch (err) { aviso("Error subiendo logo"); console.error(err); }
  }

  async function addOferta() {
    const orden = (ofertas.at(-1)?.orden ?? 0) + 1;
    const { data } = await sb.from("offer").insert({ tenant_id: tenantId, titulo: "Nueva oferta", color: marca.color_primario, orden }).select("*").single();
    if (data) setOfertas((l) => [...l, data as Offer]);
  }

  function patch(id: string, p: Partial<Offer>) { setOfertas((l) => l.map((o) => (o.id === id ? { ...o, ...p } : o))); }

  async function guardarOferta(o: Offer) {
    const { id, ...rest } = o;
    await sb.from("offer").update(rest).eq("id", id);
    aviso("Oferta guardada ✓");
  }

  async function borrarOferta(id: string) {
    await sb.from("offer").delete().eq("id", id);
    setOfertas((l) => l.filter((o) => o.id !== id));
  }

  async function onMediaOferta(o: Offer, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !tenantId) return;
    const tipo = f.type.startsWith("video") ? "VIDEO" : "IMAGEN";
    try {
      const url = await subirMedia(sb, tenantId, f, "ofertas");
      patch(o.id, { media_url: url, media_tipo: tipo });
      await sb.from("offer").update({ media_url: url, media_tipo: tipo }).eq("id", o.id);
      aviso("Archivo subido ✓");
    } catch (err) { aviso("Error subiendo archivo"); console.error(err); }
  }

  if (loading) return <div className="text-slate-500">Cargando…</div>;
  const fg = textoSobre(marca.color_primario);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Personalización</h1>
          <p className="text-sm text-slate-500">Tu marca y tus ofertas, tal y como las verán tus clientes en kiosko, display y cartelería.</p>
        </div>
        {msg && <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">{msg}</span>}
      </div>

      {/* ---------- MARCA ---------- */}
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card space-y-4">
          <h2 className="font-medium">Marca</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nombre comercial</label><input className="input" value={marca.nombre_comercial ?? ""} onChange={(e) => setMarca({ ...marca, nombre_comercial: e.target.value })} placeholder="Mi Restaurante" /></div>
            <div>
              <label className="label">Logo</label>
              <div className="flex items-center gap-2">
                <button onClick={() => logoInput.current?.click()} className="btn-ghost"><Upload className="h-4 w-4" /> Subir</button>
                {marca.logo_url && <img src={marca.logo_url} alt="" className="h-9 w-9 rounded object-contain" />}
                {marca.logo_url && <button onClick={() => setMarca({ ...marca, logo_url: null })} className="text-xs text-red-600">Quitar</button>}
                <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </div>
            </div>
            <div><label className="label">Color principal</label><div className="flex items-center gap-2"><input type="color" value={marca.color_primario} onChange={(e) => setMarca({ ...marca, color_primario: e.target.value })} className="h-9 w-12 rounded border border-slate-200" /><input className="input" value={marca.color_primario} onChange={(e) => setMarca({ ...marca, color_primario: e.target.value })} /></div></div>
            <div><label className="label">Color secundario</label><div className="flex items-center gap-2"><input type="color" value={marca.color_secundario} onChange={(e) => setMarca({ ...marca, color_secundario: e.target.value })} className="h-9 w-12 rounded border border-slate-200" /><input className="input" value={marca.color_secundario} onChange={(e) => setMarca({ ...marca, color_secundario: e.target.value })} /></div></div>
            <div><label className="label">Título del kiosko</label><input className="input" value={marca.kiosko_titulo ?? ""} onChange={(e) => setMarca({ ...marca, kiosko_titulo: e.target.value })} placeholder="¡Bienvenido!" /></div>
            <div><label className="label">Subtítulo del kiosko</label><input className="input" value={marca.kiosko_subtitulo ?? ""} onChange={(e) => setMarca({ ...marca, kiosko_subtitulo: e.target.value })} placeholder="Haz tu pedido aquí" /></div>
          </div>
          <button onClick={guardarMarca} className="btn-primary"><Save className="h-4 w-4" /> Guardar marca</button>
        </div>

        {/* Vista previa kiosko */}
        <div>
          <div className="label mb-1">Vista previa del kiosko</div>
          <div className="grid h-[320px] place-items-center rounded-2xl p-6 text-center shadow-inner" style={{ background: marca.color_primario, color: fg }}>
            <div>
              {marca.logo_url ? <img src={marca.logo_url} alt="" className="mx-auto h-16 w-auto object-contain" /> : <div className="text-5xl">🍔</div>}
              <div className="mt-3 text-2xl font-bold">{marca.kiosko_titulo || marca.nombre_comercial || "Bienvenido"}</div>
              <div className="text-sm opacity-90">{marca.kiosko_subtitulo || "Haz tu pedido aquí"}</div>
              <div className="mt-4 flex justify-center gap-2">
                <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold" style={{ color: marca.color_primario }}>Comer aquí</span>
                <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold" style={{ color: marca.color_primario }}>Para llevar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- OFERTAS ---------- */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="font-medium">Ofertas / cartelería</h2><p className="text-sm text-slate-500">Se muestran en bucle en la pantalla de <code>/ofertas</code>. Sube imagen o vídeo a pantalla completa, o usa un emoji.</p></div>
          <button onClick={addOferta} className="btn-primary"><Plus className="h-4 w-4" /> Nueva oferta</button>
        </div>

        {ofertas.length === 0 && <p className="py-6 text-center text-slate-400">Aún no hay ofertas. Crea la primera.</p>}

        <div className="space-y-4">
          {ofertas.map((o) => (
            <div key={o.id} className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[110px_1fr_auto]">
              {/* Preview */}
              <div className="grid h-28 w-full place-items-center overflow-hidden rounded-lg" style={{ background: o.color }}>
                {o.media_tipo === "IMAGEN" && o.media_url ? <img src={o.media_url} alt="" className="h-full w-full object-cover" />
                  : o.media_tipo === "VIDEO" && o.media_url ? <video src={o.media_url} muted className="h-full w-full object-cover" />
                  : <span className="text-5xl">{o.emoji || "🍔"}</span>}
              </div>

              {/* Campos */}
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input" placeholder="Título" value={o.titulo} onChange={(e) => patch(o.id, { titulo: e.target.value })} />
                <input className="input" placeholder="Precio (ej. 9,90 €)" value={o.precio ?? ""} onChange={(e) => patch(o.id, { precio: e.target.value })} />
                <input className="input sm:col-span-2" placeholder="Descripción" value={o.descripcion ?? ""} onChange={(e) => patch(o.id, { descripcion: e.target.value })} />
                <select className="input" value={o.media_tipo} onChange={(e) => patch(o.id, { media_tipo: e.target.value as Offer["media_tipo"] })}>
                  <option value="EMOJI">Emoji</option><option value="IMAGEN">Imagen</option><option value="VIDEO">Vídeo</option>
                </select>
                {o.media_tipo === "EMOJI"
                  ? <input className="input" placeholder="Emoji 🍔" value={o.emoji ?? ""} onChange={(e) => patch(o.id, { emoji: e.target.value })} />
                  : <label className="btn-ghost cursor-pointer justify-center"><ImageIcon className="h-4 w-4" /> {o.media_url ? "Cambiar archivo" : "Subir archivo"}<input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onMediaOferta(o, e)} /></label>}
                <div className="flex items-center gap-2"><span className="text-xs text-slate-500">Color</span><input type="color" value={o.color} onChange={(e) => patch(o.id, { color: e.target.value })} className="h-8 w-10 rounded border border-slate-200" /></div>
                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-slate-300" /><span className="text-xs text-slate-500">Orden</span><input type="number" className="input w-20" value={o.orden} onChange={(e) => patch(o.id, { orden: Number(e.target.value) })} /></div>
              </div>

              {/* Acciones */}
              <div className="flex flex-row gap-2 lg:flex-col">
                <button onClick={() => patch(o.id, { activa: !o.activa })} title={o.activa ? "Activa" : "Oculta"} className={`btn-ghost ${o.activa ? "text-emerald-600" : "text-slate-400"}`}>{o.activa ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button onClick={() => guardarOferta(o)} className="btn-primary"><Save className="h-4 w-4" /></button>
                <button onClick={() => borrarOferta(o.id)} className="btn-ghost text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
