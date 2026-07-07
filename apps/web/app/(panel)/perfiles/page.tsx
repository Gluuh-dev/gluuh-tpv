"use client";

// Listado de PERFILES sobre TablaDatos (como familias/productos): la edición va a
// /perfiles/[id]. Los perfiles recomendados se siembran si la tabla está vacía, así
// que siempre hay de dónde partir. Degrada si falta 0048 (perfil.permisos).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { PERFILES_RECOMENDADOS, type MapaPermisos } from "../../lib/permisos";
import { TablaDatos, type ColumnaDatos } from "@/components/tabla-datos";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface Fila { id: string; nombre: string; descripcion: string; permisos: MapaPermisos; empleados: number }
type PerfilRow = { id: string; nombre: string; descripcion: string | null; permisos?: MapaPermisos };

const resumen = (p: MapaPermisos) => {
  const bloq = Object.values(p).filter((v) => v === false).length;
  return bloq === 0 ? "Acceso total" : `${bloq} bloqueado${bloq === 1 ? "" : "s"}`;
};

export default function PerfilesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sinMigracion, setSinMigracion] = useState(false);

  const cargar = useCallback(async () => {
    const sb = supabaseBrowser();
    let perfiles: PerfilRow[] = [];
    const conPerm = await sb.from("perfil").select("id,nombre,descripcion,permisos").order("nombre");
    if (conPerm.error) {
      setSinMigracion(true);
      const { data } = await sb.from("perfil").select("id,nombre,descripcion").order("nombre");
      perfiles = (data as PerfilRow[] | null) ?? [];
    } else {
      perfiles = (conPerm.data as PerfilRow[] | null) ?? [];
    }

    // Sembrar recomendados si no hay ninguno (así siempre están de inicio).
    if (perfiles.length === 0 && !conPerm.error) {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      const tid = (t as { id: string } | null)?.id;
      if (tid) {
        const { error } = await sb.from("perfil").insert(
          PERFILES_RECOMENDADOS.map((r) => ({ tenant_id: tid, nombre: r.nombre, descripcion: r.descripcion, permisos: r.permisos })),
        );
        if (error) toast.error(`No se pudieron crear los perfiles recomendados: ${error.message}`);
        else {
          const { data } = await sb.from("perfil").select("id,nombre,descripcion,permisos").order("nombre");
          perfiles = (data as PerfilRow[] | null) ?? [];
        }
      }
    }

    const { data: us } = await sb.from("app_user").select("perfil_id");
    const nPor = new Map<string, number>();
    for (const u of (us as { perfil_id: string | null }[] | null) ?? []) {
      if (u.perfil_id) nPor.set(u.perfil_id, (nPor.get(u.perfil_id) ?? 0) + 1);
    }

    setFilas(perfiles.map((p) => ({
      id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? "",
      permisos: p.permisos ?? {}, empleados: nPor.get(p.id) ?? 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function eliminar(f: Fila) {
    const { error } = await supabaseBrowser().from("perfil").delete().eq("id", f.id);
    if (error) { toast.error(`No se pudo eliminar: ${error.message}`); return; }
    setFilas((prev) => prev.filter((x) => x.id !== f.id));
  }
  async function duplicar(f: Fila) {
    const sb = supabaseBrowser();
    const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
    const { error } = await sb.from("perfil").insert({
      tenant_id: (t as { id: string } | null)?.id, nombre: `${f.nombre} - copia`,
      descripcion: f.descripcion || null, permisos: f.permisos,
    });
    if (error) { toast.error(`No se pudo duplicar: ${error.message}`); return; }
    toast.success("Perfil duplicado.");
    await cargar();
  }

  const columnas: ColumnaDatos<Fila>[] = [
    { clave: "nombre", titulo: "Nombre", valor: (f) => f.nombre, render: (f) => <span className="font-medium">{f.nombre}</span> },
    { clave: "descripcion", titulo: "Descripción", valor: (f) => f.descripcion, render: (f) => <span className="text-muted-foreground">{f.descripcion || "—"}</span> },
    {
      clave: "acceso", titulo: "Acceso", valor: (f) => resumen(f.permisos),
      render: (f) => <span className={Object.values(f.permisos).some((v) => v === false) ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"}>{resumen(f.permisos)}</span>,
    },
    { clave: "empleados", titulo: "Empleados", alinear: "der", valor: (f) => f.empleados, render: (f) => <span className="tabular-nums">{f.empleados}</span> },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Perfiles y permisos"
        description="Cada perfil define qué puede hacer y a qué zonas entra quien lo tenga. Asígnalos a los empleados en Personal."
      />

      {sinMigracion && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta la migración <strong>0048</strong> (<code>perfil.permisos</code>): los permisos no se pueden editar.</p>
        </div>
      )}

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="Sin perfiles todavía"
          description="Crea el primer perfil de permisos."
          action={<Button onClick={() => router.push("/perfiles/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <TablaDatos
          columnas={columnas}
          filas={filas}
          idDe={(f) => f.id}
          onNuevo={() => router.push("/perfiles/nuevo")}
          onAbrir={(f) => router.push(`/perfiles/${f.id}`)}
          onCopiar={duplicar}
          onEliminar={eliminar}
          exportarNombre="perfiles"
          cargando={loading}
        />
      )}
    </div>
  );
}
