"use client";

import * as React from "react";
import { toast } from "@/app/lib/toast";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Reserva {
  id: string;
  table_id: string | null;
  fecha_hora: string;
  comensales: number | null;
  estado: string | null;
  notas: string | null;
  nombre: string | null;
}
interface Mesa { id: string; nombre: string }

type Filtro = "hoy" | "manana" | "semana" | "todas";
const FILTROS: { key: Filtro; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "manana", label: "Mañana" },
  { key: "semana", label: "Esta semana" },
  { key: "todas", label: "Todas las próximas" },
];
const ESTADOS = ["CONFIRMADA", "PENDIENTE", "CANCELADA"] as const;
const SIN_MESA = "__none__";

// Chip de estado: verde confirmada, ámbar pendiente, muted/tachado cancelada.
function claseEstado(estado: string) {
  if (estado === "CONFIRMADA") return "bg-emerald-500/15 text-emerald-500";
  if (estado === "PENDIENTE") return "bg-amber-500/15 text-amber-500";
  return "bg-muted text-muted-foreground line-through"; // CANCELADA (u otro)
}

const pad = (n: number) => String(n).padStart(2, "0");
// ISO → valor de <input type="datetime-local"> en hora local.
function isoAInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FormState { nombre: string; table_id: string; fecha_hora: string; comensales: string; notas: string; estado: string }
const FORM_VACIO: FormState = { nombre: "", table_id: "", fecha_hora: "", comensales: "2", notas: "", estado: "CONFIRMADA" };

