"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Desc { id: string; nombre: string; tipo: string; valor: number; activo: boolean }

export default function Descuentos() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [list, setList] = useState<Desc[]>([]);
  const [f, setF] = useState({ nombre: "", tipo: "PORCENTAJE", valor: "" });
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const { data } = await sb.from("discount").select("id,nombre,tipo,valor,activo").order("orden");
    setList((data as Desc[]) ?? []);
  }
  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) return;
    await sb.from("discount").insert({ tenant_id: tenantId, nombre: f.nombre.trim(), tipo: f.tipo, valor: Number(f.valor) || 0, orden: list.length });
    setF({ nombre: "", tipo: "PORCENTAJE", valor: "" }); cargar();
  }
  async function toggle(d: Desc) { await sb.from("discount").update({ activo: !d.activo }).eq("id", d.id); cargar(); }
  async function del(id: string) { await sb.from("discount").delete().eq("id", id); cargar(); }
  const fmt = (d: Desc) => d.tipo === "PORCENTAJE" ? `${d.valor}%` : `${Number(d.valor).toFixed(2)} €`;

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Descuentos" description="Descuentos que el camarero podrá aplicar en el TPV (por % o por importe)." />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input className="w-56" placeholder="Nombre (Menú día, Personal…)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PORCENTAJE">Porcentaje %</SelectItem>
                <SelectItem value="IMPORTE">Importe €</SelectItem>
              </SelectContent>
            </Select>
            <Input className="w-24" placeholder={f.tipo === "PORCENTAJE" ? "%" : "€"} inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
            <Button><Plus className="h-4 w-4" /> Añadir</Button>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState title="Sin descuentos" description="Crea descuentos para aplicarlos al cobrar (p. ej. 10% personal, 2 € fidelidad)." />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {list.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={d.activo ? "" : "text-muted-foreground line-through"}>{d.nombre}</span>
                  <Badge variant="secondary" className="font-normal">{fmt(d)}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className={d.activo ? "text-emerald-600" : "text-muted-foreground"} onClick={() => toggle(d)} title={d.activo ? "Activo" : "Oculto"}>
                    {d.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(d.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
