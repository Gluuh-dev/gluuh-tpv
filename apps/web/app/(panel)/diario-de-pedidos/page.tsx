"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShoppingCart } from "lucide-react";

interface RawOrder {
  numero_pedido: number | null;
  canal: string;
  estado: string;
  total: number;
  created_at: string;
}

const eur = (n: number) => n.toFixed(2) + " €";

export default function DiarioDePedidosPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<RawOrder[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("numero_pedido,canal,estado,total,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setFilas((data as RawOrder[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Diario de pedidos"
        description="Todos los pedidos ordenados por fecha/hora."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Nº pedidos"
          value={loading ? "…" : String(filas.length)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay pedidos registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/hora</TableHead>
                  <TableHead className="text-right">Nº</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
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
                    <TableCell>{f.canal}</TableCell>
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
