"use client";

// Listado de GRUPOS MAYORES sobre TablaDatos (ordenación, selección + exportar,
// acciones junto al nombre). Jerarquía: grupo mayor → familia → categoría → producto.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { TablaDatos, type ColumnaDatos } from "@/components/tabla-datos";
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

  async function eliminar(g: Fila) {
    const aviso = g.familias > 0
      ? `«${g.nombre}» contiene ${g.familias} familia(s). Quedarán sin grupo mayor. ¿Eliminar?`
      : `¿Eliminar «${g.nombre}»?`;
    if (!window.confirm(aviso)) return;
    const { error } = await supabaseBrowser().from("grupo_mayor").delete().eq("id", g.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Grupo mayor eliminado.");
    setFilas((prev) => prev.filter((x) => x.id !== g.id));
  }

  const columnas: ColumnaDatos<Fila>[] = [
    { clave: "nombre", titulo: "Nombre", valor: (f) => f.nombre, render: (f) => <span className="font-medium">{f.nombre}</span> },
    { clave: "descripcion", titulo: "Descripción", valor: (f) => f.descripcion },
    { clave: "familias", titulo: "Familias", alinear: "der", valor: (f) => f.familias, render: (f) => <span className="tabular-nums">{f.familias}</span> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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
        <TablaDatos
          columnas={columnas}
          filas={filtradas}
          idDe={(f) => f.id}
          onAbrir={(f) => router.push(`/grupos-mayores/${f.id}`)}
          onEliminar={eliminar}
          exportarNombre="grupos-mayores"
          cargando={loading}
          vacio={`Sin resultados para «${q}».`}
        />
      )}
    </div>
  );
}
