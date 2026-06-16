"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export interface CrudField { name: string; label: string; type?: "text" | "email" | "tel" | "textarea"; required?: boolean; placeholder?: string }
export interface CrudConfig {
  table: string; titulo: string; descripcion: string; singular: string;
  fields: CrudField[]; columns: { name: string; label: string }[];
}
type Row = Record<string, unknown>;

export function CrudPage({ config }: { config: CrudConfig }) {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({});

  const cargar = React.useCallback(async () => {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const { data } = await sb.from(config.table).select("*").order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  }, [sb, config.table]);
  React.useEffect(() => { (async () => { await cargar(); setLoading(false); })(); }, [cargar]);

  function abrirNuevo() { setEditId(null); setForm({}); setOpen(true); }
  function abrirEditar(r: Row) {
    setEditId(r.id as string);
    setForm(Object.fromEntries(config.fields.map((f) => [f.name, (r[f.name] as string) ?? ""])));
    setOpen(true);
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) payload[f.name] = form[f.name]?.trim() || null;
    if (!payload[config.fields[0]!.name]) { toast.error(`Falta ${config.fields[0]!.label.toLowerCase()}`); return; }
    const { error } = editId
      ? await sb.from(config.table).update(payload).eq("id", editId)
      : await sb.from(config.table).insert({ tenant_id: tenantId, ...payload });
    if (error) { toast.error(error.message); return; }
    setOpen(false); toast.success(editId ? "Guardado" : `${config.singular} creado`); cargar();
  }
  async function borrar(id: string) {
    if (!confirm(`¿Eliminar ${config.singular}?`)) return;
    const { error } = await sb.from(config.table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado"); cargar();
  }

  if (loading) return <div className="text-(--text-muted)">Cargando…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={config.titulo} description={config.descripcion}
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo {config.singular}</Button>} />

      {rows.length === 0 ? (
        <EmptyState title={`Sin ${config.titulo.toLowerCase()}`} description={`Crea tu primer ${config.singular} con el botón de arriba.`}
          action={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo {config.singular}</Button>} />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader><TableRow>{config.columns.map((c) => <TableHead key={c.name}>{c.label}</TableHead>)}<TableHead className="w-20"></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id as string}>
                    {config.columns.map((c, i) => <TableCell key={c.name} className={i === 0 ? "font-medium" : "text-(--text-muted)"}>{(r[c.name] as string) || "—"}</TableCell>)}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => borrar(r.id as string)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}</DialogTitle></DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            {config.fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}{f.required && " *"}</Label>
                {f.type === "textarea"
                  ? <Textarea rows={2} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} />
                  : <Input type={f.type ?? "text"} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} required={f.required} />}
              </div>
            ))}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit">{editId ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
