"use client";

// Listado de GRUPOS MAYORES estilo Ágora: tabla densa a ancho completo.
// Jerarquía: grupo mayor → familia → categoría → producto. Clic = editar.
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

interface Fila { id: string; nombre: string; descripcion: string | null; familias: number }

export default function GruposMayoresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sinColumna, setSinColumna] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [{ data: gData }, famRes] = await Promise.all([
        sb.from("grupo_mayor").select("id,nombre,descripcion").order("nombre"),
        sb.from("family").select("id,grupo_mayor_id"),
      ]);
      const nFams = new Map<string, number>();
      if (famRes.error) setSinColumna(true);
      else {
        for (const f of (famRes.data as { grupo_mayor_id: string | null }[] | null) ?? []) {
          if (f.grupo_mayor_id) nFams.set(f.grupo_mayor_id, (nFams.get(f.grupo_mayor_id) ?? 0) + 1);
        }
      }
      setFilas(((gData as { id: string; nombre: string; descripcion: string | null }[] | null) ?? []).map((g) => ({
        ...g, familias: nFams.get(g.id) ?? 0,
      })));
      setLoading(false);
    })();
  }, []);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? filas.filter((f) => f.nombre.toLowerCase().includes(term)) : filas;
  }, [filas, q]);

  async function eliminar(g: Fila, e: React.MouseEvent) {
    e.stopPropagation();
    const aviso = g.familias > 0
      ? `«${g.nombre}» contiene ${g.familias} familia(s). Quedarán sin grupo mayor. ¿Eliminar?`
      : `¿Eliminar «${g.nombre}»?`;
    if (!window.confirm(aviso)) return;
    const { error } = await supabaseBrowser().from("grupo_mayor").delete().eq("id", g.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Grupo mayor eliminado.");
    setFilas((prev) => prev.filter((x) => x.id !== g.id));
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Grupos mayores"
        description="La división por encima de las familias: grupo mayor → familia → categoría → producto."
        actions={<Button onClick={() => router.push("/grupos-mayores/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      {sinColumna && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta la migración <strong>0058</strong> (<code>family.grupo_mayor_id</code>): no se pueden asignar familias.</p>
        </div>
      )}

      <div className="flex justify-end">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar…" className="w-72" />
      </div>

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Sin grupos mayores todavía"
          description="Crea el primero para dividir tus familias (ej.: Bebida, Comida)."
          action={<Button onClick={() => router.push("/grupos-mayores/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Familias</TableHead>
                  <TableHead className="w-20" aria-label="Acciones" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                )}
                {!loading && filtradas.map((g) => (
                  <TableRow
                    key={g.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/grupos-mayores/${g.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/grupos-mayores/${g.id}`); } }}
                    className="group cursor-pointer hover:bg-surface-overlay"
                  >
                    <TableCell className="font-medium">{g.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{g.descripcion ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.familias}</TableCell>
                    <TableCell>
                      <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${g.nombre}`}
                          onClick={(e) => { e.stopPropagation(); router.push(`/grupos-mayores/${g.id}`); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Eliminar ${g.nombre}`}
                          onClick={(e) => eliminar(g, e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filas.length > 0 && filtradas.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Sin resultados para «{q}».</TableCell></TableRow>
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
