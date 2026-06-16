"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Sparkles } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Forma { id: string; nombre: string; tipo: string; activo: boolean }
const TIPOS = [
  { v: "EFECTIVO", t: "Efectivo" }, { v: "TARJETA", t: "Tarjeta" },
  { v: "BIZUM", t: "Bizum" }, { v: "VALE", t: "Vale" }, { v: "OTRO", t: "Otro" },
];

export default function FormasPago() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [list, setList] = useState<Forma[]>([]);
  const [f, setF] = useState({ nombre: "", tipo: "TARJETA" });
  const [loading, setLoading] = useState(true);

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const { data } = await sb.from("payment_method").select("id,nombre,tipo,activo").order("orden");
    setList((data as Forma[]) ?? []);
  }
  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nombre.trim()) return;
    await sb.from("payment_method").insert({ tenant_id: tenantId, nombre: f.nombre.trim(), tipo: f.tipo, orden: list.length });
    setF({ nombre: "", tipo: "TARJETA" }); cargar();
  }
  async function habituales() {
    await sb.from("payment_method").insert([
      { tenant_id: tenantId, nombre: "Efectivo", tipo: "EFECTIVO", orden: 0 },
      { tenant_id: tenantId, nombre: "Tarjeta", tipo: "TARJETA", orden: 1 },
      { tenant_id: tenantId, nombre: "Bizum", tipo: "BIZUM", orden: 2 },
    ]);
    cargar();
  }
  async function toggle(m: Forma) { await sb.from("payment_method").update({ activo: !m.activo }).eq("id", m.id); cargar(); }
  async function del(id: string) { await sb.from("payment_method").delete().eq("id", id); cargar(); }

  if (loading) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Formas de pago" description="Cómo cobra tu negocio. Se usan en el TPV al cobrar y en el arqueo de caja." />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input className="w-56" placeholder="Nombre (Tarjeta, Ticket Restaurant…)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.t}</SelectItem>)}</SelectContent>
            </Select>
            <Button><Plus className="h-4 w-4" /> Añadir</Button>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState title="Sin formas de pago" description="Añade las tuyas o crea las habituales (Efectivo, Tarjeta, Bizum)."
          action={<Button onClick={habituales}><Sparkles className="h-4 w-4" /> Crear habituales</Button>} />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {list.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={m.activo ? "" : "text-muted-foreground line-through"}>{m.nombre}</span>
                  <Badge variant="secondary" className="font-normal">{m.tipo.toLowerCase()}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title={m.activo ? "Activa" : "Oculta"} className={m.activo ? "text-emerald-600" : "text-muted-foreground"} onClick={() => toggle(m)}>
                    {m.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
