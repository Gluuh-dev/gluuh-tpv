"use client";

// Listado de CATEGORÍAS estilo Ágora sobre TablaDatos: ordenación, selección +
// exportar, acciones junto al nombre y botón «ir a» hacia familia/padre.
// Color propio de la categoría (0066) con herencia del de la familia.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Plus, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { TablaDatos, IrA, type ColumnaDatos } from "@/components/tabla-datos";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";

interface Fila {
  id: string;
  nombre: string;
  color: string;
  familia: string | null;
  familiaId: string | null;
  padre: string | null;
  padreId: string | null;
  mostrar_venta: boolean;
  mostrar_menus: boolean;
  productos: number;
}

const siNo = (v: boolean) => (v ? "Sí" : "No");
const SiNo = ({ v }: Readonly<{ v: boolean }>) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{siNo(v)}</span>
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
        color: string | null; mostrar_venta: boolean | null; mostrar_menus: boolean | null;
      };
      let cats: CatRow[] = [];
      const full = await sb.from("category")
        .select("id,nombre,family_id,categoria_padre_id,color,mostrar_venta,mostrar_menus")
        .order("orden");
      if (full.error) {
        setSinMigracion(true);
        const { data } = await sb.from("category").select("id,nombre,family_id").order("orden");
        cats = ((data as { id: string; nombre: string; family_id: string | null }[] | null) ?? []).map((c) => ({
          ...c, categoria_padre_id: null, color: null, mostrar_venta: true, mostrar_menus: true,
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
          // Color propio (0066); si no tiene, hereda el de la familia.
          color: c.color ?? fam?.color ?? "#cbd5e1",
          familia: fam?.nombre ?? null,
          familiaId: c.family_id,
          padre: c.categoria_padre_id ? (catPor.get(c.categoria_padre_id) ?? null) : null,
          padreId: c.categoria_padre_id,
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

  async function eliminar(c: Fila) {
    const aviso = c.productos > 0
      ? `«${c.nombre}» tiene ${c.productos} producto(s) asignados. ¿Eliminar la categoría?`
      : `¿Eliminar la categoría «${c.nombre}»?`;
    if (!window.confirm(aviso)) return;
    const { error } = await supabaseBrowser().from("category").delete().eq("id", c.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Categoría eliminada.");
    setFilas((prev) => prev.filter((x) => x.id !== c.id));
  }

  const columnas: ColumnaDatos<Fila>[] = [
    {
      clave: "nombre", titulo: "Nombre",
      valor: (f) => f.nombre,
      render: (f) => (
        <span className="flex items-center gap-2.5 font-medium">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: f.color }} aria-hidden />
          {f.nombre}
        </span>
      ),
    },
    {
      clave: "familia", titulo: "Familia",
      valor: (f) => f.familia,
      render: (f) => f.familia
        ? <span className="text-muted-foreground">{f.familia}{f.familiaId && <IrA href={`/familias/${f.familiaId}`} titulo={f.familia} />}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      clave: "padre", titulo: "Categoría padre",
      valor: (f) => f.padre,
      render: (f) => f.padre
        ? <span className="text-muted-foreground">{f.padre}{f.padreId && <IrA href={`/categorias/${f.padreId}`} titulo={f.padre} />}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    { clave: "productos", titulo: "Productos", alinear: "der", valor: (f) => f.productos, render: (f) => <span className="tabular-nums">{f.productos}</span> },
    { clave: "venta", titulo: "Mostrar en TPV", alinear: "centro", valor: (f) => siNo(f.mostrar_venta), render: (f) => <SiNo v={f.mostrar_venta} /> },
    { clave: "menus", titulo: "Mostrar en menús", alinear: "centro", valor: (f) => siNo(f.mostrar_menus), render: (f) => <SiNo v={f.mostrar_menus} /> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Categorías"
        description="Las agrupaciones que ve el TPV: un producto puede estar en varias categorías a la vez."
        actions={<Button onClick={() => router.push("/categorias/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Faltan migraciones (0061/0065/0066): padre, color propio y visibilidad no se muestran.</p>
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
        <TablaDatos
          columnas={columnas}
          filas={filtradas}
          idDe={(f) => f.id}
          onAbrir={(f) => router.push(`/categorias/${f.id}`)}
          onEliminar={eliminar}
          exportarNombre="categorias"
          cargando={loading}
          vacio={`Sin resultados para «${q}».`}
        />
      )}
    </div>
  );
}
