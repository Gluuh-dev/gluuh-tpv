"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Gift, TrendingDown } from "lucide-react";

interface RawInvitacion {
  total: number;
  created_at: string;
}

interface FilaInvitacion {
  fecha: string;
  importe: number;
}

const eur = (n: number) => n.toFixed(2) + " €";

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InvitacionesPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaInvitacion[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("total,created_at")
        .eq("tipo_operacion", "INVITACION")
        .order("created_at", { ascending: false })
        .limit(200);
      const rows = (data as RawInvitacion[] | null) ?? [];
      setFilas(rows.map((r) => ({ fecha: r.created_at, importe: Number(r.total) })));
      setLoading(false);
    })();
  }, []);

  const nInvitaciones = filas.length;
  const totalImporte = filas.reduce((s, f) => s + f.importe, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Invitaciones"
        description="Pedidos registrados como invitación (últimos 200)."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Gift className="h-4 w-4" />}
          label="Nº invitaciones"
          value={loading ? "…" : String(nInvitaciones)}
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Importe total"
          value={loading ? "…" : eur(totalImporte)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-8 w-8" />}
          title="Sin invitaciones"
          description="No hay pedidos de tipo invitación registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Importe €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">{formatFecha(f.fecha)}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f.importe)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
