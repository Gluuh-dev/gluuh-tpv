"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";

interface Familia { id: string; color: string }
interface Categoria { id: string; nombre: string; orden: number; family_id: string | null }
interface Producto {
  id: string; nombre: string; precio: number; tipo_impositivo: number;
  category_id: string | null; es_alcohol: boolean; disponible: boolean;
  estacion: string | null; agotado_hasta: string | null;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";
const COLOR_DEFECTO = "#cbd5e1";
const TODAS = "__todas__";
const SIN_CAT = "__sincat__"; // productos sin categoría

export default function ProductosLista() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>(TODAS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: fam }, { data: c }, { data: p }] = await Promise.all([
        sb.from("family").select("id,color"),
        sb.from("category").select("id,nombre,orden,family_id").order("orden"),
        sb.from("product")
          .select("id,nombre,precio,tipo_impositivo,category_id,es_alcohol,disponible,estacion,agotado_hasta")
          .order("nombre"),
      ]);
      setFamilias((fam as Familia[]) ?? []);
      setCats((c as Categoria[]) ?? []);
      setProds((p as Producto[]) ?? []);
      setCargando(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  // Color heredado: familia → categoría → producto.
  const colorDe = useMemo(() => {
    const famColor = new Map(familias.map((f) => [f.id, f.color]));
    const catColor = new Map(cats.map((c) => [c.id, (c.family_id && famColor.get(c.family_id)) || COLOR_DEFECTO]));
    return (categoryId: string | null) => (categoryId && catColor.get(categoryId)) || COLOR_DEFECTO;
  }, [familias, cats]);

  const ahora = Date.now();
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return prods.filter((p) =>
      (catFiltro === TODAS || (catFiltro === SIN_CAT ? !p.category_id : p.category_id === catFiltro)) &&
      (!q || p.nombre.toLowerCase().includes(q)),
    );
  }, [prods, catFiltro, busca]);

  // Grupos por categoría (en orden) + bucket "sin categoría" al final; solo los que tienen productos.
  const grupos = useMemo(() => [
    ...cats.map((c) => ({ id: c.id, nombre: c.nombre, prods: filtrados.filter((p) => p.category_id === c.id) })),
    { id: SIN_CAT, nombre: "Sin categoría", prods: filtrados.filter((p) => !p.category_id) },
  ].filter((g) => g.prods.length > 0), [cats, filtrados]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Productos"
        description={cargando ? "Cargando la carta…" : `${prods.length} producto${prods.length === 1 ? "" : "s"} en la carta`}
        actions={
          <Button onClick={() => router.push("/productos/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Buscar producto…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar producto" />
        </div>
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las categorías</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            <SelectItem value={SIN_CAT}>Sin categoría</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {cargando ? (
        <Card className="gap-0 overflow-hidden py-0" aria-busy>
          <span className="sr-only" role="status">Cargando productos…</span>
          <div className="animate-pulse divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="h-6 w-1 shrink-0 rounded-full bg-surface-muted" />
                <span className="h-3.5 flex-1 rounded bg-surface-muted" />
                <span className="h-3.5 w-16 rounded bg-surface-muted" />
                <span className="h-3.5 w-12 rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        </Card>
      ) : grupos.length === 0 ? (
        <EmptyState
          title={prods.length === 0 ? "Aún no hay productos" : "Sin resultados"}
          description={prods.length === 0
            ? "Crea tu primer producto para empezar a montar la carta."
            : "Prueba con otro nombre o cambia el filtro de categoría."}
          action={prods.length === 0
            ? <Button onClick={() => router.push("/productos/nuevo")}><Plus className="h-4 w-4" /> Nuevo producto</Button>
            : undefined}
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          {/* Cabecera de columnas (alineada con las celdas de cada fila). */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="w-1" aria-hidden />
            <span className="min-w-0 flex-1">Producto</span>
            <span className="w-24">Estación</span>
            <span className="w-14 text-right">IVA</span>
            <span className="w-20 text-right">Precio</span>
            <span className="w-24 text-right">Estado</span>
          </div>
          {grupos.map((g) => (
            <div key={g.id}>
              {/* Cabecera de grupo = categoría (con su color heredado de la familia). */}
              <div className="flex items-center gap-2 bg-muted/40 px-4 py-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorDe(g.id === SIN_CAT ? null : g.id) }} aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.nombre}</span>
                <span className="text-[11px] text-muted-foreground/70">· {g.prods.length}</span>
              </div>
              <div className="divide-y divide-border">
                {g.prods.map((p) => {
                  const del86 = p.agotado_hasta ? new Date(p.agotado_hasta).getTime() > ahora : false;
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Editar ${p.nombre}`}
                      onClick={() => router.push(`/productos/${p.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/productos/${p.id}`); } }}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm outline-none hover:bg-surface-overlay focus-visible:bg-surface-overlay"
                    >
                      {/* Franja de color del producto (por familia de su categoría). */}
                      <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: colorDe(p.category_id) }} aria-hidden />
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate">{p.nombre}</span>
                        {p.es_alcohol && <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">alcohol</span>}
                        {del86 && <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600" title="Agotado temporalmente (86)">86</span>}
                      </span>
                      <span className="w-24"><Badge variant="outline" className="font-normal">{ESTACION_LABEL[estacionDe(p.estacion)]}</Badge></span>
                      <span className="w-14 text-right tabular-nums text-muted-foreground">{p.tipo_impositivo}%</span>
                      <span className="w-20 text-right tabular-nums">{eur(p.precio)}</span>
                      <span className={`w-24 text-right text-xs ${p.disponible ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {p.disponible ? "Disponible" : "Agotado"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
