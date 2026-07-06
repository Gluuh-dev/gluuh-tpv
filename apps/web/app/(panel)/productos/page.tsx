"use client";

// Listado de PRODUCTOS estilo Ágora: tabla densa a ancho completo con familia,
// categorías (m2m), PLU, impuesto, estación, principal/añadido y precio.
// Scroll horizontal si no cabe. Clic en la fila = editar.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CLASES_FISCALES } from "@/lib/fiscal-clases";
import { ESTACION_LABEL, estacionDe } from "@/app/lib/estaciones";

interface Prod {
  id: string; nombre: string; precio: number; tipo_impositivo: number; clase_fiscal: string | null;
  category_id: string | null; family_id: string | null; plu: string | null;
  es_principal: boolean; es_anadido: boolean; estacion: string | null;
  disponible: boolean; agotado_hasta: string | null;
}

const eur = (n: number) => Number(n).toFixed(2).replace(".", ",") + " €";
const TODAS = "__todas__";
const SIN_CAT = "__sincat__";

const SiNo = ({ v }: Readonly<{ v: boolean }>) => (
  <span className={v ? "font-medium text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"}>{v ? "Sí" : "No"}</span>
);

export default function ProductosLista() {
  const router = useRouter();
  const [familias, setFamilias] = useState<{ id: string; nombre: string; color: string | null }[]>([]);
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [prodCats, setProdCats] = useState<Map<string, string[]>>(new Map());
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>(TODAS);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const COLS = "id,nombre,precio,tipo_impositivo,clase_fiscal,category_id,estacion,disponible,agotado_hasta";
      // Con columnas 0065; si no existen aún, degrada a las básicas.
      const full = await sb.from("product").select(`${COLS},family_id,plu,es_principal,es_anadido`).order("nombre");
      let lista: Prod[];
      if (full.error) {
        const { data } = await sb.from("product").select(COLS).order("nombre");
        lista = ((data as Omit<Prod, "family_id" | "plu" | "es_principal" | "es_anadido">[] | null) ?? [])
          .map((p) => ({ ...p, family_id: null, plu: null, es_principal: true, es_anadido: false }));
      } else {
        lista = (full.data as Prod[] | null) ?? [];
      }
      const [{ data: fam }, { data: c }, { data: pcs }] = await Promise.all([
        sb.from("family").select("id,nombre,color"),
        sb.from("category").select("id,nombre").order("orden"),
        sb.from("product_category").select("product_id,category_id"),
      ]);
      const mapa = new Map<string, string[]>();
      for (const pc of (pcs as { product_id: string; category_id: string }[] | null) ?? []) {
        const l = mapa.get(pc.product_id) ?? [];
        l.push(pc.category_id);
        mapa.set(pc.product_id, l);
      }
      setFamilias((fam as { id: string; nombre: string; color: string | null }[] | null) ?? []);
      setCats((c as { id: string; nombre: string }[] | null) ?? []);
      setProdCats(mapa);
      setProds(lista);
      setCargando(false);
    })();
  }, []);

  const nombreFam = useMemo(() => new Map(familias.map((f) => [f.id, f.nombre])), [familias]);
  const colorFam = useMemo(() => new Map(familias.map((f) => [f.id, f.color ?? "#cbd5e1"])), [familias]);
  const nombreCat = useMemo(() => new Map(cats.map((c) => [c.id, c.nombre])), [cats]);
  const claseLabel = useMemo(() => new Map<string, string>(CLASES_FISCALES.map((c) => [c.v, c.t])), []);

  const catsDe = (p: Prod): string[] => {
    const m2m = prodCats.get(p.id);
    if (m2m?.length) return m2m;
    return p.category_id ? [p.category_id] : [];
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return prods.filter((p) => {
      const enCat = catFiltro === TODAS
        || (catFiltro === SIN_CAT ? catsDe(p).length === 0 : catsDe(p).includes(catFiltro));
      return enCat && (!q || p.nombre.toLowerCase().includes(q) || (p.plu ?? "").toLowerCase() === q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prods, catFiltro, busca, prodCats]);

  async function eliminar(p: Prod, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar «${p.nombre}»? No se puede deshacer.`)) return;
    const { error } = await supabaseBrowser().from("product").delete().eq("id", p.id);
    if (error) { toast.error("No se pudo eliminar."); return; }
    toast.success("Producto eliminado.");
    setProds((prev) => prev.filter((x) => x.id !== p.id));
  }

  const ahora = Date.now();

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Productos"
        description={cargando ? "Cargando la carta…" : "Artículos de la carta con su familia, categorías y precios."}
        actions={<Button onClick={() => router.push("/productos/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={catFiltro} onValueChange={setCatFiltro}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas las categorías</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            <SelectItem value={SIN_CAT}>Sin categoría</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Buscar por nombre o PLU…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar producto" />
        </div>
      </div>

      {!cargando && prods.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Aún no hay productos"
          description="Crea tu primer producto para empezar a montar la carta."
          action={<Button onClick={() => router.push("/productos/nuevo")}><Plus className="h-4 w-4" /> Nuevo</Button>}
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Familia</TableHead>
                    <TableHead>Categorías</TableHead>
                    <TableHead>PLU</TableHead>
                    <TableHead>Impuesto</TableHead>
                    <TableHead>Tipo de prep.</TableHead>
                    <TableHead className="text-center">Principal</TableHead>
                    <TableHead className="text-center">Añadido</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Estado</TableHead>
                    <TableHead className="w-20" aria-label="Acciones" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargando && (
                    <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                  )}
                  {!cargando && filtrados.map((p) => {
                    const del86 = p.agotado_hasta ? new Date(p.agotado_hasta).getTime() > ahora : false;
                    let estado = "Disponible";
                    if (!p.disponible) estado = "Agotado";
                    else if (del86) estado = "86";
                    return (
                      <TableRow
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/productos/${p.id}`)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/productos/${p.id}`); } }}
                        className="group cursor-pointer hover:bg-surface-overlay"
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2.5">
                            <span className="inline-block h-5 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: (p.family_id && colorFam.get(p.family_id)) || "#cbd5e1" }} aria-hidden />
                            {p.nombre}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{(p.family_id && nombreFam.get(p.family_id)) ?? "—"}</TableCell>
                        <TableCell className="max-w-56 truncate text-muted-foreground">
                          {catsDe(p).map((cid) => nombreCat.get(cid)).filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">{p.plu ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.clase_fiscal ? (claseLabel.get(p.clase_fiscal) ?? p.clase_fiscal) : `${p.tipo_impositivo}%`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{ESTACION_LABEL[estacionDe(p.estacion)]}</TableCell>
                        <TableCell className="text-center"><SiNo v={p.es_principal} /></TableCell>
                        <TableCell className="text-center"><SiNo v={p.es_anadido} /></TableCell>
                        <TableCell className="text-right tabular-nums">{eur(p.precio)}</TableCell>
                        <TableCell className={`text-right text-xs ${estado === "Disponible" ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"}`}>
                          {estado}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${p.nombre}`}
                              onClick={(e) => { e.stopPropagation(); router.push(`/productos/${p.id}`); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Eliminar ${p.nombre}`}
                              onClick={(e) => eliminar(p, e)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!cargando && prods.length > 0 && filtrados.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="py-8 text-center text-muted-foreground">Sin resultados.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-border px-4 py-2 text-right text-xs text-muted-foreground">
              {filtrados.length} producto{filtrados.length === 1 ? "" : "s"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
