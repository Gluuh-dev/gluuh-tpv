"use client";

// Asignación de grupos de la BIBLIOTECA de modificadores (0064, Fase 2 Glop) a un
// destino: familia, categoría o producto. Herencia familia → categoría → producto:
// - familia: Incluir ofrece el grupo a todos sus productos (nivel más alto; no hay "quitar").
// - categoría: Incluir lo suma a sus productos; Quitar anula lo heredado de la familia.
// - producto: Incluir/Quitar mandan sobre lo heredado de familia y categorías.
// Los grupos PROPIOS del producto (modifier_group.product_id) no se tocan aquí:
// se gestionan en su ficha. Degrada con aviso si la 0064 no está aplicada.
import { useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { BookOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Nivel = "familia" | "categoria" | "producto";
type Modo = "INCLUIR" | "EXCLUIR";

interface Grupo { id: string; nombre: string; tipo: "EXTRA" | "COMENTARIO"; opciones: number }
interface Asig { id: string; modifier_group_id: string; modo: Modo }

const CAMPO: Record<Nivel, "family_id" | "category_id" | "product_id"> = {
  familia: "family_id",
  categoria: "category_id",
  producto: "product_id",
};

export function AsignacionesBiblioteca({ nivel, refId }: { nivel: Nivel; refId: string }) {
  const [cargando, setCargando] = useState(true);
  const [sin0064, setSin0064] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [asig, setAsig] = useState<Asig[]>([]);
  /** Ids de grupo que llegan heredados de niveles superiores (solo nivel producto). */
  const [heredados, setHeredados] = useState<Set<string>>(new Set());
  const [tenantId, setTenantId] = useState<string | null>(null);
  const campo = CAMPO[nivel];

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      // Biblioteca (product_id NULL). Si `tipo` no existe, la 0064 no está aplicada.
      const g = await sb.from("modifier_group").select("id,nombre,tipo,min_sel,max_sel").is("product_id", null).order("nombre");
      if (g.error) {
        setSin0064(true);
        setCargando(false);
        return;
      }
      const [{ data: t }, { data: ops }, a] = await Promise.all([
        sb.from("tenant").select("id").limit(1).maybeSingle(),
        sb.from("modifier").select("modifier_group_id"),
        sb.from("modifier_group_asignacion").select("id,modifier_group_id,modo").eq(campo, refId),
      ]);
      if (a.error) {
        setSin0064(true);
        setCargando(false);
        return;
      }
      setTenantId((t as { id: string } | null)?.id ?? null);
      const nOps = new Map<string, number>();
      for (const o of (ops as { modifier_group_id: string }[] | null) ?? []) {
        nOps.set(o.modifier_group_id, (nOps.get(o.modifier_group_id) ?? 0) + 1);
      }
      setGrupos(
        ((g.data as { id: string; nombre: string; tipo: "EXTRA" | "COMENTARIO" }[] | null) ?? []).map((x) => ({
          ...x,
          opciones: nOps.get(x.id) ?? 0,
        })),
      );
      setAsig((a.data as Asig[] | null) ?? []);

      // Nivel producto: calcular qué grupos le llegan ya heredados (familia + categorías).
      if (nivel === "producto") {
        const { data: prod } = await sb.from("product").select("category_id").eq("id", refId).maybeSingle();
        const catPrincipal = (prod as { category_id: string | null } | null)?.category_id ?? null;
        const { data: pcs } = await sb.from("product_category").select("category_id").eq("product_id", refId);
        const catIds = ((pcs as { category_id: string }[] | null) ?? []).map((r) => r.category_id);
        if (!catIds.length && catPrincipal) catIds.push(catPrincipal);
        let famId: string | null = null;
        if (catPrincipal) {
          const { data: cat } = await sb.from("category").select("family_id").eq("id", catPrincipal).maybeSingle();
          famId = (cat as { family_id: string | null } | null)?.family_id ?? null;
        }
        const filtros: string[] = [];
        if (famId) filtros.push(`family_id.eq.${famId}`);
        if (catIds.length) filtros.push(`category_id.in.(${catIds.join(",")})`);
        if (filtros.length) {
          const { data: sup } = await sb
            .from("modifier_group_asignacion")
            .select("modifier_group_id,family_id,category_id,modo")
            .or(filtros.join(","));
          const filas = (sup as { modifier_group_id: string; family_id: string | null; category_id: string | null; modo: Modo }[] | null) ?? [];
          const set = new Set<string>();
          const porNivel = (fs: typeof filas) => {
            for (const f of fs) if (f.modo === "EXCLUIR") set.delete(f.modifier_group_id);
            for (const f of fs) if (f.modo === "INCLUIR") set.add(f.modifier_group_id);
          };
          porNivel(filas.filter((f) => f.family_id));
          porNivel(filas.filter((f) => f.category_id));
          setHeredados(set);
        }
      }
      setCargando(false);
    })();
  }, [campo, nivel, refId]);

  const estadoDe = (grupoId: string): "heredar" | "incluir" | "quitar" => {
    const fila = asig.find((x) => x.modifier_group_id === grupoId);
    if (!fila) return "heredar";
    return fila.modo === "INCLUIR" ? "incluir" : "quitar";
  };

  async function cambiar(grupoId: string, estado: "heredar" | "incluir" | "quitar") {
    const sb = supabaseBrowser();
    const actual = asig.find((x) => x.modifier_group_id === grupoId);
    if (actual) {
      const { error } = await sb.from("modifier_group_asignacion").delete().eq("id", actual.id);
      if (error) { toast.error("No se pudo guardar la asignación."); return; }
    }
    let nueva: Asig | null = null;
    if (estado !== "heredar") {
      const modo: Modo = estado === "incluir" ? "INCLUIR" : "EXCLUIR";
      const { data, error } = await sb
        .from("modifier_group_asignacion")
        .insert({ tenant_id: tenantId, modifier_group_id: grupoId, [campo]: refId, modo })
        .select("id,modifier_group_id,modo")
        .single();
      if (error) { toast.error("No se pudo guardar la asignación."); return; }
      nueva = data as Asig;
    }
    setAsig((prev) => {
      const sinGrupo = prev.filter((x) => x.modifier_group_id !== grupoId);
      return nueva ? [...sinGrupo, nueva] : sinGrupo;
    });
  }

  if (sin0064) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Falta aplicar la migración <strong>0064</strong> (biblioteca de modificadores).
          Hasta entonces no se pueden asignar grupos compartidos.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-medium">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden /> Modificadores de la biblioteca
          </h2>
          <p className="text-sm text-muted-foreground">
            {nivel === "familia" && "Los grupos incluidos aquí se ofrecen en todos los productos de la familia."}
            {nivel === "categoria" && "Incluir suma el grupo a los productos de esta categoría; Quitar anula lo heredado de la familia."}
            {nivel === "producto" && "Incluir y Quitar mandan sobre lo heredado de la familia y las categorías."}
            {" "}Los grupos se crean en <Link href="/modificadores" className="underline underline-offset-2">Modificadores</Link>.
          </p>
        </div>

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            La biblioteca está vacía. Crea grupos en <Link href="/modificadores" className="underline underline-offset-2">Modificadores</Link>.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {grupos.map((g) => {
              const estado = estadoDe(g.id);
              const heredado = heredados.has(g.id);
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{g.nombre}</span>
                      <Badge variant="outline" className="shrink-0">
                        {g.tipo === "COMENTARIO" ? "Comentario" : "Extra"}
                      </Badge>
                      {nivel === "producto" && heredado && estado === "heredar" && (
                        <Badge variant="secondary" className="shrink-0">Heredado</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {g.opciones} opción{g.opciones === 1 ? "" : "es"}
                    </p>
                  </div>
                  {nivel === "familia" ? (
                    <Switch
                      checked={estado === "incluir"}
                      onCheckedChange={(v) => cambiar(g.id, v ? "incluir" : "heredar")}
                      aria-label={`Incluir ${g.nombre} en la familia`}
                    />
                  ) : (
                    <Select value={estado} onValueChange={(v) => cambiar(g.id, v as "heredar" | "incluir" | "quitar")}>
                      <SelectTrigger className="w-32" aria-label={`Asignación de ${g.nombre}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="heredar">Heredar</SelectItem>
                        <SelectItem value="incluir">Incluir</SelectItem>
                        <SelectItem value="quitar">Quitar</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
