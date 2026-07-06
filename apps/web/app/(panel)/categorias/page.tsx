"use client";

// Listado de CATEGORÍAS estilo Ágora: tabla densa a ancho completo con
// categoría padre, familia y visibilidad (TPV / menús). Clic = editar.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";

interface Fila {
  id: string;
  nombre: string;
  color: string;
  familia: string | null;
  padre: string | null;
  mostrar_venta: boolean;
  mostrar_menus: boolean;
  productos: number;
}

const SiNo = ({ v }: Readonly<{ v: boolean }>) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{v ? "Sí" : "No"}</span>
);

export default function CategoriasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sinMigracion, setSinMigracion] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      type CatRow = {
        id: string; nombre: string; family_id: string | null; categoria_padre_id: string | null;
        mostrar_venta: boolean | null; mostrar_menus: boolean | null;
      };
      let cats: CatRow[] = [];
      const full = await sb.from("category")
        .select("id,nombre,family_id,categoria_padre_id,mostrar_venta,mostrar_menus")
        .order("orden");
      if (full.error) {
        setSinMigracion(true);
        const { data } = await sb.from("category").select("id,nombre,family_id").order("orden");
        cats = ((data as { id: string; nombre: string; family_id: string | null }[] | null) ?? []).map((c) => ({
          ...c, categoria_padre_id: null, mostrar_venta: true, mostrar_menus: true,
        }));
      } else {
        cats = (full.data as CatRow[] | null) ?? [];
      }

      const [{ data: fams }, { data: pcs }] = await Promise.all([
        sb.from("family").select("id,nombre,color"),
        sb.from("product_category").select("product_id,category_id"),
      ]);
      const famPor = new Map(((fams as { id: string; nombre: string; color: string | null }[] | null) ?? []).map((f) => [f.id, f]));
      const catPor = new Map(cats.map((c) => [c.id, c.nombre]));
      const nProds = new Map<string, number>();
      for (const pc of (pcs as { category_id: string }[] | null) ?? []) {
        nProds.set(pc.category_id, (nProds.get(pc.category_id) ?? 0) + 1);
      }

      setFilas(cats.map((c) => {
        const fam = c.family_id ? famPor.get(c.family_id) : undefined;
        return {
          id: c.id,
          nombre: c.nombre,
          color: fam?.color ?? "#cbd5e1",
          familia: fam?.nombre ?? null,
          padre: c.categoria_padre_id ? (catPor.get(c.categoria_padre_id) ?? null) : null,
          mostrar_venta: c.mostrar_venta ?? true,
          mostrar_menus: c.mostrar_menus ?? true,
          productos: nProds.get(c.id) ?? 0,
        };
      }));
      setLoading(false);
    })();
  }, []);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term
      ? filas.filter((f) => f.nombre.toLowerCase().includes(term) || (f.familia?.toLowerCase().includes(term) ?? false))
      : filas;
  }, [filas, q]);

  async function eliminar(c: Fila, e: React.MouseEvent) {
    e.stopPropagation();
    const aviso = c.productos > 0
      ? `«${c.nombre}» tiene ${c.productos} producto(s) asignados. ¿Eliminar la categoría?`
      : `¿Eliminar la categoría «${c.nombre}»?`;
    if (!window.confirm(aviso)) return;
    const { error } = await supabaseBrowser().from("category").delete().eq("id", c.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Categoría eliminada.");
    setFilas((prev) => prev.filter((x) => x.id !== c.id));
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Categorías"
        description="Las agrupaciones que ve el TPV: un producto puede estar en varias categorías a la vez."
        actions={<Button onClick={() => router.push("/categorias/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Faltan migraciones (0061/0065): categoría padre y visibilidad no se muestran.</p>
        </div>
      )}

      <div className="flex justify-end">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar…" className="w-72" />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-8 w-8" />}
          title="Sin categorías todavía"
          description="Crea la primera categoría para organizar la pantalla de venta."
          action={<Button onClick={() => router.push("/categorias/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Familia</TableHead>
                  <TableHead>Categoría padre</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-center">Mostrar en TPV</TableHead>
                  <TableHead className="text-center">Mostrar en menús</TableHead>
                  <TableHead className="w-20" aria-label="Acciones" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                )}
                {!loading && filtradas.map((c) => (
                  <TableRow
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/categorias/${c.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/categorias/${c.id}`); } }}
                    className="group cursor-pointer hover:bg-surface-overlay"
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2.5">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                        {c.nombre}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.familia ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.padre ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.productos}</TableCell>
                    <TableCell className="text-center"><SiNo v={c.mostrar_venta} /></TableCell>
                    <TableCell className="text-center"><SiNo v={c.mostrar_menus} /></TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${c.nombre}`}
                          onClick={(e) => { e.stopPropagation(); router.push(`/categorias/${c.id}`); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Eliminar ${c.nombre}`}
                          onClick={(e) => eliminar(c, e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filas.length > 0 && filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin resultados para «{q}».</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            <div className="border-t border-border px-4 py-2 text-right text-xs text-muted-foreground">
              {filtradas.length} registro{filtradas.length === 1 ? "" : "s"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
