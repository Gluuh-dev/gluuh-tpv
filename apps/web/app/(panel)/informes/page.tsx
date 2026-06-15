"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

interface Venta {
  id: string;
  total: number;
  canal: string;
  estado: string;
  created_at: string;
  restaurant_table: { nombre: string } | null;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Informes() {
  const sb = supabaseBrowser();
  const [ventas, setVentas] = useState<Venta[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("id,total,canal,estado,created_at,restaurant_table(nombre)")
        .eq("tipo_operacion", "VENTA")
        .order("created_at", { ascending: false })
        .limit(100);
      setVentas((data as unknown as Venta[]) ?? []);
    })();
    /* eslint-disable-next-line */
  }, []);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const deHoy = ventas.filter((v) => new Date(v.created_at) >= hoy);
  const totalHoy = deHoy.reduce((s, v) => s + Number(v.total), 0);
  const totalTodo = ventas.reduce((s, v) => s + Number(v.total), 0);
  const ticketMedio = ventas.length ? totalTodo / ventas.length : 0;

  const stats = [
    { label: "Pedidos hoy", value: deHoy.length },
    { label: "Ventas hoy", value: eur(totalHoy) },
    { label: "Pedidos (100 últ.)", value: ventas.length },
    { label: "Ticket medio", value: eur(ticketMedio) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Informes"
        description="Resumen de ventas (en tiempo real desde tu base de datos)."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Fecha</TableHead><TableHead>Origen</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ventas.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aún no hay ventas registradas.</TableCell></TableRow>}
              {ventas.slice(0, 30).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</TableCell>
                  <TableCell>{v.restaurant_table?.nombre ?? v.canal}</TableCell>
                  <TableCell><Badge variant="secondary">{v.estado}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{eur(v.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
