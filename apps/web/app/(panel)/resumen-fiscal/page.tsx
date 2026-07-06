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
import { Receipt, Calculator, Coins } from "lucide-react";

interface RawLine {
  cantidad: number;
  precio_unitario: number;
  tipo_impositivo: number;
}

interface FilaFiscal {
  tipo: number;
  base: number;
  cuota: number;
  total: number;
}

const eur = (n: number) => n.toFixed(2) + " €";

function agruparPorTipo(lines: RawLine[]): FilaFiscal[] {
  const acc: Record<number, { base: number; cuota: number; total: number }> = {};
  for (const l of lines) {
    const tipo = Number(l.tipo_impositivo);
    const importe = Number(l.cantidad) * Number(l.precio_unitario);
    const base = Math.round((importe / (1 + tipo / 100)) * 100) / 100;
    const cuota = Math.round((importe - base) * 100) / 100;
    if (!acc[tipo]) acc[tipo] = { base: 0, cuota: 0, total: 0 };
    acc[tipo]!.base += base;
    acc[tipo]!.cuota += cuota;
    acc[tipo]!.total += importe;
  }
  return Object.entries(acc)
    .map(([tipo, v]) => ({ tipo: Number(tipo), ...v }))
    .sort((a, b) => a.tipo - b.tipo);
}

export default function ResumenFiscalPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaFiscal[]>([]);
  const [rango, setRango] = useState<Rango>(RANGO_DEFECTO);
  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    setLoading(true);
    (async () => {
      const { data } = await sb
        .from("order_line")
        .select("cantidad,precio_unitario,tipo_impositivo")
        .gte("created_at", fechaDesde(rango))
        .limit(LIMITE_INFORME);
      const rows = (data as RawLine[] | null) ?? [];
      setTruncado(rows.length === LIMITE_INFORME);
      setFilas(agruparPorTipo(rows));
      setLoading(false);
    })();
  }, [rango]);

  const baseTotal = filas.reduce((s, f) => s + f.base, 0);
  const cuotaTotal = filas.reduce((s, f) => s + f.cuota, 0);
  const totalGeneral = filas.reduce((s, f) => s + f.total, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Resumen fiscal"
        description="Desglose de base imponible y cuota por tipo impositivo."
      />

      <SelectorRango valor={rango} onCambio={setRango} />
      <AvisoTruncado visible={truncado} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Calculator className="h-4 w-4" />}
          label="Base total"
          value={loading ? "…" : eur(baseTotal)}
        />
        <StatCard
          icon={<Receipt className="h-4 w-4" />}
          label="Cuota total"
          value={loading ? "…" : eur(cuotaTotal)}
        />
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Total general"
          value={loading ? "…" : eur(totalGeneral)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay líneas de pedido registradas."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo %</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Cuota</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-3">
                      <div className="space-y-2.5">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filas.map((f) => (
                  <TableRow key={f.tipo}>
                    <TableCell className="font-medium tabular-nums">{f.tipo} %</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f.base)}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f.cuota)}</TableCell>
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
