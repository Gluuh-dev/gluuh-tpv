"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Package, ShoppingCart } from "lucide-react";

interface RawLine {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

interface ProductoTop {
  nombre: string;
  uds: number;
  importe: number;
}

const eur = (n: number) => n.toFixed(2) + " €";

function agruparPorProducto(lines: RawLine[]): ProductoTop[] {
  const acc: Record<string, { uds: number; importe: number }> = {};
  for (const l of lines) {
    const nombre = l.nombre ?? "(sin nombre)";
    if (!acc[nombre]) acc[nombre] = { uds: 0, importe: 0 };
    acc[nombre]!.uds += Number(l.cantidad);
    acc[nombre]!.importe += Number(l.cantidad) * Number(l.precio_unitario);
  }
  return Object.entries(acc)
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.uds - a.uds)
    .slice(0, 50);
}

export default function Top50ProductosPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<ProductoTop[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb
        .from("order_line")
        .select("nombre,cantidad,precio_unitario");
      const rows = (data as RawLine[] | null) ?? [];
      setFilas(agruparPorProducto(rows));
      setLoading(false);
    })();
  }, []);

  const productosDistintos = filas.length;
  const udsTotales = filas.reduce((s, f) => s + f.uds, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Top 50 productos"
        description="Productos más vendidos por unidades."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Productos distintos"
          value={loading ? "…" : String(productosDistintos)}
        />
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Uds totales"
          value={loading ? "…" : String(udsTotales)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay líneas de pedido registradas."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 text-right">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Uds</TableHead>
                  <TableHead className="text-right">Importe €</TableHead>
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
                  <TableRow key={f.nombre}>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>{f.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.uds}</TableCell>
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
