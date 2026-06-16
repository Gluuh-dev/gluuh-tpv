"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, TrendingUp } from "lucide-react";

interface RawOrder {
  user_id: string | null;
  total: number;
}

interface RawUser {
  id: string;
  nombre: string;
}

interface FilaUsuario {
  nombre: string;
  tickets: number;
  total: number;
}

const eur = (n: number) => n.toFixed(2) + " €";

function agruparPorUsuario(orders: RawOrder[], userMap: Record<string, string>): FilaUsuario[] {
  const acc: Record<string, { tickets: number; total: number }> = {};
  for (const o of orders) {
    const key = o.user_id ?? "__null__";
    if (!acc[key]) acc[key] = { tickets: 0, total: 0 };
    acc[key]!.tickets += 1;
    acc[key]!.total += Number(o.total);
  }
  return Object.entries(acc)
    .map(([key, v]) => ({
      nombre: key === "__null__" ? "—" : (userMap[key] ?? "—"),
      ...v,
    }))
    .sort((a, b) => b.total - a.total);
}

export default function RendimientoDeUsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaUsuario[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [{ data: ordersData }, { data: usersData }] = await Promise.all([
        sb
          .from("sales_order")
          .select("user_id,total")
          .eq("estado", "COBRADA"),
        sb
          .from("app_user")
          .select("id,nombre"),
      ]);
      const orders = (ordersData as RawOrder[] | null) ?? [];
      const users = (usersData as RawUser[] | null) ?? [];
      const userMap: Record<string, string> = {};
      for (const u of users) {
        userMap[u.id] = u.nombre;
      }
      setFilas(agruparPorUsuario(orders, userMap));
      setLoading(false);
    })();
  }, []);

  const nUsuarios = filas.filter((f) => f.nombre !== "—").length;
  const totalGeneral = filas.reduce((s, f) => s + f.total, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Rendimiento de usuarios"
        description="Ventas cobradas agrupadas por usuario."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Usuarios con ventas"
          value={loading ? "…" : String(nUsuarios)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total general"
          value={loading ? "…" : eur(totalGeneral)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay tickets cobrados registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
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
                {filas.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{f.nombre}</TableCell>
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
