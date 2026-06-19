"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, FolderPlus } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASES_FISCALES, ivaAuto, nombreImpuesto } from "@/lib/fiscal-clases";
import { ESTACIONES, ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductoDialog } from "@/components/producto-dialog";

interface Familia { id: string; nombre: string; orden: number; color: string }
interface Categoria { id: string; nombre: string; orden: number; family_id: string | null }
interface Producto { id: string; nombre: string; precio: number; tipo_impositivo: number; clase_fiscal: string; category_id: string | null; es_alcohol: boolean; disponible: boolean; estacion: string | null }

const eur = (n: number) => Number(n).toFixed(2) + " €";
const SIN_FAMILIA = "__none__";

export default function Carta() {
  const sb = supabaseBrowser();
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [nuevaFamilia, setNuevaFamilia] = useState("");
  const [nuevaCat, setNuevaCat] = useState("");
  const [catFamilia, setCatFamilia] = useState<string>(SIN_FAMILIA);

  async function cargar() {
    const [{ data: loc }, { data: fam }, { data: c }, { data: p }] = await Promise.all([
      sb.from("location").select("territorio_fiscal").limit(1).maybeSingle(),
      sb.from("family").select("id,nombre,orden,color").order("orden"),
      sb.from("category").select("id,nombre,orden,family_id").order("orden"),
      sb.from("product").select("id,nombre,precio,tipo_impositivo,clase_fiscal,category_id,es_alcohol,disponible,estacion").order("nombre"),
    ]);
    if (loc?.territorio_fiscal) setTerritorio(loc.territorio_fiscal);
    setFamilias((fam as Familia[]) ?? []);
    setCats((c as Categoria[]) ?? []);
    setProds((p as Producto[]) ?? []);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function addFamilia(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaFamilia.trim()) return;
    await sb.from("family").insert({ nombre: nuevaFamilia.trim(), orden: familias.length });
    setNuevaFamilia(""); cargar();
  }
  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaCat.trim()) return;
    await sb.from("category").insert({ nombre: nuevaCat.trim(), orden: cats.length, family_id: catFamilia === SIN_FAMILIA ? null : catFamilia });
    setNuevaCat(""); cargar();
  }
  async function delFamilia(id: string) {
    if (!confirm("¿Eliminar familia? Sus categorías quedarán sin familia.")) return;
    await sb.from("family").delete().eq("id", id); cargar();
  }
  async function delCat(id: string) {
    if (!confirm("¿Eliminar categoría? Sus productos quedarán sin categoría.")) return;
    await sb.from("category").delete().eq("id", id); cargar();
  }
  async function delProd(id: string) { await sb.from("product").delete().eq("id", id); cargar(); }
  async function toggleDisp(p: Producto) { await sb.from("product").update({ disponible: !p.disponible }).eq("id", p.id); cargar(); }

  // Agrupa categorías por familia (+ bucket "sin familia")
  const grupos = [
    ...familias.map((f) => ({ familia: f, cats: cats.filter((c) => c.family_id === f.id) })),
    { familia: null as Familia | null, cats: cats.filter((c) => !c.family_id) },
  ].filter((g) => g.cats.length > 0 || g.familia);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Carta"
        description={`Familias → categorías → productos. El ${nombreImpuesto(territorio)} se calcula automáticamente por la clase fiscal de cada producto.`}
      />

      {/* Altas rápidas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <form onSubmit={addFamilia} className="flex gap-2">
          <Input placeholder="Nueva familia (Bebidas, Comidas…)" value={nuevaFamilia} onChange={(e) => setNuevaFamilia(e.target.value)} />
          <Button variant="outline" className="whitespace-nowrap"><FolderPlus className="h-4 w-4" /> Familia</Button>
        </form>
        <form onSubmit={addCat} className="flex gap-2">
          <Input placeholder="Nueva categoría" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
          <Select value={catFamilia} onValueChange={setCatFamilia}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Familia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_FAMILIA}>Sin familia</SelectItem>
              {familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="whitespace-nowrap"><Plus className="h-4 w-4" /> Categoría</Button>
        </form>
      </div>

      {grupos.length === 0 && (
        <EmptyState
          title="Sin familias ni categorías"
          description="Crea tu primera familia y categoría para empezar a organizar los productos de tu carta."
        />
      )}

      {grupos.map((g) => (
        <section key={g.familia?.id ?? "sinfam"} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: g.familia?.color ?? "#cbd5e1" }} />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.familia?.nombre ?? "Sin familia"}</h2>
            {g.familia && <button onClick={() => delFamilia(g.familia!.id)} className="text-muted-foreground/50 hover:text-destructive" title="Eliminar familia"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
          {g.cats.length === 0 && <p className="pl-5 text-sm text-muted-foreground">Sin categorías en esta familia.</p>}
          {g.cats.map((cat) => (
            <CategoriaCard
              key={cat.id}
              cat={cat}
              territorio={territorio}
              productos={prods.filter((p) => p.category_id === cat.id)}
              onDeleteCat={() => delCat(cat.id)}
              onDeleteProd={delProd}
              onToggle={toggleDisp}
              onAdded={cargar}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function CategoriaCard({ cat, productos, territorio, onDeleteCat, onDeleteProd, onToggle, onAdded }: {
  cat: Categoria; productos: Producto[]; territorio: string; onDeleteCat: () => void;
  onDeleteProd: (id: string) => void; onToggle: (p: Producto) => void; onAdded: () => void;
}) {
  const sb = supabaseBrowser();
  const [f, setF] = useState({ nombre: "", precio: "", clase: "REDUCIDO", alcohol: false, estacion: "COCINA" });
  const [saving, setSaving] = useState(false);
  const ivaPrev = ivaAuto(f.clase, territorio);

  async function addProd(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim() || !f.precio) return;
    setSaving(true);
    await sb.from("product").insert({
      nombre: f.nombre.trim(), precio: Number(f.precio),
      clase_fiscal: f.clase, tipo_impositivo: ivaAuto(f.clase, territorio),
      category_id: cat.id, es_alcohol: f.alcohol, disponible: true, estacion: f.estacion,
    });
    setSaving(false);
    setF({ nombre: "", precio: "", clase: "REDUCIDO", alcohol: false, estacion: "COCINA" });
    onAdded();
  }

  // IVA automático: si es alcohol → General; y por defecto a Barra (bebida).
  function setAlcohol(on: boolean) { setF((s) => ({ ...s, alcohol: on, clase: on ? "GENERAL" : s.clase, estacion: on ? "BARRA" : s.estacion })); }

  return (
    <Card className="ml-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="font-medium">{cat.nombre} <span className="text-muted-foreground">· {productos.length}</span></h3>
        <button onClick={onDeleteCat} className="text-muted-foreground/60 hover:text-destructive" title="Eliminar categoría"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="divide-y divide-border">
        {productos.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="flex-1">{p.nombre}{p.es_alcohol && <span className="ml-2 text-xs text-amber-600">alcohol</span>}</span>
            <Badge variant="secondary" className="font-normal">{p.clase_fiscal?.toLowerCase()}</Badge>
            <Badge variant="outline" className="font-normal">{ESTACION_LABEL[estacionDe(p.estacion)]}</Badge>
            <span className="w-14 text-right text-muted-foreground">{p.tipo_impositivo}%</span>
            <span className="w-16 text-right tabular-nums">{eur(p.precio)}</span>
            <button onClick={() => onToggle(p)} className={`w-20 text-right text-xs ${p.disponible ? "text-emerald-600" : "text-muted-foreground"}`}>{p.disponible ? "Disponible" : "Agotado"}</button>
            <ProductoDialog producto={p} onSaved={onAdded} />
            <button onClick={() => onDeleteProd(p.id)} className="text-muted-foreground/50 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      <form onSubmit={addProd} className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-5 py-3">
        <Input className="w-44" placeholder="Producto" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <Input className="w-24" placeholder="Precio" inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
        <Select value={f.clase} onValueChange={(v) => setF({ ...f, clase: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{CLASES_FISCALES.map((c) => <SelectItem key={c.v} value={c.v}>{c.t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={f.estacion} onValueChange={(v) => setF({ ...f, estacion: v })}>
          <SelectTrigger className="w-32" title="A dónde se manda al marchar"><SelectValue /></SelectTrigger>
          <SelectContent>{ESTACIONES.map((s) => <SelectItem key={s} value={s}>{ESTACION_LABEL[s]}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground" title="Calculado automáticamente por territorio">{nombreImpuesto(territorio)} auto: <b>{ivaPrev}%</b></span>
        <label className="flex items-center gap-1 text-sm text-muted-foreground"><input type="checkbox" checked={f.alcohol} onChange={(e) => setAlcohol(e.target.checked)} /> alcohol</label>
        <Button disabled={saving}><Plus className="h-4 w-4" /> Añadir</Button>
      </form>
    </Card>
  );
}
