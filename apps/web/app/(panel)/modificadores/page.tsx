"use client";

// BIBLIOTECA de modificadores (0064, Fase 2 Glop): grupos de comentarios a cocina
// y de extras con precio, compartidos por toda la carta. Se asignan a familias,
// categorías o productos (con herencia) desde la ficha de cada una; aquí solo se
// gestionan los grupos y sus opciones. Los grupos PROPIOS de un producto
// (modifier_group.product_id) se editan en la ficha del producto, no aquí.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/app/lib/toast";
import { BookOpen, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Tipo = "EXTRA" | "COMENTARIO";

interface Opcion { id: string; nombre: string; precio_extra: number }
interface Grupo {
  id: string;
  nombre: string;
  tipo: Tipo;
  min_sel: number;
  max_sel: number;
  opciones: Opcion[];
  asignaciones: { familias: number; categorias: number; productos: number };
}

const eur = (n: number) => Number(n).toFixed(2).replace(".", ",") + " €";

export default function ModificadoresPage() {
  const [cargando, setCargando] = useState(true);
  const [sin0064, setSin0064] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Alta de grupo
  const [nuevo, setNuevo] = useState({ nombre: "", tipo: "COMENTARIO" as Tipo, obligatorio: false });
  const [creando, setCreando] = useState(false);
  // Alta de opción por grupo: borradores por id de grupo
  const [nuevaOp, setNuevaOp] = useState<Record<string, { nombre: string; precio: string }>>({});

  const cargar = useCallback(async () => {
    const sb = supabaseBrowser();
    const g = await sb
      .from("modifier_group")
      .select("id,nombre,tipo,min_sel,max_sel")
      .is("product_id", null)
      .order("nombre");
    if (g.error) {
      setSin0064(true);
      setCargando(false);
      return;
    }
    const [{ data: t }, { data: ops }, { data: asg }] = await Promise.all([
      sb.from("tenant").select("id").limit(1).maybeSingle(),
      sb.from("modifier").select("id,modifier_group_id,nombre,precio_extra"),
      sb.from("modifier_group_asignacion").select("modifier_group_id,family_id,category_id,product_id"),
    ]);
    setTenantId((t as { id: string } | null)?.id ?? null);

    const opsPor = new Map<string, Opcion[]>();
    for (const o of (ops as (Opcion & { modifier_group_id: string })[] | null) ?? []) {
      const lista = opsPor.get(o.modifier_group_id) ?? [];
      lista.push({ id: o.id, nombre: o.nombre, precio_extra: Number(o.precio_extra) });
      opsPor.set(o.modifier_group_id, lista);
    }
    const asgPor = new Map<string, { familias: number; categorias: number; productos: number }>();
    for (const a of (asg as { modifier_group_id: string; family_id: string | null; category_id: string | null; product_id: string | null }[] | null) ?? []) {
      const c = asgPor.get(a.modifier_group_id) ?? { familias: 0, categorias: 0, productos: 0 };
      if (a.family_id) c.familias++;
      else if (a.category_id) c.categorias++;
      else if (a.product_id) c.productos++;
      asgPor.set(a.modifier_group_id, c);
    }
    setGrupos(
      ((g.data as Omit<Grupo, "opciones" | "asignaciones">[] | null) ?? []).map((x) => ({
        ...x,
        opciones: opsPor.get(x.id) ?? [],
        asignaciones: asgPor.get(x.id) ?? { familias: 0, categorias: 0, productos: 0 },
      })),
    );
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function crearGrupo(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    if (!tenantId) { toast.error("No se encontró la empresa (tenant)."); return; }
    setCreando(true);
    const sb = supabaseBrowser();
    // Obligatorio = elige-uno (min 1 / max 1); si no: opcional con selección múltiple.
    const { error } = await sb.from("modifier_group").insert({
      tenant_id: tenantId,
      nombre: nuevo.nombre.trim(),
      tipo: nuevo.tipo,
      min_sel: nuevo.obligatorio ? 1 : 0,
      max_sel: nuevo.obligatorio ? 1 : 99,
    });
    setCreando(false);
    if (error) { toast.error("No se pudo crear el grupo."); return; }
    toast.success("Grupo creado.");
    setNuevo({ nombre: "", tipo: nuevo.tipo, obligatorio: false });
    void cargar();
  }

  async function borrarGrupo(g: Grupo) {
    const enUso = g.asignaciones.familias + g.asignaciones.categorias + g.asignaciones.productos;
    const aviso = enUso > 0
      ? `"${g.nombre}" está asignado en ${enUso} sitio(s). Se quitará de todos. ¿Eliminar?`
      : `¿Eliminar el grupo "${g.nombre}"?`;
    if (!window.confirm(aviso)) return;
    const { error } = await supabaseBrowser().from("modifier_group").delete().eq("id", g.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Grupo eliminado.");
    void cargar();
  }

  async function addOpcion(g: Grupo) {
    const b = nuevaOp[g.id];
    if (!b?.nombre.trim()) { toast.error("Escribe el nombre de la opción."); return; }
    if (!tenantId) { toast.error("No se encontró la empresa (tenant)."); return; }
    const precio = g.tipo === "EXTRA" ? Number((b.precio || "0").replace(",", ".")) || 0 : 0;
    const { error } = await supabaseBrowser().from("modifier").insert({
      tenant_id: tenantId,
      modifier_group_id: g.id,
      nombre: b.nombre.trim(),
      precio_extra: precio,
    });
    if (error) { toast.error("No se pudo añadir la opción."); return; }
    setNuevaOp((prev) => ({ ...prev, [g.id]: { nombre: "", precio: "" } }));
    void cargar();
  }

  async function delOpcion(id: string) {
    const { error } = await supabaseBrowser().from("modifier").delete().eq("id", id);
    if (error) { toast.error("No se pudo quitar la opción."); return; }
    void cargar();
  }

  const vacia = useMemo(() => !cargando && grupos.length === 0, [cargando, grupos]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Modificadores"
        description="Biblioteca de grupos de comentarios a cocina y extras con precio, compartida por toda la carta. Asigna cada grupo desde la ficha de familia, categoría o producto."
      />

      {sin0064 ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Falta aplicar la migración <strong>0064</strong> (biblioteca de modificadores).
            Hasta entonces los grupos solo pueden crearse producto a producto.
          </p>
        </div>
      ) : (
        <>
          {/* Alta de grupo */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={crearGrupo} className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1 space-y-1.5">
                  <Label htmlFor="mg-nombre">Nuevo grupo</Label>
                  <Input
                    id="mg-nombre"
                    value={nuevo.nombre}
                    onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
                    placeholder="Punto de la carne, Extras hamburguesa…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mg-tipo">Tipo</Label>
                  <Select value={nuevo.tipo} onValueChange={(v) => setNuevo((n) => ({ ...n, tipo: v as Tipo }))}>
                    <SelectTrigger id="mg-tipo" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMENTARIO">Comentario</SelectItem>
                      <SelectItem value="EXTRA">Extra (con precio)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mg-oblig">Obligatorio</Label>
                  <Select
                    value={nuevo.obligatorio ? "si" : "no"}
                    onValueChange={(v) => setNuevo((n) => ({ ...n, obligatorio: v === "si" }))}
                  >
                    <SelectTrigger id="mg-oblig" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="si">Sí (elige uno)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={creando}>
                  <Plus className="h-4 w-4" /> Crear grupo
                </Button>
              </form>
            </CardContent>
          </Card>

          {cargando && <p className="text-sm text-muted-foreground">Cargando…</p>}

          {vacia && (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="La biblioteca está vacía"
              description="Crea grupos reutilizables (punto de la carne, alergias, extras…) y asígnalos a familias enteras."
            />
          )}

          {grupos.map((g) => {
            const borrador = nuevaOp[g.id] ?? { nombre: "", precio: "" };
            const enUso = g.asignaciones.familias + g.asignaciones.categorias + g.asignaciones.productos;
            return (
              <Card key={g.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium">{g.nombre}</h2>
                    <Badge variant="outline">{g.tipo === "COMENTARIO" ? "Comentario" : "Extra"}</Badge>
                    {g.min_sel >= 1 && <Badge variant="secondary">Obligatorio · elige uno</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {enUso === 0
                        ? "Sin asignar"
                        : [
                            g.asignaciones.familias ? `${g.asignaciones.familias} familia(s)` : null,
                            g.asignaciones.categorias ? `${g.asignaciones.categorias} categoría(s)` : null,
                            g.asignaciones.productos ? `${g.asignaciones.productos} producto(s)` : null,
                          ].filter(Boolean).join(" · ")}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive hover:text-destructive"
                      onClick={() => borrarGrupo(g)}
                      aria-label={`Eliminar grupo ${g.nombre}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {g.opciones.map((o) => (
                      <span
                        key={o.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-sm"
                      >
                        {o.nombre}
                        {g.tipo === "EXTRA" && (
                          <span className="tabular-nums text-muted-foreground">+{eur(o.precio_extra)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => delOpcion(o.id)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={`Quitar ${o.nombre}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                    {g.opciones.length === 0 && (
                      <span className="text-sm text-muted-foreground">Sin opciones todavía.</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={borrador.nombre}
                      onChange={(e) => setNuevaOp((prev) => ({ ...prev, [g.id]: { ...borrador, nombre: e.target.value } }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addOpcion(g); } }}
                      placeholder="Nueva opción…"
                      className="w-56"
                      aria-label={`Nueva opción de ${g.nombre}`}
                    />
                    {g.tipo === "EXTRA" && (
                      <Input
                        value={borrador.precio}
                        onChange={(e) => setNuevaOp((prev) => ({ ...prev, [g.id]: { ...borrador, precio: e.target.value } }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addOpcion(g); } }}
                        placeholder="+ €"
                        inputMode="decimal"
                        className="w-24 tabular-nums"
                        aria-label={`Precio extra de la nueva opción de ${g.nombre}`}
                      />
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => addOpcion(g)}>
                      <Plus className="h-4 w-4" /> Añadir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
