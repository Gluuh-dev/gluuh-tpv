"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { subirMedia } from "@/app/lib/branding";
import { ESTACIONES, ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";
import { ALERGENOS } from "@/lib/alergenos";
import { CLASES_FISCALES, ivaAuto, nombreImpuesto } from "@/lib/fiscal-clases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Categoria { id: string; nombre: string; estacion: string | null }
type Grupo = { id: string; nombre: string; min_sel: number; max_sel: number; opciones: { id: string; nombre: string; precio_extra: number }[] };

const SIN_CAT = "__sincat__";

// Plantillas rápidas de formatos habituales (mismas que producto-dialog): crean a precio 0.
const PLANTILLAS_FORMATO: { t: string; nombres: string[] }[] = [
  { t: "Caña/Tubo/Tercio", nombres: ["Caña", "Tubo", "Tercio"] },
  { t: "Copa/Botella", nombres: ["Copa", "Botella"] },
  { t: "Media/Entera", nombres: ["Media", "Entera"] },
  { t: "1/3 / 1/5", nombres: ["1/3", "1/5"] },
];

export default function ProductoEditar() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const esNuevo = id === "nuevo";

  const [cargando, setCargando] = useState(true);
  const [noExiste, setNoExiste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");
  const [cats, setCats] = useState<Categoria[]>([]);

  // Básico
  const [nombre, setNombre] = useState("");
  const [categoryId, setCategoryId] = useState<string>(SIN_CAT);
  const [precio, setPrecio] = useState("");
  const [clase, setClase] = useState("REDUCIDO");
  const [alcohol, setAlcohol] = useState(false);
  const [estacion, setEstacion] = useState<string>("COCINA");
  const [estacionHeredada, setEstacionHeredada] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [vendidoPorPeso, setVendidoPorPeso] = useState(false);

  // Ficha
  const [descripcion, setDescripcion] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [alergenos, setAlergenos] = useState<string[]>([]);

  // Nombres de impresión (0051). null = migración sin aplicar → sección oculta.
  const [nombres, setNombres] = useState<{ ticket: string; cocina: string } | null>(null);

  // Formatos / añadidos (solo edición).
  const [formatos, setFormatos] = useState<{ id: string; nombre: string; precio: number }[]>([]);
  const [nuevoFmt, setNuevoFmt] = useState({ nombre: "", precio: "" });
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: "", min: "0", max: "1" });
  const [nuevaOpcion, setNuevaOpcion] = useState<Record<string, { nombre: string; precio: string }>>({});

  const ivaPrev = ivaAuto(clase, territorio);

  async function cargarFormatos() {
    const { data } = await sb.from("product_format").select("id,nombre,precio").eq("product_id", id).order("orden");
    setFormatos((data as { id: string; nombre: string; precio: number }[]) ?? []);
  }
  async function cargarModificadores() {
    const { data: gs } = await sb.from("modifier_group").select("id,nombre,min_sel,max_sel").eq("product_id", id);
    const base = (gs as { id: string; nombre: string; min_sel: number; max_sel: number }[]) ?? [];
    const conOpc = await Promise.all(base.map(async (g) => {
      const { data: ops } = await sb.from("modifier").select("id,nombre,precio_extra").eq("modifier_group_id", g.id);
      return { ...g, opciones: (ops as { id: string; nombre: string; precio_extra: number }[]) ?? [] };
    }));
    setGrupos(conOpc);
  }

  useEffect(() => {
    (async () => {
      const [{ data: loc }, catsRes, { data: t }] = await Promise.all([
        sb.from("location").select("territorio_fiscal").limit(1).maybeSingle(),
        sb.from("category").select("id,nombre,estacion").order("orden"),
        sb.from("tenant").select("id").limit(1).maybeSingle(),
      ]);
      if (loc?.territorio_fiscal) setTerritorio(loc.territorio_fiscal);
      setTenantId((t as { id: string } | null)?.id ?? "");
      // Degradación 0050: si category.estacion no existe, recarga sin ella.
      if (catsRes.error) {
        const { data: c } = await sb.from("category").select("id,nombre").order("orden");
        setCats(((c as Omit<Categoria, "estacion">[]) ?? []).map((x) => ({ ...x, estacion: null })));
      } else {
        setCats((catsRes.data as Categoria[]) ?? []);
      }

      if (esNuevo) {
        // Probe 0051: ¿existe la columna de nombres de impresión?
        const { error } = await sb.from("product").select("nombre_ticket").limit(1);
        setNombres(error ? null : { ticket: "", cocina: "" });
        setCargando(false);
        return;
      }

      const [pr, nr] = await Promise.all([
        sb.from("product")
          .select("nombre,precio,clase_fiscal,category_id,es_alcohol,estacion,disponible,vendido_por_peso,descripcion,codigo_barras,foto_url,alergenos")
          .eq("id", id).maybeSingle(),
        sb.from("product").select("nombre_ticket,nombre_cocina").eq("id", id).maybeSingle(),
      ]);
      const p = pr.data as {
        nombre: string; precio: number; clase_fiscal: string | null; category_id: string | null;
        es_alcohol: boolean; estacion: string | null; disponible: boolean; vendido_por_peso: boolean;
        descripcion: string | null; codigo_barras: string | null; foto_url: string | null; alergenos: string[] | null;
      } | null;
      if (!p) { setNoExiste(true); setCargando(false); return; }

      setNombre(p.nombre);
      setPrecio(Number(p.precio).toFixed(2));
      setClase(p.clase_fiscal ?? "REDUCIDO");
      setCategoryId(p.category_id ?? SIN_CAT);
      setAlcohol(p.es_alcohol);
      setDisponible(p.disponible);
      setVendidoPorPeso(p.vendido_por_peso);
      setDescripcion(p.descripcion ?? "");
      setCodigoBarras(p.codigo_barras ?? "");
      setFotoUrl(p.foto_url ?? "");
      setAlergenos(p.alergenos ?? []);

      // Estación: si el producto no tiene, hereda la de su categoría.
      let est = p.estacion ?? null;
      let heredada = false;
      if (!est && p.category_id) {
        const cat = (catsRes.error ? null : (catsRes.data as Categoria[] | null)?.find((c) => c.id === p.category_id)) ?? null;
        if (cat?.estacion && (ESTACIONES as readonly string[]).includes(cat.estacion)) { est = cat.estacion; heredada = true; }
      }
      setEstacion(estacionDe(est));
      setEstacionHeredada(heredada);

      if (nr.error) setNombres(null);
      else {
        const n = nr.data as { nombre_ticket?: string | null; nombre_cocina?: string | null } | null;
        setNombres({ ticket: n?.nombre_ticket ?? "", cocina: n?.nombre_cocina ?? "" });
      }

      await cargarFormatos();
      await cargarModificadores();
      setCargando(false);
    })();
    /* eslint-disable-next-line */
  }, [id]);

  // Al elegir categoría, aplica su estación por defecto (si la tiene).
  function cambiarCategoria(v: string) {
    setCategoryId(v);
    const est = cats.find((c) => c.id === v)?.estacion;
    if (est && (ESTACIONES as readonly string[]).includes(est)) { setEstacion(est); setEstacionHeredada(false); }
  }
  // Alcohol → clase General + estación Barra (bebida), como en la carta.
  function setAlcoholOn(on: boolean) {
    setAlcohol(on);
    if (on) { setClase("GENERAL"); setEstacion("BARRA"); setEstacionHeredada(false); }
  }
  function toggleAlergeno(v: string) {
    setAlergenos((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }
  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tenantId) return;
    try { setFotoUrl(""); setFotoUrl(await subirMedia(sb, tenantId, file, "productos")); }
    catch (err) { toast.error(`No se pudo subir la foto: ${err instanceof Error ? err.message : err}`); }
  }

  // ── Formatos ──────────────────────────────────────────────────────────
  async function addFormato() {
    const p = Number(nuevoFmt.precio.replace(",", "."));
    if (!nuevoFmt.nombre.trim() || !p) return;
    await sb.from("product_format").insert({ tenant_id: tenantId, product_id: id, nombre: nuevoFmt.nombre.trim(), precio: p, orden: formatos.length });
    setNuevoFmt({ nombre: "", precio: "" });
    await cargarFormatos();
  }
  async function delFormato(fid: string) { await sb.from("product_format").delete().eq("id", fid); await cargarFormatos(); }
  async function aplicarPlantilla(nombresFmt: string[]) {
    const existentes = new Set(formatos.map((ft) => ft.nombre.toLowerCase()));
    const nuevos = nombresFmt.filter((n) => !existentes.has(n.toLowerCase()));
    if (!nuevos.length) return;
    await sb.from("product_format").insert(nuevos.map((nombre, i) => ({ tenant_id: tenantId, product_id: id, nombre, precio: 0, orden: formatos.length + i })));
    await cargarFormatos();
    toast.success("Formatos creados: pon los precios en la lista");
  }
  async function guardarPrecioFormato(fid: string, texto: string, anterior: number) {
    const v = Number(texto.replace(",", "."));
    if (!Number.isFinite(v) || v < 0 || v === Number(anterior)) return;
    await sb.from("product_format").update({ precio: v }).eq("id", fid);
    await cargarFormatos();
  }

  // ── Añadidos (grupos + opciones) ──────────────────────────────────────
  async function addGrupo() {
    if (!nuevoGrupo.nombre.trim() || !tenantId) return;
    await sb.from("modifier_group").insert({ tenant_id: tenantId, product_id: id, nombre: nuevoGrupo.nombre.trim(), min_sel: Number(nuevoGrupo.min) || 0, max_sel: Number(nuevoGrupo.max) || 1 });
    setNuevoGrupo({ nombre: "", min: "0", max: "1" });
    await cargarModificadores();
  }
  async function delGrupo(gid: string) { await sb.from("modifier_group").delete().eq("id", gid); await cargarModificadores(); }
  async function addOpcion(grupoId: string) {
    const o = nuevaOpcion[grupoId]; if (!o?.nombre.trim() || !tenantId) return;
    await sb.from("modifier").insert({ tenant_id: tenantId, modifier_group_id: grupoId, nombre: o.nombre.trim(), precio_extra: Number(o.precio.replace(",", ".")) || 0 });
    setNuevaOpcion((s) => ({ ...s, [grupoId]: { nombre: "", precio: "" } }));
    await cargarModificadores();
  }
  async function delOpcion(oid: string) { await sb.from("modifier").delete().eq("id", oid); await cargarModificadores(); }

  // ── Copiar de otro producto (formatos / añadidos) ─────────────────────
  // Misma lógica de clonado que components/producto-dialog.tsx, adaptada a esta
  // página: usa `id` como producto destino y añade tenant_id explícito también
  // en product_format (aquí lo exige la RLS). No borra lo existente: añade encima.
  const [copiarAbierto, setCopiarAbierto] = useState(false);
  const [candidatos, setCandidatos] = useState<{ id: string; nombre: string }[]>([]);
  const [copia, setCopia] = useState({ origen: "", fmts: true, mods: true, busy: false });

  async function abrirCopiar() {
    setCopiarAbierto(true);
    const [{ data: pf }, { data: mg }] = await Promise.all([
      sb.from("product_format").select("product_id"),
      sb.from("modifier_group").select("product_id"),
    ]);
    const conAlgo = [...((pf as { product_id: string }[]) ?? []), ...((mg as { product_id: string }[]) ?? [])];
    const ids = [...new Set(conAlgo.map((r) => r.product_id))].filter((pid) => pid !== id);
    if (!ids.length) { setCandidatos([]); return; }
    const { data: ps } = await sb.from("product").select("id,nombre").in("id", ids).order("nombre");
    setCandidatos((ps as { id: string; nombre: string }[]) ?? []);
  }

  async function copiarDesde() {
    if (!copia.origen || (!copia.fmts && !copia.mods)) return;
    setCopia((s) => ({ ...s, busy: true }));
    try {
      if (copia.fmts) {
        const { data } = await sb.from("product_format").select("nombre,precio").eq("product_id", copia.origen).order("orden");
        const filas = ((data as { nombre: string; precio: number }[]) ?? [])
          .map((ft, i) => ({ tenant_id: tenantId, product_id: id, nombre: ft.nombre, precio: ft.precio, orden: formatos.length + i }));
        if (filas.length) { const { error } = await sb.from("product_format").insert(filas); if (error) throw error; }
      }
      if (copia.mods) {
        const { data: gs } = await sb.from("modifier_group").select("id,nombre,min_sel,max_sel").eq("product_id", copia.origen);
        for (const g of (gs as { id: string; nombre: string; min_sel: number; max_sel: number }[]) ?? []) {
          const { data: nuevo, error: eg } = await sb.from("modifier_group")
            .insert({ tenant_id: tenantId, product_id: id, nombre: g.nombre, min_sel: g.min_sel, max_sel: g.max_sel })
            .select("id").single();
          if (eg) throw eg;
          if (!nuevo) continue;
          const { data: ops } = await sb.from("modifier").select("nombre,precio_extra").eq("modifier_group_id", g.id);
          const filas = ((ops as { nombre: string; precio_extra: number }[]) ?? [])
            .map((o) => ({ tenant_id: tenantId, modifier_group_id: (nuevo as { id: string }).id, nombre: o.nombre, precio_extra: o.precio_extra }));
          if (filas.length) { const { error: eo } = await sb.from("modifier").insert(filas); if (eo) throw eo; }
        }
      }
      await cargarFormatos();
      await cargarModificadores();
      setCopiarAbierto(false);
      setCopia({ origen: "", fmts: true, mods: true, busy: false });
      toast.success("Copiado");
    } catch (e) {
      setCopia((s) => ({ ...s, busy: false }));
      toast.error(`No se pudo copiar: ${e instanceof Error ? e.message : e}`);
    }
  }

  // ── Guardar / eliminar ────────────────────────────────────────────────
  async function guardar() {
    if (!nombre.trim() || !precio) { toast.error("El nombre y el precio son obligatorios"); return; }
    setBusy(true);
    const base: Record<string, unknown> = {
      nombre: nombre.trim(),
      precio: Number(precio.replace(",", ".")),
      clase_fiscal: clase,
      tipo_impositivo: ivaAuto(clase, territorio),
      category_id: categoryId === SIN_CAT ? null : categoryId,
      es_alcohol: alcohol,
      estacion,
      disponible,
      vendido_por_peso: vendidoPorPeso,
      descripcion: descripcion.trim() || null,
      codigo_barras: codigoBarras.trim() || null,
      foto_url: fotoUrl || null,
      alergenos,
    };
    if (nombres) {
      base.nombre_ticket = nombres.ticket.trim() || null;
      base.nombre_cocina = nombres.cocina.trim() || null;
    }
    try {
      if (esNuevo) {
        const { error } = await sb.from("product").insert(tenantId ? { ...base, tenant_id: tenantId } : base);
        if (error) throw error;
      } else {
        const { error } = await sb.from("product").update(base).eq("id", id);
        if (error) throw error;
      }
      toast.success("Producto guardado");
      router.push("/productos");
    } catch (e) {
      setBusy(false);
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
    }
  }
  async function eliminar() {
    if (!confirm("¿Eliminar este producto? No se puede deshacer.")) return;
    const { error } = await sb.from("product").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Producto eliminado");
    router.push("/productos");
  }

  if (cargando) return <div className="mx-auto max-w-3xl"><p className="text-sm text-muted-foreground">Cargando…</p></div>;
  if (noExiste) return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button onClick={() => router.push("/productos")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Productos</button>
      <p className="text-sm">Este producto no existe o no tienes acceso.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push("/productos")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Productos
        </button>
        {!esNuevo && (
          <Button variant="destructive" size="sm" onClick={eliminar}><Trash2 className="h-4 w-4" /> Eliminar</Button>
        )}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{esNuevo ? "Nuevo producto" : nombre || "Producto"}</h1>

      {/* ── Básico ───────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Básico</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={cambiarCategoria}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CAT}>Sin categoría</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Precio (impuesto incluido)</Label>
            <Input inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0,00" />
            {vendidoPorPeso && <p className="text-xs text-muted-foreground">Es el precio por kilo (€/kg).</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Clase fiscal</Label>
            <Select value={clase} onValueChange={(v) => setClase(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{CLASES_FISCALES.map((c) => <SelectItem key={c.v} value={c.v}>{c.t}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{nombreImpuesto(territorio)} automático: <b>{ivaPrev}%</b></p>
          </div>
          <div className="space-y-1.5">
            <Label>Estación de preparación</Label>
            <Select value={estacion} onValueChange={(v) => { setEstacion(v); setEstacionHeredada(false); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{ESTACIONES.map((s) => <SelectItem key={s} value={s}>{ESTACION_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            {estacionHeredada && <p className="text-xs text-muted-foreground">Heredada de la categoría (se fijará al guardar).</p>}
          </div>
          <div className="flex flex-col justify-end gap-3 sm:col-span-2">
            <div className="flex items-center gap-2 text-sm">
              <Switch id="p-alcohol" checked={alcohol} onCheckedChange={setAlcoholOn} aria-label="Alcohol" />
              <label htmlFor="p-alcohol">Alcohol (fuerza clase General y estación Barra)</label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Switch id="p-disponible" checked={disponible} onCheckedChange={setDisponible} aria-label="Disponible" />
              <label htmlFor="p-disponible">Disponible (visible y a la venta)</label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Switch id="p-peso" checked={vendidoPorPeso} onCheckedChange={setVendidoPorPeso} aria-label="Vendido por peso" />
              <label htmlFor="p-peso">Vendido por peso (el precio es €/kg; al vender se teclea el peso)</label>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Ficha ────────────────────────────────────────────────── */}
      <Card className="p-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Ficha</h2>
        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para carta y kiosko" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Código de barras</Label>
            <Input value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Foto</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" /> Subir<input type="file" accept="image/*" className="hidden" onChange={onFoto} />
              </label>
              {fotoUrl && <img src={fotoUrl} alt="" className="h-9 w-9 rounded object-cover" />}
            </div>
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">Alérgenos</Label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {ALERGENOS.map((a) => (
              <label key={a.v} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={alergenos.includes(a.v)} onChange={() => toggleAlergeno(a.v)} /> {a.t}
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Nombres de impresión (0051) ──────────────────────────── */}
      {nombres && (
        <Card className="p-4">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Nombres de impresión</h2>
            <p className="mt-1 text-xs text-muted-foreground">Cómo sale este artículo impreso. Vacío = igual que el nombre.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">En ticket y factura</Label>
              <Input value={nombres.ticket} onChange={(e) => setNombres({ ...nombres, ticket: e.target.value })} placeholder={nombre || "Nombre del producto"} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">En cocina y comandas</Label>
              <Input value={nombres.cocina} onChange={(e) => setNombres({ ...nombres, cocina: e.target.value })} placeholder={nombre || "Nombre del producto"} />
            </div>
          </div>
        </Card>
      )}

      {/* ── Copiar de otro producto (solo edición) ───────────────── */}
      {!esNuevo && (
        <Card className="p-4">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Copiar de otro producto</h2>
            <p className="mt-1 text-xs text-muted-foreground">Clona formatos y/o añadidos de otro artículo. Se añaden a los que ya tiene este producto (no reemplaza nada).</p>
          </div>
          {!copiarAbierto ? (
            <Button type="button" variant="outline" size="sm" onClick={abrirCopiar}>Copiar de otro producto…</Button>
          ) : (
            <div className="space-y-3">
              <Select value={copia.origen} onValueChange={(v) => setCopia((s) => ({ ...s, origen: v }))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Elige el producto de origen" /></SelectTrigger>
                <SelectContent>
                  {candidatos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {candidatos.length === 0 && <p className="text-xs text-muted-foreground">Ningún otro producto tiene formatos o añadidos que copiar.</p>}
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={copia.fmts} onChange={(e) => setCopia((s) => ({ ...s, fmts: e.target.checked }))} /> Formatos</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={copia.mods} onChange={(e) => setCopia((s) => ({ ...s, mods: e.target.checked }))} /> Añadidos</label>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={copiarDesde} disabled={copia.busy || !copia.origen || (!copia.fmts && !copia.mods)}>{copia.busy ? "Copiando…" : "Copiar"}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCopiarAbierto(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Formatos (solo edición: necesitan product_id) ────────── */}
      <Card className="p-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Formatos de venta</h2>
          <p className="mt-1 text-xs text-muted-foreground">Caña/copa/botella, ración/media… Si añades formatos, en el TPV se elige uno al vender (el precio base se ignora).</p>
        </div>
        {esNuevo ? (
          <p className="text-sm text-muted-foreground">Guarda el producto para poder añadir formatos.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {PLANTILLAS_FORMATO.map((pl) => (
                <button
                  key={pl.t}
                  type="button"
                  onClick={() => aplicarPlantilla(pl.nombres)}
                  title={`Crea los formatos ${pl.nombres.join(", ")} a precio 0`}
                  className="rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  + {pl.t}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {formatos.map((ft) => (
                <div key={ft.id} className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm">
                  <span className="flex-1">{ft.nombre}</span>
                  <Input
                    key={`${ft.id}-${ft.precio}`}
                    className="h-8 w-24 text-right tabular-nums"
                    inputMode="decimal"
                    aria-label={`Precio de ${ft.nombre}`}
                    defaultValue={Number(ft.precio).toFixed(2)}
                    onBlur={(e) => guardarPrecioFormato(ft.id, e.target.value, ft.precio)}
                  />
                  <span className="text-muted-foreground">€</span>
                  <button type="button" onClick={() => delFormato(ft.id)} className="text-destructive hover:underline">Quitar</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={nuevoFmt.nombre} onChange={(e) => setNuevoFmt((s) => ({ ...s, nombre: e.target.value }))} placeholder="Formato (Caña…)" />
              <Input className="w-24" inputMode="decimal" value={nuevoFmt.precio} onChange={(e) => setNuevoFmt((s) => ({ ...s, precio: e.target.value }))} placeholder="€" />
              <Button type="button" variant="outline" onClick={addFormato} disabled={!nuevoFmt.nombre.trim() || !nuevoFmt.precio}>Añadir</Button>
            </div>
          </>
        )}
      </Card>

      {/* ── Añadidos (solo edición) ──────────────────────────────── */}
      <Card className="p-4">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Añadidos</h2>
          <p className="mt-1 text-xs text-muted-foreground">Grupos de opciones (punto de la carne, extras…). En el TPV se eligen al vender; los extras suman al precio.</p>
        </div>
        {esNuevo ? (
          <p className="text-sm text-muted-foreground">Guarda el producto para poder añadir grupos de opciones.</p>
        ) : (
          <>
            <div className="space-y-3">
              {grupos.map((g) => (
                <div key={g.id} className="rounded-md border border-input p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium">{g.nombre} <span className="text-xs text-muted-foreground">({g.min_sel}–{g.max_sel})</span></span>
                    <button type="button" onClick={() => delGrupo(g.id)} className="text-xs text-destructive hover:underline">Quitar grupo</button>
                  </div>
                  <div className="space-y-1">
                    {g.opciones.map((op) => (
                      <div key={op.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{op.nombre}</span>
                        <span className="tabular-nums text-muted-foreground">{op.precio_extra > 0 ? `+${Number(op.precio_extra).toFixed(2)} €` : "—"}</span>
                        <button type="button" onClick={() => delOpcion(op.id)} className="text-xs text-destructive hover:underline">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <Input className="h-8" value={nuevaOpcion[g.id]?.nombre ?? ""} onChange={(e) => setNuevaOpcion((s) => ({ ...s, [g.id]: { nombre: e.target.value, precio: s[g.id]?.precio ?? "" } }))} placeholder="Opción (Bacon…)" />
                    <Input className="h-8 w-20" inputMode="decimal" value={nuevaOpcion[g.id]?.precio ?? ""} onChange={(e) => setNuevaOpcion((s) => ({ ...s, [g.id]: { nombre: s[g.id]?.nombre ?? "", precio: e.target.value } }))} placeholder="+€" />
                    <Button type="button" size="sm" variant="outline" onClick={() => addOpcion(g.id)}>+</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={nuevoGrupo.nombre} onChange={(e) => setNuevoGrupo((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nuevo grupo (Extras…)" />
              <Input className="w-16" inputMode="numeric" value={nuevoGrupo.min} onChange={(e) => setNuevoGrupo((s) => ({ ...s, min: e.target.value }))} placeholder="mín" title="Mínimo a elegir" />
              <Input className="w-16" inputMode="numeric" value={nuevoGrupo.max} onChange={(e) => setNuevoGrupo((s) => ({ ...s, max: e.target.value }))} placeholder="máx" title="Máximo a elegir" />
              <Button type="button" variant="outline" onClick={addGrupo} disabled={!nuevoGrupo.nombre.trim()}>Añadir grupo</Button>
            </div>
          </>
        )}
      </Card>

      {/* ── Acciones ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/productos")}>Cancelar</Button>
        <Button onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
      </div>
    </div>
  );
}
