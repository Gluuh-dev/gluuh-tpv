"use client";

// Grupos mayores: la división por encima de las familias.
// Jerarquía: grupo mayor → familia → categoría → producto.
// Vista de división: cada grupo mayor con las familias que contiene (enlazan a
// /familias/[id]). El vínculo vive en family.grupo_mayor_id (migración 0058);
// si esa columna aún no existe, se degrada mostrando las familias como "sin grupo".
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Layers, Pencil, Trash2, Loader2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

const COLOR_DEFECTO = "#64748b";

interface Grupo { id: string; nombre: string; descripcion: string | null }
interface Familia { id: string; nombre: string; color: string; grupo_mayor_id: string | null }

export default function GruposMayoresPage() {
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [sinColumna, setSinColumna] = useState(false);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: gData } = await sb.from("grupo_mayor").select("id,nombre,descripcion").order("nombre");
    setGrupos((gData as Grupo[] | null) ?? []);

    // Familias con su grupo mayor; si la columna no existe (0058 sin aplicar) → degradar.
    const conCol = await sb.from("family").select("id,nombre,color,grupo_mayor_id").order("orden");
    if (conCol.error) {
      const { data: fData } = await sb.from("family").select("id,nombre,color").order("orden");
      setFamilias(
        ((fData as { id: string; nombre: string; color: string | null }[] | null) ?? []).map((f) => ({
          id: f.id, nombre: f.nombre, color: f.color ?? COLOR_DEFECTO, grupo_mayor_id: null,
        })),
      );
      setSinColumna(true);
    } else {
      setFamilias(
        ((conCol.data as { id: string; nombre: string; color: string | null; grupo_mayor_id: string | null }[] | null) ?? []).map((f) => ({
          id: f.id, nombre: f.nombre, color: f.color ?? COLOR_DEFECTO, grupo_mayor_id: f.grupo_mayor_id,
        })),
      );
    }
  }, []);

  useEffect(() => { void (async () => { await cargar(); setLoading(false); })(); }, [cargar]);

  function abrirNuevo() { setEditId(null); setNombre(""); setDescripcion(""); setOpen(true); }
  function abrirEditar(g: Grupo) { setEditId(g.id); setNombre(g.nombre); setDescripcion(g.descripcion ?? ""); setOpen(true); }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    const sb = supabaseBrowser();
    const valores = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };

    if (editId) {
      const { error } = await sb.from("grupo_mayor").update(valores).eq("id", editId);
      if (error) { toast.error("No se pudieron guardar los cambios."); setGuardando(false); return; }
      toast.success("Cambios guardados.");
    } else {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      const tenantId = (t as { id: string } | null)?.id;
      if (!tenantId) { toast.error("No se encontró la empresa (tenant)."); setGuardando(false); return; }
      const { error } = await sb.from("grupo_mayor").insert({ tenant_id: tenantId, ...valores });
      if (error) { toast.error("No se pudo crear el grupo mayor."); setGuardando(false); return; }
      toast.success("Grupo mayor creado.");
    }
    setGuardando(false);
    setOpen(false);
    await cargar();
  }

  async function eliminar(g: Grupo) {
    const nFam = familias.filter((f) => f.grupo_mayor_id === g.id).length;
    const aviso = nFam > 0
      ? `«${g.nombre}» contiene ${nFam} familia(s). Al eliminarlo, esas familias quedarán sin grupo mayor. ¿Continuar?`
      : `¿Eliminar «${g.nombre}»?`;
    if (!window.confirm(aviso)) return;
    const sb = supabaseBrowser();
    const { error } = await sb.from("grupo_mayor").delete().eq("id", g.id);
    if (error) { toast.error("No se pudo eliminar el grupo mayor."); return; }
    toast.success("Grupo mayor eliminado.");
    await cargar();
  }

  const familiasDe = (grupoId: string | null) => familias.filter((f) => f.grupo_mayor_id === grupoId);
  const sinGrupo = familiasDe(null);

  function ListaFamilias({ lista }: { lista: Familia[] }) {
    if (lista.length === 0) {
      return <p className="text-sm text-muted-foreground">Sin familias. Asígnalas desde cada familia.</p>;
    }
    return (
      <div className="divide-y divide-border">
        {lista.map((f) => (
          <Link
            key={f.id}
            href={`/familias/${f.id}`}
            className="flex items-center gap-2.5 py-2.5 transition-colors hover:bg-surface-overlay"
          >
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: f.color }}
              aria-hidden="true"
            />
            <span className="font-medium">{f.nombre}</span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Grupos mayores"
        description="La división por encima de las familias: grupo mayor → familia → categoría → producto."
        actions={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nuevo grupo mayor
          </Button>
        }
      />

      {sinColumna && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0058</strong> (columna <code>family.grupo_mayor_id</code>).
            Mientras tanto, no se puede asignar familias a los grupos mayores.
          </p>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : grupos.length === 0 && sinGrupo.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Sin grupos mayores todavía"
          description="Crea el primer grupo mayor para agrupar tus familias en divisiones (ej.: Salón, Terraza)."
          action={
            <Button onClick={abrirNuevo}>
              <Plus className="h-4 w-4" /> Nuevo grupo mayor
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <Card key={g.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-medium">{g.nombre}</h2>
                    {g.descripcion && <p className="text-sm text-muted-foreground">{g.descripcion}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      aria-label={`Editar ${g.nombre}`} onClick={() => abrirEditar(g)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      aria-label={`Eliminar ${g.nombre}`} onClick={() => eliminar(g)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ListaFamilias lista={familiasDe(g.id)} />
              </CardContent>
            </Card>
          ))}

          {sinGrupo.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <h2 className="text-base font-medium text-muted-foreground">Sin grupo mayor</h2>
                  <p className="text-sm text-muted-foreground">
                    Familias que aún no pertenecen a ningún grupo mayor.
                  </p>
                </div>
                <ListaFamilias lista={sinGrupo} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar grupo mayor" : "Nuevo grupo mayor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={guardar} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Salón, Terraza, Bebidas…" autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion" rows={2} value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={guardando}>
                {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                {editId ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
