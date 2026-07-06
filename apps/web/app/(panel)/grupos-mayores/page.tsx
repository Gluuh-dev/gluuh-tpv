"use client";

// Listado de GRUPOS MAYORES sobre TablaDatos (ordenación, selección + exportar,
// acciones junto al nombre). Jerarquía: grupo mayor → familia → categoría → producto.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { TablaDatos, type ColumnaDatos } from "@/components/tabla-datos";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface Fila { id: string; nombre: string; descripcion: string | null; familias: number }

export default function GruposMayoresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sinColumna, setSinColumna] = useState(false);

  const cargar = useCallback(async () => {
    const sb = supabaseBrowser();
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
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function eliminar(g: Fila) {
    const { error } = await supabaseBrowser().from("grupo_mayor").delete().eq("id", g.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    setFilas((prev) => prev.filter((x) => x.id !== g.id));
  }
  async function duplicar(g: Fila) {
    const sb = supabaseBrowser();
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    const { error } = await sb.from("grupo_mayor").insert({
      tenant_id: (t as { id: string } | null)?.id, nombre: `${g.nombre} - copia`, descripcion: g.descripcion,
    });
    if (error) { toast.error(`No se pudo duplicar: ${error.message}`); return; }
    toast.success("Grupo mayor duplicado.");
    await cargar();
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
      />

      {sinColumna && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta la migración <strong>0058</strong> (<code>family.grupo_mayor_id</code>): no se pueden asignar familias.</p>
        </div>
      )}

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
          filas={filas}
          idDe={(f) => f.id}
          onNuevo={() => router.push("/grupos-mayores/nuevo")}
          onAbrir={(f) => router.push(`/grupos-mayores/${f.id}`)}
          onCopiar={duplicar}
          onEliminar={eliminar}
          exportarNombre="grupos-mayores"
          cargando={loading}
        />
      )}
    </div>
  );
}
