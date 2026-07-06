"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";

interface FilaFamilia {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  categorias: number;
  productos: number;
  grupoMayor: string | null;
}

export default function FamiliasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaFamilia[]>([]);
  const [sinColumna, setSinColumna] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [famRes, { data: catData }, { data: prodData }, { data: gmData }] = await Promise.all([
        sb.from("family").select("id,nombre,color,orden,grupo_mayor_id").order("orden"),
        sb.from("category").select("id,family_id"),
        sb.from("product").select("id,category_id"),
        sb.from("grupo_mayor").select("id,nombre"),
      ]);

      // Familias con grupo mayor; si la columna no existe (0058 sin aplicar) → degradar.
      type FamRow = { id: string; nombre: string; color: string | null; orden: number | null; grupo_mayor_id: string | null };
      let families: FamRow[];
      if (famRes.error) {
        const { data } = await sb.from("family").select("id,nombre,color,orden").order("orden");
        families = ((data as Omit<FamRow, "grupo_mayor_id">[] | null) ?? []).map((f) => ({ ...f, grupo_mayor_id: null }));
        setSinColumna(true);
      } else {
        families = (famRes.data as FamRow[] | null) ?? [];
      }
      const grupoPorId = new Map(((gmData as { id: string; nombre: string }[] | null) ?? []).map((g) => [g.id, g.nombre]));
      const categories = (catData as { id: string; family_id: string | null }[] | null) ?? [];
      const products = (prodData as { id: string; category_id: string | null }[] | null) ?? [];

      // Categoría → familia, y nº de categorías por familia.
      const catToFamily = new Map<string, string>();
      const catsByFamily = new Map<string, number>();
      for (const c of categories) {
        if (!c.family_id) continue;
        catToFamily.set(c.id, c.family_id);
        catsByFamily.set(c.family_id, (catsByFamily.get(c.family_id) ?? 0) + 1);
      }
      // Productos por familia (vía su categoría).
      const prodsByFamily = new Map<string, number>();
      for (const p of products) {
        if (!p.category_id) continue;
        const famId = catToFamily.get(p.category_id);
        if (!famId) continue;
        prodsByFamily.set(famId, (prodsByFamily.get(famId) ?? 0) + 1);
      }

      setFilas(
        families.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          color: f.color ?? "#64748b",
          orden: f.orden ?? 0,
          categorias: catsByFamily.get(f.id) ?? 0,
          productos: prodsByFamily.get(f.id) ?? 0,
          grupoMayor: f.grupo_mayor_id ? (grupoPorId.get(f.grupo_mayor_id) ?? null) : null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term
      ? filas.filter(
          (f) =>
            f.nombre.toLowerCase().includes(term) ||
            (f.grupoMayor?.toLowerCase().includes(term) ?? false),
        )
      : filas;
  }, [filas, q]);

  function abrir(id: string) {
    router.push(`/familias/${id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Familias"
        description="Agrupaciones de categorías de la carta. Cada familia agrupa varias categorías."
        actions={
          <Button onClick={() => router.push("/familias/nuevo")}>
            <Plus className="h-4 w-4" /> Nueva familia
          </Button>
        }
      />

      {sinColumna && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0058</strong> (columna <code>family.grupo_mayor_id</code>).
            La columna «Grupo mayor» no se muestra hasta entonces.
          </p>
        </div>
      )}

      {filas.length > 8 && (
        <SearchInput value={q} onChange={setQ} placeholder="Buscar familia o grupo mayor…" className="max-w-xs" />
      )}

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Sin familias todavía"
          description="Crea la primera familia para agrupar tus categorías."
          action={
            <Button onClick={() => router.push("/familias/nuevo")}>
              <Plus className="h-4 w-4" /> Nueva familia
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Familia</TableHead>
                  {!sinColumna && <TableHead>Grupo mayor</TableHead>}
                  <TableHead className="text-right">Categorías</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Orden</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={sinColumna ? 4 : 5} className="py-8 text-center text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  filtradas.map((f) => (
                    <TableRow
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrir(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrir(f.id);
                        }
                      }}
                      className="cursor-pointer hover:bg-surface-overlay"
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2.5">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: f.color }}
                            aria-hidden="true"
                          />
                          {f.nombre}
                        </span>
                      </TableCell>
                      {!sinColumna && (
                        <TableCell className="text-muted-foreground">{f.grupoMayor ?? "—"}</TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">{f.categorias}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.productos}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{f.orden}</TableCell>
                    </TableRow>
                  ))}
                {!loading && filas.length > 0 && filtradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={sinColumna ? 4 : 5} className="py-8 text-center text-muted-foreground">
                      Sin resultados para «{q}».
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
