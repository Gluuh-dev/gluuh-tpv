"use client";

// Series de documento — gestor multi-serie sobre `invoice_series` (código,
// descripción, tipo y predeterminada por tipo) en la tabla reutilizable del
// panel. Columnas tipo/predeterminada/activa vienen de la 0055; si no está
// aplicada, cae a editar `location.serie_factura` con aviso ámbar.
// ponytail: la facturación aún lee location.serie_factura; migrará a elegir
// serie de esta tabla por tipo más adelante.
import { useEffect, useState } from "react";
import { Plus, Star, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { TablaDatos, type ColumnaDatos } from "@/components/tabla-datos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";

// prefijo = código de serie; nombre = descripción legible.
interface Serie { id: string; nombre: string; prefijo: string | null; tipo: string; predeterminada: boolean; activa: boolean }
const TIPOS = [
  { v: "FACTURA", t: "Factura" }, { v: "TICKET", t: "Ticket" },
  { v: "ABONO", t: "Abono" }, { v: "PRESUPUESTO", t: "Presupuesto" },
];
const tipoLabel = (v: string) => TIPOS.find((t) => t.v === v)?.t ?? v;
const siNo = (v: boolean) => (v ? "Sí" : "No");

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
    setF({ codigo: "", descripcion: "", tipo: "FACTURA" }); await cargar();
  }
  // ponytail: "una predeterminada por tipo" se garantiza desde la UI (RLS acota
  // el update al tenant); sin índice único parcial hasta que haga falta forzarlo.
  async function marcarPredeterminada(s: Serie) {
    if (s.predeterminada) { await sb.from("invoice_series").update({ predeterminada: false }).eq("id", s.id); }
    else {
      await sb.from("invoice_series").update({ predeterminada: false }).eq("tipo", s.tipo).eq("predeterminada", true);
      await sb.from("invoice_series").update({ predeterminada: true }).eq("id", s.id);
    }
    await cargar();
  }
  async function toggleActiva(s: Serie) { await sb.from("invoice_series").update({ activa: !s.activa }).eq("id", s.id); await cargar(); }
  async function del(s: Serie) {
    const { error } = await sb.from("invoice_series").delete().eq("id", s.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    await cargar();
  }
  async function duplicar(s: Serie) {
    const { error } = await sb.from("invoice_series").insert({
      tenant_id: tenantId, prefijo: s.prefijo ? `${s.prefijo}C` : null,
      nombre: `${s.nombre} - copia`, tipo: s.tipo,
    });
    if (error) { toast.error(`No se pudo duplicar: ${error.message}`); return; }
    await cargar();
  }

  async function guardarSerieFactura() {
    if (!locId) return;
    await sb.from("location").update({ serie_factura: serieFactura.trim() || "F" }).eq("id", locId);
    setGuardado(true); setTimeout(() => setGuardado(false), 2000);
  }

  const columnas: ColumnaDatos<Serie>[] = [
    {
      clave: "codigo", titulo: "Código", valor: (s) => s.prefijo,
      render: (s) => <span className={`font-mono font-semibold ${s.activa ? "" : "text-muted-foreground line-through"}`}>{s.prefijo || "—"}</span>,
    },
    { clave: "descripcion", titulo: "Descripción", valor: (s) => s.nombre, render: (s) => <span className={s.activa ? "" : "text-muted-foreground line-through"}>{s.nombre}</span> },
    { clave: "tipo", titulo: "Tipo", valor: (s) => tipoLabel(s.tipo) },
    {
      clave: "predeterminada", titulo: "Predeterminada", alinear: "centro",
      valor: (s) => siNo(s.predeterminada),
      render: (s) => (
        <button type="button" onClick={() => marcarPredeterminada(s)}
          className={`inline-flex items-center gap-1 ${s.predeterminada ? "text-amber-500" : "text-muted-foreground/60 hover:text-amber-500"}`}
          title={s.predeterminada ? `Predeterminada de ${tipoLabel(s.tipo)}` : "Marcar como predeterminada"}>
          <Star className="h-4 w-4" fill={s.predeterminada ? "currentColor" : "none"} />
        </button>
      ),
    },
    {
      clave: "activa", titulo: "Activa", alinear: "centro",
      valor: (s) => siNo(s.activa),
      render: (s) => (
        <button type="button" onClick={() => toggleActiva(s)}
          className={s.activa ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground hover:text-foreground"}
          title={s.activa ? "Activa (clic para desactivar)" : "Inactiva (clic para activar)"}>
          {siNo(s.activa)}
        </button>
      ),
    },
  ];

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

  // ── Gestor multi-serie (tabla a alto completo) ─────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title="Series de documento" description="Series para numerar facturas, tickets, abonos y presupuestos. Marca una predeterminada por tipo." />

      {/* Alta de serie: fila alineada con la tabla (sin tarjeta aparte). */}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <Input className="w-28" placeholder="Código (F)" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
        <Input className="w-56" placeholder="Descripción (Facturas)" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.t}</SelectItem>)}</SelectContent>
        </Select>
        <Button><Plus className="h-4 w-4" /> Añadir</Button>
      </form>

      <TablaDatos
        columnas={columnas}
        filas={list}
        idDe={(s) => s.id}
        onCopiar={duplicar}
        onEliminar={del}
        exportarNombre="series"
        vacio="Sin series. Añade tu primera (por ejemplo código «F» de tipo Factura)."
      />
    </div>
  );
}
