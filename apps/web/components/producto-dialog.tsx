"use client";

import * as React from "react";
import { toast } from "@/app/lib/toast";
import { Pencil, Upload } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { subirMedia } from "@/app/lib/branding";
import { ESTACIONES, ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";
import { ALERGENOS } from "@/lib/alergenos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { urlFoto } from "@/app/lib/urlFoto";

interface Props {
  producto: { id: string; nombre: string };
  onSaved: () => void;
  /** Modo controlado: si se pasan, el padre gobierna la apertura del diálogo. */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  /** Disparador: nodo a usar como trigger, o `false` para no renderizar ninguno (lo abre el padre). */
  trigger?: React.ReactNode | false;
}

// Plantillas rápidas de formatos habituales en hostelería: crean los formatos
// a precio 0 y el usuario retoca los precios en la propia lista.
const PLANTILLAS_FORMATO: { t: string; nombres: string[] }[] = [
  { t: "Caña/Tubo/Tercio", nombres: ["Caña", "Tubo", "Tercio"] },
  { t: "Copa/Botella", nombres: ["Copa", "Botella"] },
  { t: "Media/Entera", nombres: ["Media", "Entera"] },
  { t: "1/3 / 1/5", nombres: ["1/3", "1/5"] },
];

export function ProductoDialog({ producto, onSaved, open: openProp, onOpenChange, trigger }: Props) {
  const sb = supabaseBrowser();
  const [openInterno, setOpenInterno] = React.useState(false);
  // Controlado si el padre pasa `open`; si no, estado interno (comportamiento clásico del lápiz).
  const open = openProp ?? openInterno;
  const setOpen = (o: boolean) => { setOpenInterno(o); onOpenChange?.(o); };
  const [tenantId, setTenantId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({ descripcion: "", codigo_barras: "", foto_url: "", alergenos: [] as string[], estacion: "COCINA", vendido_por_peso: false });
  // La estación mostrada viene de la categoría (el producto no tiene una propia).
  const [estacionHeredada, setEstacionHeredada] = React.useState(false);
  // Nombres de impresión (0051). null = migración sin aplicar → se oculta la sección.
  const [nombres, setNombres] = React.useState<{ ticket: string; cocina: string } | null>(null);
  const [formatos, setFormatos] = React.useState<{ id: string; nombre: string; precio: number }[]>([]);
  const [nuevoFmt, setNuevoFmt] = React.useState({ nombre: "", precio: "" });
  type Grupo = { id: string; nombre: string; min_sel: number; max_sel: number; opciones: { id: string; nombre: string; precio_extra: number }[] };
  const [grupos, setGrupos] = React.useState<Grupo[]>([]);
  const [nuevoGrupo, setNuevoGrupo] = React.useState({ nombre: "", min: "0", max: "1" });
  const [nuevaOpcion, setNuevaOpcion] = React.useState<Record<string, { nombre: string; precio: string }>>({});

  async function cargarFormatos() {
    const { data } = await sb.from("product_format").select("id,nombre,precio").eq("product_id", producto.id).order("orden");
    setFormatos((data as { id: string; nombre: string; precio: number }[]) ?? []);
  }
  async function cargarModificadores() {
    const { data: gs } = await sb.from("modifier_group").select("id,nombre,min_sel,max_sel").eq("product_id", producto.id);
    const base = (gs as { id: string; nombre: string; min_sel: number; max_sel: number }[]) ?? [];
    const conOpc = await Promise.all(base.map(async (g) => {
      const { data: ops } = await sb.from("modifier").select("id,nombre,precio_extra").eq("modifier_group_id", g.id);
      return { ...g, opciones: (ops as { id: string; nombre: string; precio_extra: number }[]) ?? [] };
    }));
    setGrupos(conOpc);
  }
  async function addGrupo() {
    if (!nuevoGrupo.nombre.trim() || !tenantId) return;
    await sb.from("modifier_group").insert({ tenant_id: tenantId, product_id: producto.id, nombre: nuevoGrupo.nombre.trim(), min_sel: Number(nuevoGrupo.min) || 0, max_sel: Number(nuevoGrupo.max) || 1 });
    setNuevoGrupo({ nombre: "", min: "0", max: "1" });
    await cargarModificadores();
  }
  async function delGrupo(id: string) { await sb.from("modifier_group").delete().eq("id", id); await cargarModificadores(); }
  async function addOpcion(grupoId: string) {
    const o = nuevaOpcion[grupoId]; if (!o?.nombre.trim() || !tenantId) return;
    await sb.from("modifier").insert({ tenant_id: tenantId, modifier_group_id: grupoId, nombre: o.nombre.trim(), precio_extra: Number(o.precio.replace(",", ".")) || 0 });
    setNuevaOpcion((s) => ({ ...s, [grupoId]: { nombre: "", precio: "" } }));
    await cargarModificadores();
  }
  async function delOpcion(id: string) { await sb.from("modifier").delete().eq("id", id); await cargarModificadores(); }

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: t }, { data: p }, rNombres] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("product").select("descripcion,codigo_barras,foto_url,alergenos,estacion,vendido_por_peso,category_id").eq("id", producto.id).maybeSingle(),
        // Consulta aparte: si la 0051 no está aplicada falla solo esta y se oculta la sección.
        sb.from("product").select("nombre_ticket,nombre_cocina").eq("id", producto.id).maybeSingle(),
      ]);
      if (rNombres.error) setNombres(null);
      else {
        const n = rNombres.data as { nombre_ticket?: string | null; nombre_cocina?: string | null } | null;
        setNombres({ ticket: n?.nombre_ticket ?? "", cocina: n?.nombre_cocina ?? "" });
      }
      setTenantId((t as { id: string } | null)?.id ?? "");
      const d = (p as { descripcion?: string; codigo_barras?: string; foto_url?: string; alergenos?: string[]; estacion?: string | null; vendido_por_peso?: boolean; category_id?: string | null } | null) ?? {};
      // Sin estación propia: preselecciona la de la categoría (si la 0050 está
      // aplicada y la categoría la tiene), indicándolo como "heredada".
      let estacion = d.estacion ?? null;
      let heredada = false;
      if (!estacion && d.category_id) {
        const { data: c } = await sb.from("category").select("estacion").eq("id", d.category_id).maybeSingle();
        const ce = (c as { estacion?: string | null } | null)?.estacion;
        if (ce && (ESTACIONES as readonly string[]).includes(ce)) { estacion = ce; heredada = true; }
      }
      setEstacionHeredada(heredada);
      setF({ descripcion: d.descripcion ?? "", codigo_barras: d.codigo_barras ?? "", foto_url: d.foto_url ?? "", alergenos: d.alergenos ?? [], estacion: estacionDe(estacion), vendido_por_peso: d.vendido_por_peso ?? false });
      await cargarFormatos();
      await cargarModificadores();
    })();
    /* eslint-disable-next-line */
  }, [open]);

  async function addFormato() {
    const precio = Number(nuevoFmt.precio.replace(",", "."));
    if (!nuevoFmt.nombre.trim() || !precio) return;
    await sb.from("product_format").insert({ product_id: producto.id, nombre: nuevoFmt.nombre.trim(), precio, orden: formatos.length });
    setNuevoFmt({ nombre: "", precio: "" });
    await cargarFormatos();
  }
  async function delFormato(id: string) {
    await sb.from("product_format").delete().eq("id", id);
    await cargarFormatos();
  }
  async function aplicarPlantilla(nombres: string[]) {
    const existentes = new Set(formatos.map((ft) => ft.nombre.toLowerCase()));
    const nuevos = nombres.filter((n) => !existentes.has(n.toLowerCase()));
    if (!nuevos.length) return;
    await sb.from("product_format").insert(nuevos.map((nombre, i) => ({ product_id: producto.id, nombre, precio: 0, orden: formatos.length + i })));
    await cargarFormatos();
    toast.success("Formatos creados: pon los precios en la lista");
  }
  async function guardarPrecioFormato(id: string, texto: string, anterior: number) {
    const v = Number(texto.replace(",", "."));
    if (!Number.isFinite(v) || v < 0 || v === Number(anterior)) return;
    await sb.from("product_format").update({ precio: v }).eq("id", id);
    await cargarFormatos();
  }

  // "Copiar de otro producto…": clona formatos y/o añadidos de otro artículo.
  const [copiarAbierto, setCopiarAbierto] = React.useState(false);
  const [candidatos, setCandidatos] = React.useState<{ id: string; nombre: string }[]>([]);
  const [copia, setCopia] = React.useState({ origen: "", fmts: true, mods: true, busy: false });

  async function abrirCopiar() {
    setCopiarAbierto(true);
    const [{ data: pf }, { data: mg }] = await Promise.all([
      sb.from("product_format").select("product_id"),
      sb.from("modifier_group").select("product_id"),
    ]);
    const conAlgo = [...((pf as { product_id: string }[]) ?? []), ...((mg as { product_id: string }[]) ?? [])];
    const ids = [...new Set(conAlgo.map((r) => r.product_id))].filter((id) => id !== producto.id);
    if (!ids.length) { setCandidatos([]); return; }
    const { data: ps } = await sb.from("product").select("id,nombre").in("id", ids).order("nombre");
    setCandidatos((ps as { id: string; nombre: string }[]) ?? []);
  }

  async function copiarDesde() {
    if (!copia.origen || (!copia.fmts && !copia.mods)) return;
    setCopia((s) => ({ ...s, busy: true }));
    try {
      if (copia.fmts) {
        const { data } = await sb.from("product_format").select("nombre,precio,orden").eq("product_id", copia.origen).order("orden");
        const filas = ((data as { nombre: string; precio: number }[]) ?? [])
          .map((ft, i) => ({ product_id: producto.id, nombre: ft.nombre, precio: ft.precio, orden: formatos.length + i }));
        if (filas.length) await sb.from("product_format").insert(filas);
      }
      if (copia.mods) {
        const { data: gs } = await sb.from("modifier_group").select("id,nombre,min_sel,max_sel").eq("product_id", copia.origen);
        for (const g of (gs as { id: string; nombre: string; min_sel: number; max_sel: number }[]) ?? []) {
          const { data: nuevo } = await sb.from("modifier_group")
            .insert({ tenant_id: tenantId, product_id: producto.id, nombre: g.nombre, min_sel: g.min_sel, max_sel: g.max_sel })
            .select("id").single();
          if (!nuevo) continue;
          const { data: ops } = await sb.from("modifier").select("nombre,precio_extra").eq("modifier_group_id", g.id);
          const filas = ((ops as { nombre: string; precio_extra: number }[]) ?? [])
            .map((o) => ({ tenant_id: tenantId, modifier_group_id: (nuevo as { id: string }).id, nombre: o.nombre, precio_extra: o.precio_extra }));
          if (filas.length) await sb.from("modifier").insert(filas);
        }
      }
      await cargarFormatos();
      await cargarModificadores();
      setCopiarAbierto(false);
      setCopia({ origen: "", fmts: true, mods: true, busy: false });
      toast.success("Copiado del otro producto");
    } catch (e) {
      setCopia((s) => ({ ...s, busy: false }));
      toast.error(`No se pudo copiar: ${e instanceof Error ? e.message : e}`);
    }
  }

  function toggle(v: string) {
    setF((s) => ({ ...s, alergenos: s.alergenos.includes(v) ? s.alergenos.filter((x) => x !== v) : [...s.alergenos, v] }));
  }
  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tenantId) return;
    try { setF((s) => ({ ...s, foto_url: "" })); const url = await subirMedia(sb, tenantId, file, "productos"); setF((s) => ({ ...s, foto_url: url })); } catch (err) { console.error(err); }
  }
  async function guardar() {
    setBusy(true);
    const cambios: Record<string, unknown> = { descripcion: f.descripcion || null, codigo_barras: f.codigo_barras || null, foto_url: f.foto_url || null, alergenos: f.alergenos, estacion: f.estacion, vendido_por_peso: f.vendido_por_peso };
    if (nombres) {
      cambios.nombre_ticket = nombres.ticket.trim() || null;
      cambios.nombre_cocina = nombres.cocina.trim() || null;
    }
    await sb.from("product").update(cambios).eq("id", producto.id);
    setBusy(false); setOpen(false); onSaved();
    toast.success("Ficha de producto guardada");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== false && (
        <DialogTrigger asChild>
          {trigger ?? (
            <button className="text-muted-foreground/60 hover:text-foreground" title="Editar ficha" aria-label="Editar ficha"><Pencil className="h-4 w-4" /></button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{producto.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Descripción</Label><Textarea rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Para carta y kiosko" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Código de barras</Label><Input value={f.codigo_barras} onChange={(e) => setF({ ...f, codigo_barras: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Foto</Label>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"><Upload className="h-4 w-4" /> Subir<input type="file" accept="image/*" className="hidden" onChange={onFoto} /></label>
                {f.foto_url && <img src={urlFoto(f.foto_url)} alt="" className="h-9 w-9 rounded object-cover" />}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estación de preparación</Label>
            <select
              value={f.estacion}
              onChange={(e) => { setF({ ...f, estacion: e.target.value }); setEstacionHeredada(false); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ESTACIONES.map((s) => <option key={s} value={s}>{ESTACION_LABEL[s]}</option>)}
            </select>
            {estacionHeredada && <p className="text-xs text-muted-foreground">Heredada de la categoría (se fijará en el producto al guardar).</p>}
            <p className="text-xs text-muted-foreground">Bebidas → Barra · Comidas → Cocina · Tapas frías → Camarero · Ninguna no se manda a preparar.</p>
          </div>
          {nombres && (
            <div>
              <Label className="mb-1.5 block">Nombres de impresión</Label>
              <p className="mb-2 text-xs text-muted-foreground">Cómo sale este artículo impreso. Vacío = igual que el nombre.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">En ticket y factura</Label>
                  <Input value={nombres.ticket} onChange={(e) => setNombres({ ...nombres, ticket: e.target.value })} placeholder={producto.nombre} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">En cocina y comandas</Label>
                  <Input value={nombres.cocina} onChange={(e) => setNombres({ ...nombres, cocina: e.target.value })} placeholder={producto.nombre} />
                </div>
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.vendido_por_peso} onChange={(e) => setF({ ...f, vendido_por_peso: e.target.checked })} />
            Vendido por peso (el precio es €/kg; al vender se teclea el peso)
          </label>
          <div>
            <Label className="mb-1.5 block">Alérgenos</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {ALERGENOS.map((a) => (
                <label key={a.v} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.alergenos.includes(a.v)} onChange={() => toggle(a.v)} /> {a.t}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Formatos de venta</Label>
            <p className="mb-2 text-xs text-muted-foreground">Caña/copa/botella, ración/media… Si añades formatos, en el TPV se elige uno al vender (el precio base se ignora).</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
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
            <div className="mt-2 flex gap-2">
              <Input value={nuevoFmt.nombre} onChange={(e) => setNuevoFmt((s) => ({ ...s, nombre: e.target.value }))} placeholder="Formato (Caña…)" />
              <Input className="w-24" inputMode="decimal" value={nuevoFmt.precio} onChange={(e) => setNuevoFmt((s) => ({ ...s, precio: e.target.value }))} placeholder="€" />
              <Button type="button" variant="outline" onClick={addFormato} disabled={!nuevoFmt.nombre.trim() || !nuevoFmt.precio}>Añadir</Button>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Modificadores</Label>
            <p className="mb-2 text-xs text-muted-foreground">Grupos de opciones (punto de la carne, extras…). En el TPV se eligen al vender; los extras suman al precio.</p>
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
            <div className="mt-2 flex flex-wrap gap-2">
              <Input value={nuevoGrupo.nombre} onChange={(e) => setNuevoGrupo((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nuevo grupo (Extras…)" />
              <Input className="w-16" inputMode="numeric" value={nuevoGrupo.min} onChange={(e) => setNuevoGrupo((s) => ({ ...s, min: e.target.value }))} placeholder="mín" title="Mínimo a elegir" />
              <Input className="w-16" inputMode="numeric" value={nuevoGrupo.max} onChange={(e) => setNuevoGrupo((s) => ({ ...s, max: e.target.value }))} placeholder="máx" title="Máximo a elegir" />
              <Button type="button" variant="outline" onClick={addGrupo} disabled={!nuevoGrupo.nombre.trim()}>Añadir grupo</Button>
            </div>
          </div>
          <div className="rounded-md border border-dashed border-input p-2.5">
            {!copiarAbierto ? (
              <Button type="button" variant="outline" size="sm" onClick={abrirCopiar}>Copiar de otro producto…</Button>
            ) : (
              <div className="space-y-2">
                <select
                  value={copia.origen}
                  onChange={(e) => setCopia((s) => ({ ...s, origen: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Elige el producto de origen —</option>
                  {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
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
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
