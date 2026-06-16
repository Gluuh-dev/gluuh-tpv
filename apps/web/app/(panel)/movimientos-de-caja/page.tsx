"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Coins, TrendingUp } from "lucide-react";

interface RawPayment {
  metodo: string;
  importe: number;
  created_at: string;
}

const eur = (n: number) => n.toFixed(2) + " €";

export default function MovimientosDeCajaPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<RawPayment[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("payment")
        .select("metodo,importe,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setFilas((data as RawPayment[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const totalImporte = filas.reduce((s, f) => s + Number(f.importe), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Movimientos de caja"
        description="Cobros registrados ordenados por fecha/hora."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Nº movimientos"
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
          icon={<Coins className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay movimientos de caja registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/hora</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Importe €</TableHead>
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
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">
                      {new Date(f.created_at).toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell>{f.metodo}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(Number(f.importe))}</TableCell>
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
