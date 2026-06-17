"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Coins, ShieldCheck } from "lucide-react";

interface InvoiceRow {
  num_serie_factura: string;
  fecha_expedicion: string;
  importe_total: number;
  huella: string;
  estado_aeat: string;
  created_at: string;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";

const BADGE: Record<string, string> = {
  NO_ENVIADA:   "bg-muted text-muted-foreground",
  ENVIADA:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ACEPTADA:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  RECHAZADA:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function EstadoBadge({ estado }: { estado: string }) {
  const cls = BADGE[estado] ?? BADGE["NO_ENVIADA"]!;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {estado.replace("_", " ")}
    </span>
  );
}

export default function VisorVerifactuPage() {
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<InvoiceRow[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("invoice")
        .select("num_serie_factura,fecha_expedicion,importe_total,huella,estado_aeat,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      setFacturas((data as InvoiceRow[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const importeTotal = facturas.reduce((s, f) => s + Number(f.importe_total), 0);
  const nFacturas = facturas.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Visor de Verifactu"
        description="Registro de facturas encadenadas (huella SHA-256) según el sistema VERIFACTU de la AEAT."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Nº facturas"
          value={loading ? "…" : String(nFacturas)}
        />
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Importe total"
          value={loading ? "…" : eur(importeTotal)}
        />
      </div>

      {!loading && facturas.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="Sin facturas todavía"
          description="Las facturas generadas desde el TPV aparecerán aquí con su huella VERIFACTU."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Importe €</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Huella</TableHead>
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
                {facturas.map((f) => (
                  <TableRow key={f.num_serie_factura}>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {f.num_serie_factura}
                    </TableCell>
                    <TableCell className="tabular-nums">{f.fecha_expedicion}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {eur(Number(f.importe_total))}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={f.estado_aeat} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {f.huella.slice(0, 8)}…
                    </TableCell>
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
