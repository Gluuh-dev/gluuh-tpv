"use client";

// Listado de FAMILIAS estilo Ágora: tabla densa a ancho completo con grupo
// mayor, familia padre, orden de impresión y visibilidad (TPV / menús).
// Clic en la fila = editar. Degrada si faltan 0058/0061/0065.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
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
  orden_impresion: number;
  grupoMayor: string | null;
  familiaPadre: string | null;
  mostrar_venta: boolean;
  mostrar_menus: boolean;
  productos: number;
}

const SiNo = ({ v }: { v: boolean }) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{v ? "Sí" : "No"}</span>
);

export default function FamiliasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sinMigracion, setSinMigracion] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      // Select completo (0058 + 0061 + 0065); si falla, base con aviso.
      type FamRow = {
        id: string; nombre: string; color: string | null; orden_impresion: number | null;
        grupo_mayor_id: string | null; familia_padre_id: string | null;
        mostrar_venta: boolean | null; mostrar_menus: boolean | null;
      };
      let fams: FamRow[] = [];
      const full = await sb.from("family")
        .select("id,nombre,color,orden_impresion,grupo_mayor_id,familia_padre_id,mostrar_venta,mostrar_menus")
        .order("orden");
      if (full.error) {
        setSinMigracion("0058/0061/0065");
        const { data } = await sb.from("family").select("id,nombre,color").order("orden");
        fams = ((data as { id: string; nombre: string; color: string | null }[] | null) ?? []).map((f) => ({
          ...f, orden_impresion: 0, grupo_mayor_id: null, familia_padre_id: null, mostrar_venta: true, mostrar_menus: true,
        }));
      } else {
        fams = (full.data as FamRow[] | null) ?? [];
      }

      const [{ data: gm }, prodRes] = await Promise.all([
        sb.from("grupo_mayor").select("id,nombre"),
        sb.from("product").select("id,family_id"),
      ]);
      const grupoPor = new Map(((gm as { id: string; nombre: string }[] | null) ?? []).map((g) => [g.id, g.nombre]));
      const famPor = new Map(fams.map((f) => [f.id, f.nombre]));
      // Productos por familia directa (0065); si la columna no existe, 0.
      const nProds = new Map<string, number>();
      if (!prodRes.error) {
        for (const p of (prodRes.data as { family_id: string | null }[] | null) ?? []) {
          if (p.family_id) nProds.set(p.family_id, (nProds.get(p.family_id) ?? 0) + 1);
        }
      }

      setFilas(fams.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        color: f.color ?? "#64748b",
        orden_impresion: f.orden_impresion ?? 0,
        grupoMayor: f.grupo_mayor_id ? (grupoPor.get(f.grupo_mayor_id) ?? null) : null,
        familiaPadre: f.familia_padre_id ? (famPor.get(f.familia_padre_id) ?? null) : null,
        mostrar_venta: f.mostrar_venta ?? true,
        mostrar_menus: f.mostrar_menus ?? true,
        productos: nProds.get(f.id) ?? 0,
      })));
      setLoading(false);
    })();
  }, []);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term
      ? filas.filter((f) => f.nombre.toLowerCase().includes(term) || (f.grupoMayor?.toLowerCase().includes(term) ?? false))
      : filas;
  }, [filas, q]);

  async function eliminar(f: Fila, e: React.MouseEvent) {
    e.stopPropagation();
    const aviso = f.productos > 0
      ? `«${f.nombre}» tiene ${f.productos} producto(s). Quedarán sin familia. ¿Eliminar?`
      : `¿Eliminar la familia «${f.nombre}»?`;
    if (!window.confirm(aviso)) return;
    const { error } = await supabaseBrowser().from("family").delete().eq("id", f.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Familia eliminada.");
    setFilas((prev) => prev.filter((x) => x.id !== f.id));
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Familias"
        description="Propiedades heredables del catálogo: los productos heredan de su familia los modificadores, el estilo y la visibilidad."
        actions={
          <Button onClick={() => router.push("/familias/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        }
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Faltan migraciones ({sinMigracion}): algunas columnas no se muestran.</p>
        </div>
      )}

      <div className="flex justify-end">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar…" className="w-72" />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Sin familias todavía"
          description="Crea la primera familia; los productos heredarán sus modificadores y estilo."
          action={<Button onClick={() => router.push("/familias/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Grupo mayor</TableHead>
                  <TableHead>Familia padre</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Orden imp. fact.</TableHead>
                  <TableHead className="text-center">Mostrar en TPV</TableHead>
                  <TableHead className="text-center">Mostrar en menús</TableHead>
                  <TableHead className="w-20" aria-label="Acciones" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                )}
                {!loading && filtradas.map((f) => (
                  <TableRow
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/familias/${f.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/familias/${f.id}`); } }}
                    className="group cursor-pointer hover:bg-surface-overlay"
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2.5">
                        <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: f.color }} aria-hidden />
                        {f.nombre}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.grupoMayor ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{f.familiaPadre ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.productos}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{f.orden_impresion}</TableCell>
                    <TableCell className="text-center"><SiNo v={f.mostrar_venta} /></TableCell>
                    <TableCell className="text-center"><SiNo v={f.mostrar_menus} /></TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${f.nombre}`}
                          onClick={(e) => { e.stopPropagation(); router.push(`/familias/${f.id}`); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Eliminar ${f.nombre}`}
                          onClick={(e) => eliminar(f, e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filas.length > 0 && filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin resultados para «{q}».</TableCell></TableRow>
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
