"use client";

// Ficha de GRUPO MAYOR estilo Ágora: datos + «Familias del Grupo» con buscador
// para añadir (asigna family.grupo_mayor_id) y quitar.
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { BuscarAnadir } from "@/components/buscar-anadir";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Familia { id: string; nombre: string; color: string | null; grupo_mayor_id: string | null }

export default function GrupoMayorEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const esNuevo = id === "nuevo";
  const sb = supabaseBrowser();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [familias, setFamilias] = useState<Familia[]>([]);

  const cargarFamilias = useCallback(async () => {
    const { data } = await sb.from("family").select("id,nombre,color,grupo_mayor_id").order("nombre");
    setFamilias((data as Familia[] | null) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      setTenantId((t as { id: string } | null)?.id ?? "");
      if (!esNuevo) {
        const { data } = await sb.from("grupo_mayor").select("nombre,descripcion").eq("id", id).maybeSingle();
        const g = data as { nombre: string; descripcion: string | null } | null;
        if (!g) { toast.error("No se pudo cargar el grupo mayor."); router.push("/grupos-mayores"); return; }
        setNombre(g.nombre);
        setDescripcion(g.descripcion ?? "");
        await cargarFamilias();
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNuevo, id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const valores = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
    const { error } = esNuevo
      ? await sb.from("grupo_mayor").insert({ tenant_id: tenantId, ...valores })
      : await sb.from("grupo_mayor").update(valores).eq("id", id);
    setGuardando(false);
    if (error) { toast.error("No se pudo guardar."); return; }
    toast.success(esNuevo ? "Grupo mayor creado." : "Cambios guardados.");
    router.push("/grupos-mayores");
  }

  async function eliminar() {
    const nFams = familias.filter((f) => f.grupo_mayor_id === id).length;
    const aviso = nFams > 0
      ? `«${nombre}» contiene ${nFams} familia(s). Quedarán sin grupo mayor. ¿Eliminar?`
      : `¿Eliminar «${nombre}»?`;
    if (!window.confirm(aviso)) return;
    const { error } = await sb.from("grupo_mayor").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Grupo mayor eliminado.");
    router.push("/grupos-mayores");
  }

  async function anadirFamilia(familyId: string) {
    const { error } = await sb.from("family").update({ grupo_mayor_id: id }).eq("id", familyId);
    if (error) { toast.error("No se pudo añadir la familia."); return; }
    await cargarFamilias();
  }
  async function quitarFamilia(familyId: string) {
    const { error } = await sb.from("family").update({ grupo_mayor_id: null }).eq("id", familyId);
    if (error) { toast.error("No se pudo quitar la familia."); return; }
    await cargarFamilias();
  }

  if (cargando) return <div className="w-full"><p className="text-sm text-muted-foreground">Cargando…</p></div>;

  const delGrupo = familias.filter((f) => f.grupo_mayor_id === id);
  const candidatas = familias
    .filter((f) => f.grupo_mayor_id !== id)
    .map((f) => ({ id: f.id, etiqueta: f.nombre, extra: f.grupo_mayor_id ? "cambiará de grupo" : undefined }));

  return (
    <form onSubmit={guardar} className="w-full space-y-4 pb-16">
      <div>
        <Link href="/grupos-mayores" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Grupos mayores
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{esNuevo ? "Nuevo grupo mayor" : nombre || "Editar grupo mayor"}</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Grupo mayor</h2>
            <div className="space-y-1.5">
              <Label htmlFor="gm-nombre">Nombre</Label>
              <Input id="gm-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Bebida, Comida…" autoFocus={esNuevo} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gm-desc">Descripción</Label>
              <Textarea id="gm-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Familias del grupo</h2>
            {esNuevo ? (
              <p className="text-sm text-muted-foreground">Guarda el grupo para poder añadirle familias.</p>
            ) : (
              <>
                <BuscarAnadir opciones={candidatas} onAnadir={anadirFamilia} placeholder="Buscar y añadir familia…" />
                {delGrupo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin familias todavía.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="w-14" aria-label="Quitar" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {delGrupo.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>
                            <span className="flex items-center gap-2.5">
                              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: f.color ?? "#64748b" }} aria-hidden />
                              <Link href={`/familias/${f.id}`} className="font-medium hover:underline">{f.nombre}</Link>
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              aria-label={`Quitar ${f.nombre} del grupo`} onClick={() => quitarFamilia(f.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Aceptar
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/grupos-mayores")}>Cancelar</Button>
        {!esNuevo && (
          <Button type="button" variant="destructive" className="ml-auto" onClick={eliminar}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        )}
      </div>
    </form>
  );
}
