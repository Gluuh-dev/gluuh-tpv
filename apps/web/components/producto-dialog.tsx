"use client";

import * as React from "react";
import { toast } from "sonner";
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

interface Props { producto: { id: string; nombre: string }; onSaved: () => void }

export function ProductoDialog({ producto, onSaved }: Props) {
  const sb = supabaseBrowser();
  const [open, setOpen] = React.useState(false);
  const [tenantId, setTenantId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({ descripcion: "", codigo_barras: "", foto_url: "", alergenos: [] as string[], estacion: "COCINA" });

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: t }, { data: p }] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("product").select("descripcion,codigo_barras,foto_url,alergenos,estacion").eq("id", producto.id).maybeSingle(),
      ]);
      setTenantId((t as { id: string } | null)?.id ?? "");
      const d = (p as { descripcion?: string; codigo_barras?: string; foto_url?: string; alergenos?: string[]; estacion?: string } | null) ?? {};
      setF({ descripcion: d.descripcion ?? "", codigo_barras: d.codigo_barras ?? "", foto_url: d.foto_url ?? "", alergenos: d.alergenos ?? [], estacion: estacionDe(d.estacion) });
    })();
    /* eslint-disable-next-line */
  }, [open]);

  function toggle(v: string) {
    setF((s) => ({ ...s, alergenos: s.alergenos.includes(v) ? s.alergenos.filter((x) => x !== v) : [...s.alergenos, v] }));
  }
  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tenantId) return;
    try { setF((s) => ({ ...s, foto_url: "" })); const url = await subirMedia(sb, tenantId, file, "productos"); setF((s) => ({ ...s, foto_url: url })); } catch (err) { console.error(err); }
  }
  async function guardar() {
    setBusy(true);
    await sb.from("product").update({ descripcion: f.descripcion || null, codigo_barras: f.codigo_barras || null, foto_url: f.foto_url || null, alergenos: f.alergenos, estacion: f.estacion }).eq("id", producto.id);
    setBusy(false); setOpen(false); onSaved();
    toast.success("Ficha de producto guardada");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-muted-foreground/60 hover:text-foreground" title="Editar ficha"><Pencil className="h-4 w-4" /></button>
      </DialogTrigger>
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
                {f.foto_url && <img src={f.foto_url} alt="" className="h-9 w-9 rounded object-cover" />}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estación de preparación</Label>
            <select
              value={f.estacion}
              onChange={(e) => setF({ ...f, estacion: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ESTACIONES.map((s) => <option key={s} value={s}>{ESTACION_LABEL[s]}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Bebidas → Barra · Comidas → Cocina · Tapas frías → Camarero · Ninguna no se manda a preparar.</p>
          </div>
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
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
