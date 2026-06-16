"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp, Receipt, Coins } from "lucide-react";

interface RawOrder {
  total: number;
  created_at: string;
}

interface VentaDia {
  dia: string;   // YYYY-MM-DD
  tickets: number;
  total: number;
}

const eur = (n: number) => n.toFixed(2) + " €";

function agruparPorDia(orders: RawOrder[]): VentaDia[] {
  const acc: Record<string, { tickets: number; total: number }> = {};
  for (const o of orders) {
    const dia = o.created_at.slice(0, 10); // YYYY-MM-DD
    if (!acc[dia]) acc[dia] = { tickets: 0, total: 0 };
    acc[dia]!.tickets += 1;
    acc[dia]!.total += Number(o.total);
  }
  return Object.entries(acc)
    .map(([dia, v]) => ({ dia, ...v }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

export default function VentasDiariasPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<VentaDia[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("total,created_at")
        .eq("estado", "COBRADA")
        .order("created_at", { ascending: false });
      const rows = (data as RawOrder[] | null) ?? [];
      setFilas(agruparPorDia(rows));
      setLoading(false);
    })();
  }, []);

  const totalAcumulado = filas.reduce((s, f) => s + f.total, 0);
  const totalTickets = filas.reduce((s, f) => s + f.tickets, 0);
  const ticketMedio = totalTickets > 0 ? totalAcumulado / totalTickets : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Ventas diarias"
        description="Tickets cobrados agrupados por día."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total acumulado"
          value={loading ? "…" : eur(totalAcumulado)}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Nº tickets"
          value={loading ? "…" : String(totalTickets)}
        />
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Ticket medio"
          value={loading ? "…" : eur(ticketMedio)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay tickets cobrados registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead className="text-right">Nº tickets</TableHead>
                  <TableHead className="text-right">Total €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {filas.map((f) => (
                  <TableRow key={f.dia}>
                    <TableCell>{f.dia}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.tickets}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f.total)}</TableCell>
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
