"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers, Package } from "lucide-react";

interface RawFamily {
  id: string;
  nombre: string;
}

interface RawCategory {
  id: string;
  family_id: string | null;
}

interface RawProduct {
  id: string;
  category_id: string | null;
}

interface FilaFamilia {
  nombre: string;
  categorias: number;
  productos: number;
}

function agruparFamilias(
  families: RawFamily[],
  categories: RawCategory[],
  products: RawProduct[],
): FilaFamilia[] {
  const catsByFamily: Record<string, Set<string>> = {};
  for (const c of categories) {
    const key = c.family_id ?? "__sin_familia__";
    if (!catsByFamily[key]) catsByFamily[key] = new Set();
    catsByFamily[key]!.add(c.id);
  }

  const catToFamily: Record<string, string> = {};
  for (const c of categories) {
    catToFamily[c.id] = c.family_id ?? "__sin_familia__";
  }

  const prodsByFamily: Record<string, number> = {};
  for (const p of products) {
    const famKey = p.category_id ? (catToFamily[p.category_id] ?? "__sin_familia__") : "__sin_familia__";
    prodsByFamily[famKey] = (prodsByFamily[famKey] ?? 0) + 1;
  }

  const result: FilaFamilia[] = families.map((f) => ({
    nombre: f.nombre,
    categorias: catsByFamily[f.id]?.size ?? 0,
    productos: prodsByFamily[f.id] ?? 0,
  }));

  const sinFamiliaCats = catsByFamily["__sin_familia__"]?.size ?? 0;
  const sinFamiliaProds = prodsByFamily["__sin_familia__"] ?? 0;
  if (sinFamiliaCats > 0 || sinFamiliaProds > 0) {
    result.push({ nombre: "Sin familia", categorias: sinFamiliaCats, productos: sinFamiliaProds });
  }

  return result;
}

export default function FamiliasYProductosPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaFamilia[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [{ data: familiesData }, { data: categoriesData }, { data: productsData }] = await Promise.all([
        sb.from("family").select("id,nombre"),
        sb.from("category").select("id,family_id"),
        sb.from("product").select("id,category_id"),
      ]);
      const families = (familiesData as RawFamily[] | null) ?? [];
      const categories = (categoriesData as RawCategory[] | null) ?? [];
      const products = (productsData as RawProduct[] | null) ?? [];
      setFilas(agruparFamilias(families, categories, products));
      setLoading(false);
    })();
  }, []);

  const nFamilias = filas.filter((f) => f.nombre !== "Sin familia").length;
  const nProductos = filas.reduce((s, f) => s + f.productos, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Familias y productos"
        description="Categorías y productos agrupados por familia."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Familias"
          value={loading ? "…" : String(nFamilias)}
        />
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Productos totales"
          value={loading ? "…" : String(nProductos)}
        />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay familias ni productos registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Familia</TableHead>
                  <TableHead className="text-right">Categorías</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
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
                    <TableCell className="text-right tabular-nums">{f.categorias}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.productos}</TableCell>
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
