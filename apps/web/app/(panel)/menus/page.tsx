"use client";

import { useEffect, useState } from "react";
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

interface Menu { id: string; nombre: string; precio: number; clase_fiscal: string; activo: boolean }
interface Grupo { id: string; menu_id: string; nombre: string; orden: number }
interface Choice { group_id: string; product_id: string }
interface Prod { id: string; nombre: string }
const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Menus() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [nm, setNm] = useState({ nombre: "", precio: "", clase: "REDUCIDO" });
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const [{ data: m }, { data: g }, { data: c }, { data: p }] = await Promise.all([
      sb.from("menu").select("id,nombre,precio,clase_fiscal,activo").order("orden"),
      sb.from("menu_group").select("id,menu_id,nombre,orden").order("orden"),
      sb.from("menu_choice").select("group_id,product_id"),
      sb.from("product").select("id,nombre").eq("disponible", true).order("nombre"),
    ]);
    setMenus((m as Menu[]) ?? []); setGrupos((g as Grupo[]) ?? []);
    setChoices((c as Choice[]) ?? []); setProds((p as Prod[]) ?? []);
  }
  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  async function addMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!nm.nombre.trim()) return;
    await sb.from("menu").insert({ tenant_id: tenantId, nombre: nm.nombre.trim(), precio: Number(nm.precio) || 0, clase_fiscal: nm.clase, orden: menus.length });
    setNm({ nombre: "", precio: "", clase: "REDUCIDO" }); cargar();
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

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;

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
            <Button><Plus className="h-4 w-4" /> Crear menú</Button>
          </form>
        </CardContent>
      </Card>

      {menus.length === 0 && <EmptyState title="Sin menús" description="Crea tu primer menú del día o combo arriba." />}

      {menus.map((m) => (
        <MenuCard key={m.id} menu={m} grupos={grupos.filter((g) => g.menu_id === m.id)} choices={choices} prods={prods}
          onDelMenu={() => delMenu(m.id)} onAddGrupo={addGrupo} onDelGrupo={delGrupo} onAddChoice={addChoice} onDelChoice={delChoice} />
      ))}
    </div>
  );
}

function MenuCard({ menu, grupos, choices, prods, onDelMenu, onAddGrupo, onDelGrupo, onAddChoice, onDelChoice }: {
  menu: Menu; grupos: Grupo[]; choices: Choice[]; prods: Prod[];
  onDelMenu: () => void; onAddGrupo: (menuId: string, nombre: string) => void; onDelGrupo: (id: string) => void;
  onAddChoice: (gid: string, pid: string) => void; onDelChoice: (gid: string, pid: string) => void;
}) {
  const [ng, setNg] = useState("");
  const nombre = (id: string) => prods.find((p) => p.id === id)?.nombre ?? "—";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{menu.nombre} <span className="text-muted-foreground">· {eur(menu.precio)}</span></CardTitle>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelMenu}><Trash2 className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {grupos.length === 0 && <p className="text-sm text-muted-foreground">Añade grupos (Primero, Segundo, Postre…).</p>}
        {grupos.map((g) => {
          const asignados = choices.filter((c) => c.group_id === g.id);
          const disponibles = prods.filter((p) => !asignados.some((c) => c.product_id === p.id));
          return (
            <div key={g.id} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{g.nombre}</span>
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
