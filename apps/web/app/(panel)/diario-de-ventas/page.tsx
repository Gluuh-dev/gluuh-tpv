"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp, Receipt } from "lucide-react";

interface RawOrder {
  numero_pedido: number | null;
  total: number;
  estado: string;
  created_at: string;
}

const eur = (n: number) => n.toFixed(2) + " €";

export default function DiarioDeVentasPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<RawOrder[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("numero_pedido,total,estado,created_at")
        .eq("estado", "COBRADA")
        .order("created_at", { ascending: false })
        .limit(200);
      setFilas((data as RawOrder[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const totalImporte = filas.reduce((s, f) => s + Number(f.total), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Diario de ventas"
        description="Ventas cobradas del día, ordenadas por fecha/hora."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Nº ventas"
          value={loading ? "…" : String(filas.length)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total"
          value={loading ? "…" : eur(totalImporte)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay ventas cobradas registradas."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/hora</TableHead>
                  <TableHead className="text-right">Nº</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">
                      {new Date(f.created_at).toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.numero_pedido ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
                        {f.estado}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{eur(Number(f.total))}</TableCell>
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
