"use client";

// Ficha de PERFIL (como productos/familias): nombre + descripción + matriz de
// permisos (catálogo agrupado + buscador). Insert si "nuevo", update si existe.
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { CATALOGO_PERMISOS, type MapaPermisos } from "../../../lib/permisos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function PerfilEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const esNuevo = id === "nuevo";
  const sb = supabaseBrowser();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sinMigracion, setSinMigracion] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [permisos, setPermisos] = useState<MapaPermisos>({});
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      setTenantId((t as { id: string } | null)?.id ?? "");
      if (!esNuevo) {
        const conPerm = await sb.from("perfil").select("nombre,descripcion,permisos").eq("id", id).maybeSingle();
        if (conPerm.error) {
          setSinMigracion(true);
          const { data } = await sb.from("perfil").select("nombre,descripcion").eq("id", id).maybeSingle();
          const p = data as { nombre: string; descripcion: string | null } | null;
          if (!p) { toast.error("No se pudo cargar el perfil."); router.push("/perfiles"); return; }
          setNombre(p.nombre); setDescripcion(p.descripcion ?? "");
        } else {
          const p = conPerm.data as { nombre: string; descripcion: string | null; permisos: MapaPermisos } | null;
          if (!p) { toast.error("No se pudo cargar el perfil."); router.push("/perfiles"); return; }
          setNombre(p.nombre); setDescripcion(p.descripcion ?? ""); setPermisos(p.permisos ?? {});
        }
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNuevo, id]);

  const grupos = useMemo(() => {
    const q = norm(busca.trim());
    if (!q) return CATALOGO_PERMISOS;
    return CATALOGO_PERMISOS
      .map((g) => ({ ...g, permisos: g.permisos.filter((p) => norm(p.label).includes(q) || norm(g.grupo).includes(q)) }))
      .filter((g) => g.permisos.length > 0);
  }, [busca]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const base: Record<string, unknown> = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
    if (!sinMigracion) base.permisos = permisos;
    const { error } = esNuevo
      ? await sb.from("perfil").insert({ tenant_id: tenantId, ...base })
      : await sb.from("perfil").update(base).eq("id", id);
    setGuardando(false);
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
    toast.success(esNuevo ? "Perfil creado." : "Cambios guardados.");
    router.push("/perfiles");
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar el perfil «${nombre}»? Los empleados con él quedarán sin perfil.`)) return;
    const { error } = await sb.from("perfil").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Perfil eliminado.");
    router.push("/perfiles");
  }

  if (cargando) return <div className="w-full"><p className="text-sm text-muted-foreground">Cargando…</p></div>;

  return (
    <form onSubmit={guardar} className="mx-auto w-full max-w-3xl space-y-4 pb-16">
      <div>
        <Link href="/perfiles" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Perfiles
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{esNuevo ? "Nuevo perfil" : nombre || "Editar perfil"}</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="p-nombre">Nombre</Label>
            <Input id="p-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Encargado, Camarero…" autoFocus={esNuevo} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Descripción</Label>
            <Textarea id="p-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Para qué es este perfil (opcional)" />
          </div>
        </CardContent>
      </Card>

      {sinMigracion ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Falta la migración <strong>0048</strong> (<code>perfil.permisos</code>): los permisos no se pueden editar todavía.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Permisos</h2>
              <p className="text-sm text-muted-foreground">Marcado = permitido. Desmarca lo que quieras bloquear a quien tenga este perfil.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-8" placeholder="Buscar permiso…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="space-y-4">
              {grupos.map((g) => (
                <div key={g.grupo} className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.grupo}</p>
                  {g.permisos.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={permisos[p.id] !== false}
                        onChange={(e) => setPermisos((s) => ({ ...s, [p.id]: e.target.checked }))}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              ))}
              {grupos.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">Sin permisos para «{busca}».</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Aceptar
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/perfiles")}>Cancelar</Button>
        {!esNuevo && (
          <Button type="button" variant="destructive" className="ml-auto" onClick={eliminar}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        )}
      </div>
    </form>
  );
}
