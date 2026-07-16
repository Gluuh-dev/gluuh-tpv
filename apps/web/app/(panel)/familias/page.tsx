"use client";

// Listado de FAMILIAS sobre TablaDatos (barra Nuevo/Duplicar/Editar/Eliminar +
// buscador integrados). Degrada si faltan 0058/0061/0065.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { TablaDatos, IrA, type ColumnaDatos } from "@/components/tabla-datos";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface Fila {
  id: string;
  nombre: string;
  color: string;
  orden_impresion: number;
  grupoMayor: string | null;
  grupoMayorId: string | null;
  familiaPadre: string | null;
  familiaPadreId: string | null;
  mostrar_venta: boolean;
  mostrar_menus: boolean;
  productos: number;
}

const siNo = (v: boolean) => (v ? "Sí" : "No");
const SiNo = ({ v }: Readonly<{ v: boolean }>) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{siNo(v)}</span>
);
// Quita columnas de sistema para poder duplicar una fila con INSERT.
function sinMeta(o: Record<string, unknown>) {
  const row = { ...o };
  for (const k of ["id", "created_at", "updated_at"]) delete row[k];
  return row;
}

export default function FamiliasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sinMigracion, setSinMigracion] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const sb = supabaseBrowser();
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
      grupoMayorId: f.grupo_mayor_id,
      familiaPadre: f.familia_padre_id ? (famPor.get(f.familia_padre_id) ?? null) : null,
      familiaPadreId: f.familia_padre_id,
      mostrar_venta: f.mostrar_venta ?? true,
      mostrar_menus: f.mostrar_menus ?? true,
      productos: nProds.get(f.id) ?? 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function eliminar(f: Fila) {
    const { error } = await supabaseBrowser().from("family").delete().eq("id", f.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    setFilas((prev) => prev.filter((x) => x.id !== f.id));
  }
  async function duplicar(f: Fila) {
    const sb = supabaseBrowser();
    const [{ data: t }, { data: o }] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("family").select("*").eq("id", f.id).maybeSingle(),
    ]);
    if (!o) return;
    const row = sinMeta(o as Record<string, unknown>);
    row.tenant_id = (t as { id: string } | null)?.id;
    row.nombre = `${String(row.nombre)} - copia`;
    const { error } = await sb.from("family").insert(row);
    if (error) { toast.error(`No se pudo duplicar: ${error.message}`); return; }
    toast.success("Familia duplicada.");
    await cargar();
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
      clave: "grupoMayor", titulo: "Grupo mayor",
      valor: (f) => f.grupoMayor,
      render: (f) => f.grupoMayor
        ? <span className="text-muted-foreground">{f.grupoMayor}{f.grupoMayorId && <IrA href={`/grupos-mayores/${f.grupoMayorId}`} titulo={f.grupoMayor} />}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      clave: "familiaPadre", titulo: "Familia padre",
      valor: (f) => f.familiaPadre,
      render: (f) => f.familiaPadre
        ? <span className="text-muted-foreground">{f.familiaPadre}{f.familiaPadreId && <IrA href={`/familias/${f.familiaPadreId}`} titulo={f.familiaPadre} />}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    { clave: "productos", titulo: "Productos", alinear: "der", valor: (f) => f.productos, render: (f) => <span className="tabular-nums">{f.productos}</span> },
    { clave: "ordenImp", titulo: "Orden imp. fact.", alinear: "der", valor: (f) => f.orden_impresion, render: (f) => <span className="tabular-nums text-muted-foreground">{f.orden_impresion}</span> },
    { clave: "venta", titulo: "Mostrar en TPV", alinear: "centro", valor: (f) => siNo(f.mostrar_venta), render: (f) => <SiNo v={f.mostrar_venta} /> },
    { clave: "menus", titulo: "Mostrar en menús", alinear: "centro", valor: (f) => siNo(f.mostrar_menus), render: (f) => <SiNo v={f.mostrar_menus} /> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Familias"
        description="Propiedades heredables del catálogo: los productos heredan de su familia los modificadores, el estilo y la visibilidad."
        actions={<Button onClick={() => router.push("/menus")}><UtensilsCrossed className="h-4 w-4" /> Menús</Button>}
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Faltan migraciones ({sinMigracion}): algunas columnas no se muestran.</p>
        </div>
      )}

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Sin familias todavía"
          description="Crea la primera familia; los productos heredarán sus modificadores y estilo."
          action={<Button onClick={() => router.push("/familias/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <TablaDatos
          columnas={columnas}
          filas={filas}
          idDe={(f) => f.id}
          onNuevo={() => router.push("/familias/nuevo")}
          onAbrir={(f) => router.push(`/familias/${f.id}`)}
          onCopiar={duplicar}
          onEliminar={eliminar}
          exportarNombre="familias"
          cargando={loading}
        />
      )}
    </div>
  );
}
