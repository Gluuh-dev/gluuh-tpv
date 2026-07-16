"use client";

import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { Plus, Trash2, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASES_FISCALES } from "@/lib/fiscal-clases";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { eur } from "@/app/lib/money";

interface Menu { id: string; nombre: string; precio: number; clase_fiscal: string; activo: boolean; category_id: string | null }
interface Grupo { id: string; menu_id: string; nombre: string; orden: number }
interface Choice { group_id: string; product_id: string }
interface Prod { id: string; nombre: string }
interface Cat { id: string; nombre: string; familia: string }

// Grupos con que nace un menú nuevo (el caso común: menú del día). Editables después.
const GRUPOS_DEFECTO = ["Primero", "Segundo", "Postre", "Bebida"];

export default function Menus() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [nm, setNm] = useState({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: "" });
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const [{ data: m }, { data: g }, { data: c }, { data: p }, { data: ct }, { data: fm }] = await Promise.all([
      sb.from("menu").select("id,nombre,precio,clase_fiscal,activo,category_id").order("orden"),
      sb.from("menu_group").select("id,menu_id,nombre,orden").order("orden"),
      sb.from("menu_choice").select("group_id,product_id"),
      sb.from("product").select("id,nombre").eq("disponible", true).order("nombre"),
      sb.from("category").select("id,nombre,family_id").order("orden"),
      sb.from("family").select("id,nombre"),
    ]);
    setMenus((m as Menu[]) ?? []); setGrupos((g as Grupo[]) ?? []);
    setChoices((c as Choice[]) ?? []); setProds((p as Prod[]) ?? []);
    const famPor = new Map(((fm as { id: string; nombre: string }[] | null) ?? []).map((f) => [f.id, f.nombre]));
    setCats(((ct as { id: string; nombre: string; family_id: string | null }[] | null) ?? [])
      .map((c) => ({ id: c.id, nombre: c.nombre, familia: c.family_id ? (famPor.get(c.family_id) ?? "—") : "—" })));
  }
  useEffect(() => { (async () => { await cargar(); setLoading(false); })();   }, []);

  async function addMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!nm.nombre.trim()) return;
    const { data: nuevo } = await sb.from("menu")
      .insert({ tenant_id: tenantId, nombre: nm.nombre.trim(), precio: Number(nm.precio) || 0, clase_fiscal: nm.clase, category_id: nm.categoryId || null, orden: menus.length })
      .select("id").single();
    // Nace con los grupos típicos (renómbralos/bórralos/añade para un menú especial).
    if (nuevo) await sb.from("menu_group").insert(
      GRUPOS_DEFECTO.map((nombre, orden) => ({ tenant_id: tenantId, menu_id: (nuevo as { id: string }).id, nombre, orden })));
    setNm({ nombre: "", precio: "", clase: "REDUCIDO", categoryId: nm.categoryId }); cargar(); toast.success("Menú creado con grupos base");
  }
  async function renameGrupo(id: string, nombre: string) {
    if (!nombre.trim()) return;
    await sb.from("menu_group").update({ nombre: nombre.trim() }).eq("id", id); cargar();
  }
  // Mueve un menú a una categoría (su familia = "Menús"). "" lo desagrupa.
  async function moverMenu(id: string, categoryId: string) {
    await sb.from("menu").update({ category_id: categoryId || null }).eq("id", id); cargar();
  }
  // Crea (idempotente) la familia "Menús" + una categoría "Menús" dentro, y la devuelve.
  async function crearFamiliaMenus() {
    const yaCat = cats.find((c) => c.familia.toLowerCase() === "menús" || c.nombre.toLowerCase() === "menús");
    if (yaCat) { toast("La familia «Menús» ya existe"); setNm((s) => ({ ...s, categoryId: yaCat.id })); return; }
    let { data: fam } = await sb.from("family").select("id").ilike("nombre", "Menús").maybeSingle();
    if (!fam) ({ data: fam } = await sb.from("family").insert({ tenant_id: tenantId, nombre: "Menús" }).select("id").single());
    const { data: cat, error } = await sb.from("category").insert({ tenant_id: tenantId, nombre: "Menús", family_id: (fam as { id: string }).id }).select("id").single();
    if (error) { toast.error(`No se pudo crear: ${error.message}`); return; }
    await cargar();
    setNm((s) => ({ ...s, categoryId: (cat as { id: string }).id }));
    toast.success("Familia «Menús» creada");
  }
  async function delMenu(id: string) { if (confirm("¿Eliminar menú?")) { await sb.from("menu").delete().eq("id", id); cargar(); } }
  async function addGrupo(menu_id: string, nombre: string) {
    if (!nombre.trim()) return;
    await sb.from("menu_group").insert({ tenant_id: tenantId, menu_id, nombre: nombre.trim(), orden: grupos.filter((g) => g.menu_id === menu_id).length });
    cargar();
  }
  async function delGrupo(id: string) { await sb.from("menu_group").delete().eq("id", id); cargar(); }
  async function addChoice(group_id: string, product_id: string) {
    await sb.from("menu_choice").insert({ tenant_id: tenantId, group_id, product_id }); cargar();
  }
  async function delChoice(group_id: string, product_id: string) {
    await sb.from("menu_choice").delete().eq("group_id", group_id).eq("product_id", product_id); cargar();
  }

  if (loading) return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Menús" description="Menús del día y combos: crea grupos (Primero, Segundo, Postre) y elige qué productos ofrece cada uno." />
      <TableSkeleton rows={5} />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Menús" description="Menús del día y combos: crea grupos (Primero, Segundo, Postre) y elige qué productos ofrece cada uno." />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Nuevo menú</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addMenu} className="flex flex-wrap items-center gap-2">
            <Input className="w-56" placeholder="Nombre (Menú del día…)" value={nm.nombre} onChange={(e) => setNm({ ...nm, nombre: e.target.value })} />
            <Input className="w-28" placeholder="Precio €" inputMode="decimal" value={nm.precio} onChange={(e) => setNm({ ...nm, precio: e.target.value })} />
            <Select value={nm.clase} onValueChange={(v) => setNm({ ...nm, clase: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{CLASES_FISCALES.map((c) => <SelectItem key={c.v} value={c.v}>{c.t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={nm.categoryId || "0"} onValueChange={(v) => setNm({ ...nm, categoryId: v === "0" ? "" : v })}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Familia / categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin categoría (solo «Comp. menú»)</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.familia} · {c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button><Plus className="h-4 w-4" /> Crear menú</Button>
            <Button type="button" variant="outline" onClick={crearFamiliaMenus}>+ Familia «Menús»</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Asigna el menú a una categoría (p. ej. la familia «Menús») y saldrá en la rejilla del TPV como un artículo más. Sin categoría, solo se vende desde el botón «Comp. menú».
          </p>
        </CardContent>
      </Card>

      {/* `!loading &&`: sin eso decía «Sin menús» mientras los cargaba. */}
      {!loading && menus.length === 0 && <EmptyState title="Sin menús" description="Crea tu primer menú del día o combo arriba." />}

      {menus.map((m) => (
        <MenuCard key={m.id} menu={m} grupos={grupos.filter((g) => g.menu_id === m.id)} choices={choices} prods={prods} cats={cats}
          onMover={(cid) => moverMenu(m.id, cid)}
          onDelMenu={() => delMenu(m.id)} onAddGrupo={addGrupo} onDelGrupo={delGrupo} onRenameGrupo={renameGrupo} onAddChoice={addChoice} onDelChoice={delChoice} />
      ))}
    </div>
  );
}

function MenuCard({ menu, grupos, choices, prods, cats, onMover, onDelMenu, onAddGrupo, onDelGrupo, onRenameGrupo, onAddChoice, onDelChoice }: Readonly<{
  menu: Menu; grupos: Grupo[]; choices: Choice[]; prods: Prod[]; cats: Cat[];
  onMover: (categoryId: string) => void;
  onDelMenu: () => void; onAddGrupo: (menuId: string, nombre: string) => void; onDelGrupo: (id: string) => void;
  onRenameGrupo: (id: string, nombre: string) => void;
  onAddChoice: (gid: string, pid: string) => void; onDelChoice: (gid: string, pid: string) => void;
}>) {
  const [ng, setNg] = useState("");
  const nombre = (id: string) => prods.find((p) => p.id === id)?.nombre ?? "—";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{menu.nombre} <span className="text-muted-foreground">· {eur(menu.precio)}</span></CardTitle>
        <div className="flex items-center gap-2">
          <Select value={menu.category_id ?? "0"} onValueChange={(v) => onMover(v === "0" ? "" : v)}>
            <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Familia / categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sin categoría</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.familia} · {c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelMenu}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {grupos.length === 0 && <p className="text-sm text-muted-foreground">Añade grupos (Primero, Segundo, Postre…).</p>}
        {grupos.map((g) => {
          const asignados = choices.filter((c) => c.group_id === g.id);
          const disponibles = prods.filter((p) => !asignados.some((c) => c.product_id === p.id));
          return (
            <div key={g.id} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <input
                  defaultValue={g.nombre}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== g.nombre) onRenameGrupo(g.id, e.target.value); }}
                  className="w-40 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium outline-none hover:border-border focus:border-brand"
                  aria-label="Nombre del grupo"
                />
                <button onClick={() => onDelGrupo(g.id)} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {asignados.map((c) => (
                  <Badge key={c.product_id} variant="secondary" className="gap-1">
                    {nombre(c.product_id)}
                    <button onClick={() => onDelChoice(g.id, c.product_id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                {disponibles.length > 0 && (
                  <Select value="" onValueChange={(pid) => onAddChoice(g.id, pid)}>
                    <SelectTrigger className="h-7 w-44"><SelectValue placeholder="+ producto" /></SelectTrigger>
                    <SelectContent>{disponibles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
          );
        })}
        <form onSubmit={(e) => { e.preventDefault(); onAddGrupo(menu.id, ng); setNg(""); }} className="flex gap-2">
          <Input className="w-48" placeholder="Nuevo grupo (Primero…)" value={ng} onChange={(e) => setNg(e.target.value)} />
          <Button variant="outline"><Plus className="h-4 w-4" /> Grupo</Button>
        </form>
      </CardContent>
    </Card>
  );
}
