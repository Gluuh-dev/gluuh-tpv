"use client";

// Auditoría: registro SOLO LECTURA de operaciones sensibles, construido con los
// datos que ya existen en sales_order (tipo_operacion != 'VENTA' y estado ANULADA).
// ponytail: sin rastro de descuentos por pedido en el esquema (discount es solo
// catálogo, 0015); cuando sales_order guarde el descuento aplicado, añadir aquí.

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, GraduationCap, ShieldAlert, Trash2, UtensilsCrossed, XCircle, type LucideIcon } from "lucide-react";
import { eur } from "@/app/lib/money";

interface RawEvento {
  id: string;
  tipo_operacion: string;
  estado: string;
  motivo_no_venta: string | null;
  total: number;
  created_at: string;
  canal: string;
  numero_pedido: number | null;
  app_user: { nombre: string } | null;
  restaurant_table: { nombre: string } | null;
}

const TIPO_EVENTO: Record<string, { label: string; icon: LucideIcon; badge: string }> = {
  ANULADA: { label: "Cuenta anulada", icon: XCircle, badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  INVITACION: { label: "Invitación", icon: Gift, badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  AUTOCONSUMO: { label: "Consumo propio", icon: UtensilsCrossed, badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  MERMA: { label: "Merma", icon: Trash2, badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  FORMACION: { label: "Formación", icon: GraduationCap, badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
};

const aFechaInput = (d: Date) => d.toISOString().slice(0, 10);

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditoriaPage() {
  const hoy = new Date();
  const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [desde, setDesde] = useState(aFechaInput(hace7));
  const [hasta, setHasta] = useState(aFechaInput(hoy));
  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState<RawEvento[]>([]);

  useEffect(() => {
    if (!desde || !hasta) return;
    const sb = supabaseBrowser();
    setLoading(true);
    (async () => {
      // Fin exclusivo: día "hasta" completo.
      const fin = new Date(hasta + "T00:00:00");
      fin.setDate(fin.getDate() + 1);
      const { data } = await sb
        .from("sales_order")
        .select("id,tipo_operacion,estado,motivo_no_venta,total,created_at,canal,numero_pedido,app_user(nombre),restaurant_table(nombre)")
        .or("tipo_operacion.neq.VENTA,estado.eq.ANULADA")
        .gte("created_at", new Date(desde + "T00:00:00").toISOString())
        .lt("created_at", fin.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      setEventos((data as unknown as RawEvento[] | null) ?? []);
      setLoading(false);
    })();
  }, [desde, hasta]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Auditoría"
        description="Registro de operaciones sensibles: invitaciones, consumos propios, mermas y cuentas anuladas."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="aud-desde">Desde</Label>
          <Input id="aud-desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aud-hasta">Hasta</Label>
          <Input id="aud-hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="w-40" />
        </div>
      </div>

      {!loading && eventos.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" />}
          title="Sin operaciones sensibles"
          description="No hay invitaciones, consumos propios ni cuentas anuladas en el periodo."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quién</TableHead>
                  <TableHead>Mesa / contexto</TableHead>
                  <TableHead className="text-right">Importe €</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-3">
                      <div className="space-y-2.5">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  eventos.map((e) => {
                    // Una anulación pesa más que el tipo de operación del pedido.
                    const clave = e.estado === "ANULADA" ? "ANULADA" : e.tipo_operacion;
                    const t = TIPO_EVENTO[clave] ?? { label: clave, icon: ShieldAlert, badge: "bg-muted text-muted-foreground" };
                    const Icono = t.icon;
                    const contexto = e.restaurant_table?.nombre ?? (e.numero_pedido ? `${e.canal} · A-${e.numero_pedido}` : e.canal);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">{formatFecha(e.created_at)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${t.badge}`}>
                            <Icono className="h-3.5 w-3.5" /> {t.label}
                          </span>
                        </TableCell>
                        <TableCell>{e.app_user?.nombre ?? "—"}</TableCell>
                        <TableCell>{contexto}</TableCell>
                        <TableCell className="text-right tabular-nums">{eur(Number(e.total))}</TableCell>
                        <TableCell className="text-muted-foreground">{e.motivo_no_venta ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
