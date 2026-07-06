"use client";

// Series de documento — gestor multi-serie sobre `invoice_series` (código,
// descripción, tipo y predeterminada por tipo). Columnas tipo/predeterminada/
// activa vienen de la migración 0055; si no está aplicada, la página cae a
// editar `location.serie_factura` (lo que usa la facturación hoy) con aviso
// ámbar — patrón de ordenar-productos.
// ponytail: la facturación aún lee location.serie_factura; migrará a elegir
// serie de esta tabla por tipo más adelante.
import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Star, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

// prefijo = código de serie; nombre = descripción legible.
interface Serie { id: string; nombre: string; prefijo: string | null; tipo: string; predeterminada: boolean; activa: boolean }
const TIPOS = [
  { v: "FACTURA", t: "Factura" }, { v: "TICKET", t: "Ticket" },
  { v: "ABONO", t: "Abono" }, { v: "PRESUPUESTO", t: "Presupuesto" },
];
const tipoLabel = (v: string) => TIPOS.find((t) => t.v === v)?.t ?? v;

export default function Series() {
  const sb = supabaseBrowser();
  const [tenantId, setTenantId] = useState("");
  const [list, setList] = useState<Serie[]>([]);
  const [f, setF] = useState({ codigo: "", descripcion: "", tipo: "FACTURA" });
  const [loading, setLoading] = useState(true);
  const [gestor, setGestor] = useState(true); // false si 0055 no está aplicada
  // Fallback (0055 sin aplicar): editar la serie única de location.serie_factura.
  const [locId, setLocId] = useState<string | null>(null);
  const [serieFactura, setSerieFactura] = useState("");
  const [guardado, setGuardado] = useState(false);

  async function cargar() {
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    setTenantId((t as { id: string } | null)?.id ?? "");
    const conTipo = await sb.from("invoice_series").select("id,nombre,prefijo,tipo,predeterminada,activa").order("tipo").order("prefijo");
    if (conTipo.error) {
      setGestor(false);
      const { data: l } = await sb.from("location").select("id,serie_factura").limit(1).maybeSingle();
      setLocId((l as { id: string } | null)?.id ?? null);
      setSerieFactura((l as { serie_factura?: string } | null)?.serie_factura ?? "F");
    } else {
      setList((conTipo.data as Serie[]) ?? []);
    }
  }
  useEffect(() => { (async () => { await cargar(); setLoading(false); })(); /* eslint-disable-next-line */ }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const codigo = f.codigo.trim();
    if (!codigo) return;
    await sb.from("invoice_series").insert({
      tenant_id: tenantId, prefijo: codigo, nombre: f.descripcion.trim() || codigo, tipo: f.tipo,
    });
    setF({ codigo: "", descripcion: "", tipo: "FACTURA" }); cargar();
  }
  // ponytail: "una predeterminada por tipo" se garantiza desde la UI (RLS acota
  // el update al tenant); sin índice único parcial hasta que haga falta forzarlo.
  async function marcarPredeterminada(s: Serie) {
    if (s.predeterminada) { await sb.from("invoice_series").update({ predeterminada: false }).eq("id", s.id); }
    else {
      await sb.from("invoice_series").update({ predeterminada: false }).eq("tipo", s.tipo).eq("predeterminada", true);
      await sb.from("invoice_series").update({ predeterminada: true }).eq("id", s.id);
    }
    cargar();
  }
  async function toggleActiva(s: Serie) { await sb.from("invoice_series").update({ activa: !s.activa }).eq("id", s.id); cargar(); }
  async function del(id: string) { await sb.from("invoice_series").delete().eq("id", id); cargar(); }

  async function guardarSerieFactura() {
    if (!locId) return;
    await sb.from("location").update({ serie_factura: serieFactura.trim() || "F" }).eq("id", locId);
    setGuardado(true); setTimeout(() => setGuardado(false), 2000);
  }

  if (loading) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Series de documento" description="Series para numerar facturas, tickets, abonos y presupuestos. Marca una predeterminada por tipo." />
      <TableSkeleton rows={5} />
    </div>
  );

  // ── Fallback: 0055 sin aplicar → editar location.serie_factura ─────────────
  if (!gestor) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Series de facturación" description="Serie con la que se numeran tus facturas." />
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0055</strong> (columnas <code>tipo</code>/<code>predeterminada</code>
            en <code>invoice_series</code>). Mientras tanto puedes editar la serie única de facturación.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="space-y-1.5">
              <label className="text-[13px] text-(--text-secondary)">Serie de factura</label>
              <Input className="w-40" value={serieFactura} onChange={(e) => setSerieFactura(e.target.value)} placeholder="F" />
            </div>
            <Button onClick={guardarSerieFactura}>Guardar</Button>
            {guardado && <span className="text-sm text-emerald-600">Guardado</span>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Gestor multi-serie ─────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Series de documento" description="Series para numerar facturas, tickets, abonos y presupuestos. Marca una predeterminada por tipo." />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input className="w-28" placeholder="Código (F)" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
            <Input className="w-56" placeholder="Descripción (Facturas)" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.t}</SelectItem>)}</SelectContent>
            </Select>
            <Button><Plus className="h-4 w-4" /> Añadir</Button>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <EmptyState title="Sin series" description="Añade tu primera serie (por ejemplo código «F» de tipo Factura)." />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {list.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-sm font-semibold ${s.activa ? "" : "text-muted-foreground line-through"}`}>{s.prefijo || "—"}</span>
                  <span className={s.activa ? "text-(--text-secondary)" : "text-muted-foreground line-through"}>{s.nombre}</span>
                  <Badge variant="secondary" className="font-normal">{tipoLabel(s.tipo)}</Badge>
                  {s.predeterminada && <Badge className="bg-brand/15 font-normal text-brand">Predeterminada</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={s.predeterminada ? "Quitar predeterminada" : "Marcar predeterminada"}
                    title={s.predeterminada ? `Predeterminada de ${tipoLabel(s.tipo)}` : "Marcar como predeterminada"}
                    className={s.predeterminada ? "text-amber-500" : "text-muted-foreground/50"} onClick={() => marcarPredeterminada(s)}>
                    <Star className="h-4 w-4" fill={s.predeterminada ? "currentColor" : "none"} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={s.activa ? "Ocultar" : "Mostrar"} title={s.activa ? "Activa" : "Inactiva"}
                    className={s.activa ? "text-emerald-600" : "text-muted-foreground"} onClick={() => toggleActiva(s)}>
                    {s.activa ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Eliminar" className="text-destructive" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
