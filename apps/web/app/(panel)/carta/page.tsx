"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Categoria { id: string; nombre: string; orden: number }
interface Producto { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null; es_alcohol: boolean; disponible: boolean }

const TIPOS = [0, 3, 5, 7, 10, 15, 21];
const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Carta() {
  const sb = supabaseBrowser();
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [nuevaCat, setNuevaCat] = useState("");

  async function cargar() {
    const [{ data: c }, { data: p }] = await Promise.all([
      sb.from("category").select("id,nombre,orden").order("orden"),
      sb.from("product").select("id,nombre,precio,tipo_impositivo,category_id,es_alcohol,disponible").order("nombre"),
    ]);
    setCats((c as Categoria[]) ?? []);
    setProds((p as Producto[]) ?? []);
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaCat.trim()) return;
    await sb.from("category").insert({ nombre: nuevaCat.trim(), orden: cats.length });
    setNuevaCat("");
    cargar();
  }
  async function delCat(id: string) {
    if (!confirm("¿Eliminar categoría? Sus productos quedarán sin categoría.")) return;
    await sb.from("category").delete().eq("id", id);
    cargar();
  }
  async function delProd(id: string) {
    await sb.from("product").delete().eq("id", id);
    cargar();
  }
  async function toggleDisp(p: Producto) {
    await sb.from("product").update({ disponible: !p.disponible }).eq("id", p.id);
    cargar();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Carta</h1>
          <p className="text-muted-foreground">Categorías y productos de tu carta. Las pantallas (TPV, kiosko) leen de aquí.</p>
        </div>
        <form onSubmit={addCat} className="flex gap-2">
          <Input className="w-48" placeholder="Nueva categoría" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
          <Button className="whitespace-nowrap"><Plus className="h-4 w-4" /> Categoría</Button>
        </form>
      </div>

      {cats.length === 0 && <Card className="p-5 text-muted-foreground">Crea tu primera categoría para empezar.</Card>}

      <div className="space-y-5">
        {cats.map((cat) => (
          <CategoriaCard
            key={cat.id}
            cat={cat}
            productos={prods.filter((p) => p.category_id === cat.id)}
            onDeleteCat={() => delCat(cat.id)}
            onDeleteProd={delProd}
            onToggle={toggleDisp}
            onAdded={cargar}
          />
        ))}
      </div>
    </div>
  );
}

function CategoriaCard({ cat, productos, onDeleteCat, onDeleteProd, onToggle, onAdded }: {
  cat: Categoria; productos: Producto[]; onDeleteCat: () => void;
  onDeleteProd: (id: string) => void; onToggle: (p: Producto) => void; onAdded: () => void;
}) {
  const sb = supabaseBrowser();
  const [f, setF] = useState({ nombre: "", precio: "", tipo: "7", alcohol: false });
  const [saving, setSaving] = useState(false);

  async function addProd(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim() || !f.precio) return;
    setSaving(true);
    await sb.from("product").insert({
      nombre: f.nombre.trim(), precio: Number(f.precio), tipo_impositivo: Number(f.tipo),
      category_id: cat.id, es_alcohol: f.alcohol, disponible: true,
    });
    setSaving(false);
    setF({ nombre: "", precio: "", tipo: "7", alcohol: false });
    onAdded();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-medium">{cat.nombre} <span className="text-muted-foreground">· {productos.length}</span></h2>
        <button onClick={onDeleteCat} className="text-slate-400 hover:text-destructive" title="Eliminar categoría"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="divide-y divide-border">
        {productos.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="flex-1">{p.nombre}{p.es_alcohol && <span className="ml-2 text-xs text-amber-600">alcohol</span>}</span>
            <span className="w-16 text-right tabular-nums">{eur(p.precio)}</span>
            <span className="w-14 text-right text-muted-foreground">{p.tipo_impositivo}%</span>
            <button onClick={() => onToggle(p)} className={`w-20 text-right text-xs ${p.disponible ? "text-emerald-600" : "text-muted-foreground"}`}>{p.disponible ? "Disponible" : "Agotado"}</button>
            <button onClick={() => onDeleteProd(p.id)} className="text-slate-300 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>

      <form onSubmit={addProd} className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-5 py-3">
        <Input className="w-44" placeholder="Producto" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <Input className="w-24" placeholder="Precio" inputMode="decimal" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
        <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={String(t)}>{t}%</SelectItem>)}</SelectContent>
        </Select>
        <label className="flex items-center gap-1 text-sm text-muted-foreground"><input type="checkbox" checked={f.alcohol} onChange={(e) => setF({ ...f, alcohol: e.target.checked })} /> alcohol</label>
        <Button disabled={saving}><Plus className="h-4 w-4" /> Añadir</Button>
      </form>
    </Card>
  );
}
