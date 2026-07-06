"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Familia { id: string; nombre: string; color: string }
interface Categoria { id: string; nombre: string; family_id: string | null; orden: number; estacion: string | null }

const COLOR_SIN = "#cbd5e1";
const SIN_FAMILIA = "__none__";

export default function Categorias() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<string>("all"); // "all" | family.id | SIN_FAMILIA
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: fam }, catsRes, { data: prods }] = await Promise.all([
        sb.from("family").select("id,nombre,color").order("orden"),
        sb.from("category").select("id,nombre,family_id,orden,estacion").order("orden"),
        sb.from("product").select("category_id"),
      ]);
      setFamilias((fam as Familia[]) ?? []);
      // Degradación: sin la columna estacion (migración 0050), recarga sin ella.
      if (catsRes.error) {
        const { data: c } = await sb.from("category").select("id,nombre,family_id,orden").order("orden");
        setCats(((c as Omit<Categoria, "estacion">[]) ?? []).map((x) => ({ ...x, estacion: null })));
      } else {
        setCats((catsRes.data as Categoria[]) ?? []);
      }
      const cuenta: Record<string, number> = {};
      for (const p of (prods as { category_id: string | null }[]) ?? []) {
        if (p.category_id) cuenta[p.category_id] = (cuenta[p.category_id] ?? 0) + 1;
      }
      setConteo(cuenta);
      setLoading(false);
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const familia = useMemo(() => new Map(familias.map((f) => [f.id, f])), [familias]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cats.filter((c) => {
      if (filtro === SIN_FAMILIA ? c.family_id !== null : filtro !== "all" && c.family_id !== filtro) return false;
      return !q || c.nombre.toLowerCase().includes(q);
    });
  }, [cats, filtro, busca]);

  const chip = (val: string, label: string, color?: string) => (
    <button
      key={val}
      onClick={() => setFiltro(val)}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
        filtro === val ? "border-brand bg-brand/10 text-foreground" : "border-border text-(--text-secondary) hover:bg-surface-overlay"
      }`}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />}
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Categorías"
        description="Cada categoría pertenece a una familia (que le da el color) y agrupa productos."
        actions={
          <Button onClick={() => router.push("/categorias/nuevo")}>
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "Todas")}
        {familias.map((f) => chip(f.id, f.nombre, f.color))}
        {chip(SIN_FAMILIA, "Sin familia", COLOR_SIN)}
        <div className="ml-auto w-full sm:w-64">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar categoría…" />
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface" aria-busy>
          <span className="sr-only" role="status">Cargando categorías…</span>
          <div className="animate-pulse divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <span className="h-3 w-3 shrink-0 rounded-full bg-surface-muted" />
                <span className="h-3.5 flex-1 rounded bg-surface-muted" />
                <span className="h-3.5 w-24 rounded bg-surface-muted" />
                <span className="h-3.5 w-10 rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          title={cats.length === 0 ? "Aún no hay categorías" : "Sin resultados"}
          description={cats.length === 0 ? "Crea tu primera categoría para organizar los productos." : "Ninguna categoría coincide con el filtro."}
          action={cats.length === 0 ? <Button onClick={() => router.push("/categorias/nuevo")}><Plus className="h-4 w-4" /> Nueva categoría</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nombre</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="text-right">Orden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((c) => {
                const fam = c.family_id ? familia.get(c.family_id) : null;
                return (
                  <TableRow
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Editar categoría ${c.nombre}`}
                    onClick={() => router.push(`/categorias/${c.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/categorias/${c.id}`); } }}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <span className="block h-3 w-3 rounded-full" style={{ background: fam?.color ?? COLOR_SIN }} aria-hidden />
                    </TableCell>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{fam?.nombre ?? "Sin familia"}</TableCell>
                    <TableCell>
                      {c.estacion
                        ? <Badge variant="outline" className="font-normal">{ESTACION_LABEL[estacionDe(c.estacion)]}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{conteo[c.id] ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{c.orden}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
