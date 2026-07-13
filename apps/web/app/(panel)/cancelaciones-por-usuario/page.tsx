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
import { Users, XCircle } from "lucide-react";
import { eur } from "@/app/lib/money";

interface RawOrder {
  user_id: string | null;
  total: number;
}

interface RawUser {
  id: string;
  nombre: string;
}

interface FilaCancelacion {
  nombre: string;
  canceladas: number;
  importe: number;
}


function agruparCancelaciones(orders: RawOrder[], userMap: Record<string, string>): FilaCancelacion[] {
  const acc: Record<string, { canceladas: number; importe: number }> = {};
  for (const o of orders) {
    const key = o.user_id ?? "__null__";
    if (!acc[key]) acc[key] = { canceladas: 0, importe: 0 };
    acc[key]!.canceladas += 1;
    acc[key]!.importe += Number(o.total);
  }
  return Object.entries(acc)
    .map(([key, v]) => ({
      nombre: key === "__null__" ? "—" : (userMap[key] ?? "—"),
      ...v,
    }))
    .sort((a, b) => b.canceladas - a.canceladas);
}

export default function CancelacionesPorUsuarioPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaCancelacion[]>([]);
  const [rango, setRango] = useState<Rango>(RANGO_DEFECTO);
  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    setLoading(true);
    (async () => {
      const [{ data: ordersData }, { data: usersData }] = await Promise.all([
        sb
          .from("sales_order")
          .select("user_id,total")
          .eq("estado", "ANULADA")
          .gte("created_at", fechaDesde(rango))
          .limit(LIMITE_INFORME),
        sb
          .from("app_user")
          .select("id,nombre"),
      ]);
      const orders = (ordersData as RawOrder[] | null) ?? [];
      setTruncado(orders.length === LIMITE_INFORME);
      const users = (usersData as RawUser[] | null) ?? [];
      const userMap: Record<string, string> = {};
      for (const u of users) {
        userMap[u.id] = u.nombre;
      }
      setFilas(agruparCancelaciones(orders, userMap));
      setLoading(false);
    })();
  }, [rango]);

  const totalCanceladas = filas.reduce((s, f) => s + f.canceladas, 0);
  const totalImporte = filas.reduce((s, f) => s + f.importe, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Cancelaciones por usuario"
        description="Pedidos anulados agrupados por usuario."
      />

      <SelectorRango valor={rango} onCambio={setRango} />
      <AvisoTruncado visible={truncado} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Total cancelaciones"
          value={loading ? "…" : String(totalCanceladas)}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Importe cancelado"
          value={loading ? "…" : eur(totalImporte)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<XCircle className="h-8 w-8" />}
          title="Sin cancelaciones"
          description="No hay pedidos anulados registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Nº canceladas</TableHead>
                  <TableHead className="text-right">Importe €</TableHead>
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
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{f.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.canceladas}</TableCell>
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
