"use client";

import * as React from "react";
import { toast } from "@/app/lib/toast";
import { Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

export type CrudRow = Record<string, unknown>;
export interface CrudField {
  name: string; label: string;
  type?: "text" | "email" | "tel" | "textarea" | "number" | "select" | "switch" | "date";
  required?: boolean; placeholder?: string;
  options?: { value: string; label: string }[]; // solo type "select"
  defaultValue?: string | number | boolean;
}
export interface CrudColumn {
  name: string; label: string;
  /** Render a medida; si no se define se aplica formato automático. */
  render?: (row: CrudRow) => React.ReactNode;
  /** Pinta el valor como chip (bg-surface-muted). */
  badge?: boolean;
}
export interface CrudConfig {
  table: string; titulo: string; descripcion: string; singular: string; nuevo?: string;
  fields: CrudField[]; columns: CrudColumn[];
}
type Row = CrudRow;

/** Formato por defecto de una celda: booleano, fecha ISO, vacío y chip. */
function formatCell(value: unknown, badge?: boolean): React.ReactNode {
  if (typeof value === "boolean")
    return value ? <span className="text-emerald-500">✓</span> : <span className="text-(--text-muted)">—</span>;
  if (value == null || value === "") return <span className="text-(--text-muted)">—</span>;
  let text = String(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) text = d.toLocaleDateString("es-ES");
  }
  if (badge)
    return <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 text-[12px]">{text}</span>;
  return text;
}

export function CrudPage({ config }: { config: CrudConfig }) {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<string, unknown>>({});
  const [q, setQ] = React.useState("");

  const cargar = React.useCallback(async () => {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const { data } = await sb.from(config.table).select("*").order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  }, [sb, config.table]);
  React.useEffect(() => { (async () => { await cargar(); setLoading(false); })(); }, [cargar]);

  function valorInicial(f: CrudField): unknown {
    if (f.defaultValue !== undefined) return f.defaultValue;
    return f.type === "switch" ? false : "";
  }
  function abrirNuevo() {
    setEditId(null);
    setForm(Object.fromEntries(config.fields.map((f) => [f.name, valorInicial(f)])));
    setOpen(true);
  }
  function abrirEditar(r: Row) {
    setEditId(r.id as string);
    setForm(Object.fromEntries(config.fields.map((f) =>
      [f.name, f.type === "switch" ? !!r[f.name] : (r[f.name] ?? "")])));
    setOpen(true);
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of config.fields) {
      const v = form[f.name];
      if (f.type === "switch") { payload[f.name] = !!v; continue; }
      const s = typeof v === "string" ? v.trim() : v;
      if (f.type === "number") { const n = Number(s); payload[f.name] = s === "" || s == null || !Number.isFinite(n) ? null : n; continue; }
      payload[f.name] = (s ?? "") === "" ? null : s;
    }
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

  if (loading) return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={config.titulo} description={config.descripcion} />
      <TableSkeleton rows={6} />
    </div>
  );

  const filtro = q.trim().toLowerCase();
  const visibles = filtro
    ? rows.filter((r) => config.columns.some((c) => String(r[c.name] ?? "").toLowerCase().includes(filtro)))
    : rows;

  const sv = (name: string) => String(form[name] ?? "");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={config.titulo} description={config.descripcion}
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo {config.singular}</Button>} />

      {rows.length === 0 ? (
        <EmptyState title={`Sin ${config.titulo.toLowerCase()}`} description={`Crea tu primer ${config.singular} con el botón de arriba.`}
          action={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" /> Nuevo {config.singular}</Button>} />
      ) : (
        <div className="space-y-3">
          {rows.length > 8 && (
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="max-w-xs" />
          )}
          <Card>
            <CardContent className="px-0 py-0">
              <Table>
                <TableHeader><TableRow>{config.columns.map((c) => <TableHead key={c.name}>{c.label}</TableHead>)}<TableHead className="w-12"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {visibles.length === 0 ? (
                    <TableRow><TableCell colSpan={config.columns.length + 1} className="text-(--text-muted)">Sin resultados.</TableCell></TableRow>
                  ) : visibles.map((r) => (
                    <TableRow
                      key={r.id as string}
                      role="button" tabIndex={0}
                      onClick={() => abrirEditar(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirEditar(r); } }}
                      className="cursor-pointer hover:bg-surface-overlay"
                    >
                      {config.columns.map((c, i) => (
                        <TableCell key={c.name} className={i === 0 ? "font-medium" : "text-(--text-muted)"}>
                          {c.render ? c.render(r) : formatCell(r[c.name], c.badge)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Eliminar"
                          onClick={(e) => { e.stopPropagation(); borrar(r.id as string); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}</DialogTitle></DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            {config.fields.map((f) => {
              if (f.type === "switch") return (
                <div key={f.name} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                  <Label className="text-[13px]">{f.label}</Label>
                  <button
                    type="button" role="switch" aria-checked={!!form[f.name]} aria-label={f.label}
                    onClick={() => setForm({ ...form, [f.name]: !form[f.name] })}
                    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${form[f.name] ? "bg-brand" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form[f.name] ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              );
              return (
                <div key={f.name} className="space-y-1.5">
                  <Label>{f.label}{f.required && " *"}</Label>
                  {f.type === "textarea" ? (
                    <Textarea rows={2} value={sv(f.name)} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} />
                  ) : f.type === "select" ? (
                    <Select value={sv(f.name)} onValueChange={(v) => setForm({ ...form, [f.name]: v })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder={f.placeholder ?? "Selecciona…"} /></SelectTrigger>
                      <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input type={f.type ?? "text"} value={sv(f.name)} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={f.placeholder} required={f.required} />
                  )}
                </div>
              );
            })}
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
