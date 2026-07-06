"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2, TriangleAlert } from "lucide-react";
import { supabaseBrowser } from "../../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLOR_DEFECTO = "#64748b";
const SIN_GRUPO = "__sin_grupo__"; // Radix Select no admite value="" (0058)

interface CategoriaConexion {
  id: string;
  nombre: string;
  productos: number;
}

interface GrupoMayor {
  id: string;
  nombre: string;
}

export default function FamiliaEditarPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const esNueva = id === "nuevo";

  const [cargando, setCargando] = useState(!esNueva);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLOR_DEFECTO);
  const [orden, setOrden] = useState("0");
  const [categorias, setCategorias] = useState<CategoriaConexion[]>([]);
  const [gruposMayores, setGruposMayores] = useState<GrupoMayor[]>([]);
  const [grupoMayorId, setGrupoMayorId] = useState<string>(""); // "" = sin grupo mayor
  const [sinColumnaGrupo, setSinColumnaGrupo] = useState(false); // 0058 sin aplicar

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: gm } = await sb.from("grupo_mayor").select("id,nombre").order("nombre");
      setGruposMayores((gm as GrupoMayor[] | null) ?? []);

      if (esNueva) {
        // Sonda: si la columna no existe (0058 sin aplicar), oculta el campo.
        const probe = await sb.from("family").select("grupo_mayor_id").limit(1);
        setSinColumnaGrupo(!!probe.error);
        return;
      }

      // Cargar la familia incluyendo grupo_mayor_id; si la columna no existe → degradar.
      let f: { nombre: string; color: string | null; orden: number | null } | null = null;
      const conCol = await sb.from("family").select("nombre,color,orden,grupo_mayor_id").eq("id", id).maybeSingle();
      if (conCol.error) {
        setSinColumnaGrupo(true);
        const { data, error } = await sb.from("family").select("nombre,color,orden").eq("id", id).maybeSingle();
        if (error || !data) {
          toast.error("No se pudo cargar la familia.");
          router.push("/familias");
          return;
        }
        f = data as { nombre: string; color: string | null; orden: number | null };
      } else {
        if (!conCol.data) {
          toast.error("No se pudo cargar la familia.");
          router.push("/familias");
          return;
        }
        const fam = conCol.data as { nombre: string; color: string | null; orden: number | null; grupo_mayor_id: string | null };
        f = fam;
        setGrupoMayorId(fam.grupo_mayor_id ?? "");
      }
      setNombre(f.nombre);
      setColor(f.color ?? COLOR_DEFECTO);
      setOrden(String(f.orden ?? 0));

      // Categorías que cuelgan de esta familia + nº de productos de cada una.
      const { data: catData } = await sb
        .from("category")
        .select("id,nombre")
        .eq("family_id", id)
        .order("orden");
      const cats = (catData as { id: string; nombre: string }[] | null) ?? [];

      const conteo = new Map<string, number>();
      if (cats.length > 0) {
        const { data: prodData } = await sb
          .from("product")
          .select("category_id")
          .in("category_id", cats.map((c) => c.id));
        for (const p of (prodData as { category_id: string | null }[] | null) ?? []) {
          if (!p.category_id) continue;
          conteo.set(p.category_id, (conteo.get(p.category_id) ?? 0) + 1);
        }
      }

      setCategorias(cats.map((c) => ({ id: c.id, nombre: c.nombre, productos: conteo.get(c.id) ?? 0 })));
      setCargando(false);
    })();
  }, [esNueva, id, router]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    setGuardando(true);
    const sb = supabaseBrowser();
    const valores: Record<string, unknown> = { nombre: nombre.trim(), color, orden: Number(orden) || 0 };
    if (!sinColumnaGrupo) valores.grupo_mayor_id = grupoMayorId || null;

    if (esNueva) {
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      const tenantId = (t as { id: string } | null)?.id;
      if (!tenantId) {
        toast.error("No se encontró la empresa (tenant).");
        setGuardando(false);
        return;
      }
      const { error } = await sb.from("family").insert({ tenant_id: tenantId, ...valores });
      if (error) {
        toast.error("No se pudo crear la familia.");
        setGuardando(false);
        return;
      }
      toast.success("Familia creada.");
    } else {
      const { error } = await sb.from("family").update(valores).eq("id", id);
      if (error) {
        toast.error("No se pudieron guardar los cambios.");
        setGuardando(false);
        return;
      }
      toast.success("Cambios guardados.");
    }
    router.push("/familias");
  }

  async function eliminar() {
    const aviso =
      categorias.length > 0
        ? `Esta familia tiene ${categorias.length} categoría(s). Al eliminarla, esas categorías quedarán sin familia. ¿Continuar?`
        : "¿Eliminar esta familia?";
    if (!window.confirm(aviso)) return;

    setEliminando(true);
    const sb = supabaseBrowser();
    const { error } = await sb.from("family").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar la familia.");
      setEliminando(false);
      return;
    }
    toast.success("Familia eliminada.");
    router.push("/familias");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/familias")} className="-ml-2 mb-2">
          <ArrowLeft className="h-4 w-4" /> Familias
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {esNueva ? "Nueva familia" : "Editar familia"}
        </h1>
      </div>

      {cargando ? (
        <div className="text-muted-foreground">Cargando…</div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={guardar} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Bebidas, Entrantes, Postres…"
                    autoFocus={esNueva}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="color"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-input/30 p-1"
                      aria-label="Selector de color"
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#64748b"
                      className="w-32 font-mono"
                      aria-label="Color en hexadecimal"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="orden">Orden</Label>
                  <Input
                    id="orden"
                    type="number"
                    value={orden}
                    onChange={(e) => setOrden(e.target.value)}
                    className="w-32"
                  />
                </div>

                {sinColumnaGrupo ? (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>
                      Falta aplicar la migración <strong>0058</strong> (columna{" "}
                      <code>family.grupo_mayor_id</code>). No se puede asignar grupo mayor todavía.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="grupo-mayor">Grupo mayor</Label>
                    <Select
                      value={grupoMayorId || SIN_GRUPO}
                      onValueChange={(v) => setGrupoMayorId(v === SIN_GRUPO ? "" : v)}
                    >
                      <SelectTrigger id="grupo-mayor" className="w-full max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_GRUPO}>Sin grupo mayor</SelectItem>
                        {gruposMayores.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button type="submit" disabled={guardando || eliminando}>
                    {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                    {esNueva ? "Crear familia" : "Guardar cambios"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/familias")}
                    disabled={guardando || eliminando}
                  >
                    Cancelar
                  </Button>
                  {!esNueva && (
                    <Button
                      type="button"
                      variant="destructive"
                      className="ml-auto"
                      onClick={eliminar}
                      disabled={guardando || eliminando}
                    >
                      {eliminando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Eliminar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {!esNueva && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <h2 className="text-base font-medium">Categorías de esta familia</h2>
                  <p className="text-sm text-muted-foreground">
                    Las categorías se asignan a la familia desde cada categoría.
                  </p>
                </div>

                {categorias.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin categorías aún.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {categorias.map((c) => (
                      <Link
                        key={c.id}
                        href={`/categorias/${c.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-overlay"
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          <span className="font-medium">{c.nombre}</span>
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {c.productos} producto{c.productos === 1 ? "" : "s"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
