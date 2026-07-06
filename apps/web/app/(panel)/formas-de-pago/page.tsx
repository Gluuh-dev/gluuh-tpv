"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AvisoTruncado, fechaDesde, LIMITE_INFORME, RANGO_DEFECTO, SelectorRango, type Rango } from "@/components/selector-rango";
import { Landmark, CreditCard } from "lucide-react";

interface RawPayment {
  metodo: string;
  importe: number;
}

interface MetodoPago {
  metodo: string;
  nPagos: number;
  total: number;
}

const eur = (n: number) => n.toFixed(2) + " €";

function agruparPorMetodo(payments: RawPayment[]): MetodoPago[] {
  const acc: Record<string, { nPagos: number; total: number }> = {};
  for (const p of payments) {
    const metodo = p.metodo ?? "(desconocido)";
    if (!acc[metodo]) acc[metodo] = { nPagos: 0, total: 0 };
    acc[metodo]!.nPagos += 1;
    acc[metodo]!.total += Number(p.importe);
  }
  return Object.entries(acc)
    .map(([metodo, v]) => ({ metodo, ...v }))
    .sort((a, b) => b.total - a.total);
}

export default function FormasDePagoPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<MetodoPago[]>([]);
  const [rango, setRango] = useState<Rango>(RANGO_DEFECTO);
  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    setLoading(true);
    (async () => {
      const { data } = await sb
        .from("payment")
        .select("metodo,importe")
        .gte("created_at", fechaDesde(rango))
        .limit(LIMITE_INFORME);
      const rows = (data as RawPayment[] | null) ?? [];
      setTruncado(rows.length === LIMITE_INFORME);
      setFilas(agruparPorMetodo(rows));
      setLoading(false);
    })();
  }, [rango]);

  const totalCobrado = filas.reduce((s, f) => s + f.total, 0);
  const nPagos = filas.reduce((s, f) => s + f.nPagos, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Formas de pago"
        description="Cobros agrupados por método de pago."
      />

      <SelectorRango valor={rango} onCambio={setRango} />
      <AvisoTruncado visible={truncado} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Landmark className="h-4 w-4" />}
          label="Total cobrado"
          value={loading ? "…" : eur(totalCobrado)}
        />
        <StatCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Nº pagos"
          value={loading ? "…" : String(nPagos)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay pagos registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Nº pagos</TableHead>
                  <TableHead className="text-right">Total €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-3">
                      <div className="space-y-2.5">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filas.map((f) => (
                  <TableRow key={f.metodo}>
                    <TableCell className="font-medium">{f.metodo}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.nPagos}</TableCell>
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