export default function ReservasPage() {
  const sb = React.useMemo(() => supabaseBrowser(), []);
  const [reservas, setReservas] = React.useState<Reserva[]>([]);
  const [mesas, setMesas] = React.useState<Mesa[]>([]);
  const [tenantId, setTenantId] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [filtro, setFiltro] = React.useState<Filtro>("hoy");
  const [verCanceladas, setVerCanceladas] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(FORM_VACIO);

  const cargar = React.useCallback(async () => {
    const { data: loc } = await sb.from("location").select("id,tenant_id").limit(1).maybeSingle();
    const l = loc as { id: string; tenant_id: string } | null;
    setLocationId(l?.id ?? "");
    setTenantId(l?.tenant_id ?? "");
    const [{ data: r }, { data: m }] = await Promise.all([
      sb.from("reservation").select("id,table_id,fecha_hora,comensales,estado,notas,nombre").order("fecha_hora"),
      sb.from("restaurant_table").select("id,nombre").order("nombre"),
    ]);
    setReservas((r as Reserva[]) ?? []);
    setMesas((m as Mesa[]) ?? []);
  }, [sb]);
  React.useEffect(() => { (async () => { await cargar(); setLoading(false); })(); }, [cargar]);

  const nombreMesa = React.useCallback(
    (id: string | null) => (id ? mesas.find((m) => m.id === id)?.nombre ?? "—" : "—"),
    [mesas],
  );

  // Filtro por rango de fecha (cliente) + exclusión de canceladas.
  const visibles = React.useMemo(() => {
    const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
    const inicioManana = new Date(inicioHoy); inicioManana.setDate(inicioManana.getDate() + 1);
    const inicioPasado = new Date(inicioManana); inicioPasado.setDate(inicioPasado.getDate() + 1);
    // Fin de semana: próximo domingo a las 23:59 (semana ES empieza en lunes).
    const finSemana = new Date(inicioHoy);
    finSemana.setDate(finSemana.getDate() + ((7 - inicioHoy.getDay()) % 7));
    finSemana.setHours(23, 59, 59, 999);

    const enRango = (fh: string) => {
      const t = new Date(fh);
      if (filtro === "todas") return t >= inicioHoy;
      if (filtro === "manana") return t >= inicioManana && t < inicioPasado;
      if (filtro === "semana") return t >= inicioHoy && t <= finSemana;
      return t >= inicioHoy && t < inicioManana; // hoy
    };
    return reservas.filter((r) => {
      const est = (r.estado ?? "").toUpperCase();
      if (!verCanceladas && est === "CANCELADA") return false;
      return enRango(r.fecha_hora);
    });
  }, [reservas, filtro, verCanceladas]);

  function abrirNueva() {
    setEditId(null);
    setForm(FORM_VACIO);
    setOpen(true);
  }
  function abrirEditar(r: Reserva) {
    setEditId(r.id);
    setForm({
      nombre: r.nombre ?? "",
      table_id: r.table_id ?? "",
      fecha_hora: isoAInput(r.fecha_hora),
      comensales: r.comensales != null ? String(r.comensales) : "",
      notas: r.notas ?? "",
      estado: (r.estado ?? "CONFIRMADA").toUpperCase(),
    });
    setOpen(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fecha_hora) { toast.error("Falta la fecha y hora"); return; }
    const payload = {
      nombre: form.nombre.trim() || null,
      table_id: form.table_id || null,
      fecha_hora: new Date(form.fecha_hora).toISOString(),
      comensales: Math.max(1, Number(form.comensales) || 2),
      notas: form.notas.trim() || null,
      estado: form.estado,
    };
    const { error } = editId
      ? await sb.from("reservation").update(payload).eq("id", editId)
      : await sb.from("reservation").insert({ tenant_id: tenantId, location_id: locationId, ...payload });
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    toast.success(editId ? "Reserva guardada" : "Reserva creada");
    cargar();
  }
  async function cancelarReserva() {
    if (!editId) return;
    const { error } = await sb.from("reservation").update({ estado: "CANCELADA" }).eq("id", editId);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    toast.success("Reserva cancelada");
    cargar();
  }
  async function eliminar() {
    if (!editId) return;
    if (!confirm("¿Eliminar esta reserva definitivamente?")) return;
    const { error } = await sb.from("reservation").delete().eq("id", editId);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    toast.success("Reserva eliminada");
    cargar();
  }

  const nuevaBtn = (
    <Button onClick={abrirNueva}><Plus className="h-4 w-4" /> Nueva reserva</Button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Reservas" description="Reservas de mesa por día. También se crean desde el plano del TPV." actions={nuevaBtn} />

      {/* Filtros de fecha + toggle de canceladas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por fecha">
          {FILTROS.map((f) => (
            <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"}
              aria-pressed={filtro === f.key} onClick={() => setFiltro(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-(--text-muted)">
          <Switch checked={verCanceladas} onCheckedChange={setVerCanceladas} aria-label="Ver reservas canceladas" />
          Ver canceladas
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState title="No hay reservas para este día"
          description="Cambia el filtro de fecha o crea una nueva reserva."
          action={nuevaBtn} />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Hora</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Mesa</TableHead>
                  <TableHead className="w-20">Comensales</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r) => {
                  const est = (r.estado ?? "").toUpperCase();
                  const hora = new Date(r.fecha_hora).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <TableRow
                      key={r.id}
                      role="button" tabIndex={0}
                      aria-label={`Reserva ${r.nombre ?? "sin nombre"} a las ${hora}`}
                      onClick={() => abrirEditar(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirEditar(r); } }}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono tabular-nums">{hora}</TableCell>
                      <TableCell className="font-medium">{r.nombre || <span className="text-(--text-muted)">—</span>}</TableCell>
                      <TableCell className="text-(--text-muted)">{nombreMesa(r.table_id)}</TableCell>
                      <TableCell className="tabular-nums text-(--text-muted)">{r.comensales ?? "—"}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium", claseEstado(est))}>
                          {est || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-(--text-muted)">{r.notas || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar reserva" : "Nueva reserva"}</DialogTitle></DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-nombre">Nombre</Label>
              <Input id="r-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="A nombre de…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-fecha">Fecha y hora *</Label>
                <Input id="r-fecha" type="datetime-local" value={form.fecha_hora} onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-pax">Comensales</Label>
                <Input id="r-pax" type="number" min={1} value={form.comensales} onChange={(e) => setForm({ ...form, comensales: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mesa</Label>
                <Select value={form.table_id || SIN_MESA} onValueChange={(v) => setForm({ ...form, table_id: v === SIN_MESA ? "" : v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sin mesa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_MESA}>Sin mesa</SelectItem>
                    {mesas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-notas">Notas</Label>
              <Textarea id="r-notas" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Alergias, trona, terraza…" />
            </div>

            <DialogFooter className="sm:justify-between">
              {editId ? (
                <Button type="button" variant="destructive" onClick={eliminar}><Trash2 className="h-4 w-4" /> Eliminar</Button>
              ) : <span />}
              <div className="flex gap-2">
                {editId && form.estado !== "CANCELADA" && (
                  <Button type="button" variant="outline" onClick={cancelarReserva}>Cancelar reserva</Button>
                )}
                {!editId && <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>}
                <Button type="submit">{editId ? "Guardar" : "Crear"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
